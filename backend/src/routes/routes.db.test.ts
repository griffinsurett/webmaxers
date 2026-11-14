// Failure handling at the route level, against the real Postgres (skipped when it is not running:
// npm run db:up). Covers: failed research and failed blueprint still let the visitor continue, a
// model failure on a chat turn does not cost the visitor a message, health, admin metrics and
// request correlation without leaking ids.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test, type TestContext } from 'node:test';
import express from 'express';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import { migrate, pingDatabase, pool } from '../db/index.js';
import { OfflineBlueprintLlm } from '../services/blueprint/llm.js';
import { emptySlots } from '../services/conversation/slots.js';
import { createSession } from '../services/conversation/sessions.js';
import { LlmError } from '../services/llm/errors.js';
import { resetLlmState } from '../services/llm/openai.js';
import { captureLogs } from '../services/log/logger.js';
import { metrics } from '../services/log/metrics.js';
import { ragService } from '../services/rag/index.js';
import type { CatalogItem } from '../types/index.js';
import { PoliteFetcher } from '../services/research/fetcher.js';
import { createBlueprintRouter } from './blueprint.js';
import { createChatRouter } from './chat.js';
import { metricsRouter } from './metrics.js';
import { createResearchRouter } from './research.js';

let up = false;
const created: string[] = [];

before(async () => {
  up = await pingDatabase(1500);
  if (up) await migrate();
});
after(async () => {
  if (up && created.length) await pool.query('delete from sessions where id = any($1)', [created]);
  await pool.end();
});

function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (t: TestContext) => {
    if (!up) return t.skip('database not running (npm run db:up)');
    resetLlmState();
    metrics.reset();
    await fn();
  });
}

async function serve(app: express.Express) {
  const server: Server = await new Promise((resolve) => { const s = createServer(app).listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
const appWith = (router: express.Router) => express().use(express.json()).use(router);

async function newSession(patch: { stage: string; slots?: object }) {
  const { id } = await createSession(`test-${Math.random()}`);
  created.push(id);
  await pool.query('update sessions set stage = $2, slots = $3 where id = $1', [id, patch.stage, patch.slots ?? emptySlots()]);
  return id;
}
const row = async (id: string) => (await pool.query('select stage, message_count, findings, blueprint from sessions where id = $1', [id])).rows[0];

const sse = (text: string) => text.split('\n\n').filter((b) => b.startsWith('event:')).map((b) => {
  const [e, d] = b.split('\n');
  return { event: e.slice(7), data: JSON.parse(d.slice(6)) };
});

const seed = JSON.parse(readFileSync(new URL('../../kb/demo-pricing.json', import.meta.url), 'utf8'));
const catalog: CatalogItem[] = seed.items.map((i: any) => ({
  sku: i.sku, kind: i.kind, name: i.name, description: i.description ?? '', price: i.price ?? 0, setup: i.setup ?? 0, monthly: i.monthly ?? 0,
  includedPages: i.included_pages ?? null, unit: i.unit ?? 'each', version: seed.version, metadata: i.metadata ?? {},
}));
const slots = () => ({ ...emptySlots(), businessName: 'Acme Plumbing', industry: 'plumbing', services: ['water heater repair'], serviceArea: 'Austin, TX', primaryGoal: 'calls' as const });

// ---- research -------------------------------------------------------------

dbTest('research that runs out of time does not strand the visitor: it is recorded as "could not read" and the conversation moves on', async () => {
  const id = await newSession({ stage: 'research', slots: slots() });
  const slow = new Promise<{ candidates: []; citedUrls: [] }>((r) => setTimeout(() => r({ candidates: [], citedUrls: [] }), 400));
  const router = createResearchRouter(
    { search: { search: () => slow }, llm: { analyze: async () => { throw new Error('unused'); } }, makeFetcher: () => new PoliteFetcher({}, 20) },
    { requireKey: false, jobTimeoutMs: 80 },
  );
  const s = await serve(appWith(router));
  try {
    const res = await fetch(`${s.base}/api/research`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
    const events = sse(await res.text());
    const done = events.find((e) => e.event === 'done');
    assert.ok(done, `events: ${events.map((e) => e.event)}`);
    assert.equal(done.data.status, 'failed');
    assert.ok(done.data.notices[0].includes('build your blueprint from what you told me'));
    assert.ok(!events.some((e) => e.event === 'error'));
    const saved = await row(id);
    assert.equal(saved.stage, 'blueprint', 'the visitor can continue');
    assert.equal(saved.findings.status, 'failed');
    assert.equal(metrics.snapshot().counters.find((c) => c.name === 'jobs_total')?.labels.outcome, 'degraded');
    await new Promise((r) => setTimeout(r, 450)); // let the abandoned job finish and free its slot
  } finally { await s.close(); }
});

// ---- blueprint ------------------------------------------------------------

dbTest('a blueprint that fails or times out is replaced by one built from the visitor\'s own answers', async () => {
  const id = await newSession({ stage: 'blueprint', slots: slots() });
  const hangs = {
    structure: (_p: unknown, signal?: AbortSignal) => new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    content: async () => { throw new Error('unused'); },
  };
  const router = createBlueprintRouter({ llm: hangs as any, search: async () => [], getCatalog: async () => catalog }, { requireKey: false, timeoutMs: 80 });
  const s = await serve(appWith(router));
  try {
    const res = await fetch(`${s.base}/api/blueprint`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
    const events = sse(await res.text());
    const done = events.find((e) => e.event === 'done');
    assert.ok(done, `events: ${events.map((e) => e.event)}`);
    assert.ok(!events.some((e) => e.event === 'error'));
    assert.equal(done.data.status, 'partial');
    assert.ok(done.data.pages.length >= 3, 'a usable sitemap');
    assert.ok(done.data.pricing.totals.initialInvestment > 0, 'priced by the rules, not the model');
    const saved = await row(id);
    assert.equal(saved.stage, 'refine');
    assert.ok(saved.blueprint);
  } finally { await s.close(); }
});

dbTest('the offline stand-in fails every pass (so the generator takes its deterministic path)', async () => {
  const llm = new OfflineBlueprintLlm();
  await assert.rejects(llm.structure(), (e: LlmError) => e.kind === 'unreachable');
  await assert.rejects(llm.content(), (e: LlmError) => e.kind === 'unreachable');
});

// ---- chat -----------------------------------------------------------------

function chatApp(runTurn: () => Promise<never>) {
  const router = createChatRouter({
    turnLlm: { runTurn } as any,
    refineLlm: { interpret: async () => { throw new Error('unused'); } } as any,
    contentLlm: new OfflineBlueprintLlm(),
    getCatalog: async () => catalog,
  });
  return appWith(router);
}
const say = (base: string, sessionId: string) => fetch(`${base}/api/chat`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, message: 'I run a plumbing company in Austin' }),
});

dbTest('a model rate limit on a chat turn is "busy" with a wait, and the visitor keeps their message', async () => {
  const id = await newSession({ stage: 'greet' });
  const s = await serve(chatApp(async () => { throw new LlmError('rate_limited', 'org-9 hit 30000 TPM', 429, 8); }));
  try {
    const res = await say(s.base, id);
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('retry-after'), '8');
    const body = await res.json() as { code: string; error: string };
    assert.equal(body.code, 'busy');
    assert.ok(!body.error.includes('org-9') && !body.error.includes('TPM'));
    assert.equal((await row(id)).message_count, 0, 'the failed turn was refunded');
  } finally { await s.close(); }
});

dbTest('any other model failure is "unavailable", never leaks provider text, and is refunded too', async () => {
  const id = await newSession({ stage: 'greet' });
  const s = await serve(chatApp(async () => { throw new LlmError('upstream', 'upstream said sk-secret-123456', 502); }));
  try {
    for (let i = 0; i < 3; i++) {
      const res = await say(s.base, id);
      assert.equal(res.status, 503);
      const body = await res.json() as { code: string; error: string };
      assert.equal(body.code, 'unavailable');
      assert.ok(!JSON.stringify(body).includes('sk-'));
    }
    assert.equal((await row(id)).message_count, 0, 'three failures cost nothing');
  } finally { await s.close(); }
});

// ---- app-level ------------------------------------------------------------

dbTest('every request gets an id; the access log names the route pattern and never the session id', async () => {
  const lines: string[] = [];
  const savedLevel = config.logLevel;
  config.logLevel = 'info';
  captureLogs((_level, line) => { lines.push(line); });
  const s = await serve(createApp());
  let header: string | null = null;
  const sessionId = '3f6038ba-8872-478b-bb20-9f88f10c32d4';
  try {
    const res = await fetch(`${s.base}/api/session/${sessionId}`);
    header = res.headers.get('x-request-id');
    assert.equal(res.status, 404);
    await res.text();
    await new Promise((r) => setTimeout(r, 30));
  } finally {
    captureLogs(null);
    config.logLevel = savedLevel;
    await s.close();
  }
  assert.match(header ?? '', /^[a-f0-9]{16}$/);
  const access = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((r) => r?.msg === 'request');
  assert.ok(access, `no access line in: ${lines.join('')}`);
  assert.equal(access.route, '/api/session/:id');
  assert.equal(access.requestId, header);
  assert.equal(access.status, 404);
  assert.ok(!lines.join('').includes(sessionId));
});

dbTest('a caller-supplied request id is kept only if it is well formed', async () => {
  const s = await serve(createApp());
  try {
    assert.equal((await fetch(`${s.base}/health`, { headers: { 'x-request-id': 'trace-abc12345' } })).headers.get('x-request-id'), 'trace-abc12345');
    const bad = (await fetch(`${s.base}/health`, { headers: { 'x-request-id': 'x y\tinjected' } })).headers.get('x-request-id');
    assert.match(bad ?? '', /^[a-f0-9]{16}$/);
  } finally { await s.close(); }
});

dbTest('throttle and Retry-After are readable by the site (CORS), and health reports the database', async () => {
  const s = await serve(createApp());
  try {
    const res = await fetch(`${s.base}/health`, { headers: { origin: config.corsOrigins[0] } });
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { database: string }).database, 'up');
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    assert.ok(/retry-after/i.test(exposed) && /x-request-id/i.test(exposed), exposed);
  } finally { await s.close(); }
});

dbTest('metrics are admin-only, absent without a token, and hold no visitor data', async () => {
  const s = await serve(express().use(metricsRouter));
  const saved = config.adminToken;
  try {
    config.adminToken = '';
    assert.equal((await fetch(`${s.base}/api/admin/metrics`)).status, 404);
    config.adminToken = 'correct-horse';
    assert.equal((await fetch(`${s.base}/api/admin/metrics`)).status, 401);
    assert.equal((await fetch(`${s.base}/api/admin/metrics`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
    metrics.inc('jobs_total', { job: 'research', outcome: 'complete' });
    const ok = await fetch(`${s.base}/api/admin/metrics`, { headers: { authorization: 'Bearer correct-horse' } });
    assert.equal(ok.status, 200);
    const body = await ok.json() as { counters: unknown[]; circuits: Record<string, string> };
    assert.equal(body.circuits.turn, 'closed');
    assert.ok(body.counters.length >= 1);
  } finally { config.adminToken = saved; await s.close(); }
});

// ---- knowledge search -------------------------------------------------------

dbTest('knowledge search falls back to keywords when the embedding service fails', async () => {
  const { rows: [{ n }] } = await pool.query('select count(*)::int as n from kb_chunks where embedding is not null');
  if (n === 0) return; // nothing embedded in this database: the vector path is not reachable
  const fake = createServer((_req, res) => { res.writeHead(500, { 'content-type': 'application/json', 'retry-after-ms': '10' }); res.end('{"error":{"message":"down"}}'); });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const savedKey = config.openaiApiKey;
  const savedBase = process.env.OPENAI_BASE_URL;
  config.openaiApiKey = 'sk-test';
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}/v1`;
  resetLlmState();
  try {
    const results = await ragService.searchKnowledgeBase('website pages price', 3);
    assert.ok(results.every((r) => r.mode === 'keyword'));
    assert.ok(results.length > 0);
  } finally {
    config.openaiApiKey = savedKey;
    if (savedBase === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = savedBase;
    resetLlmState();
    fake.closeAllConnections(); fake.close();
  }
});
