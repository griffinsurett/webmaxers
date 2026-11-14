// The shared model layer: error classification, circuit breaker, deadlines and the real SDK's
// retry behaviour against a fake OpenAI server (no network, no key).
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, test } from 'node:test';
import OpenAI from 'openai';
import { z } from 'zod';
import { CircuitBreaker } from './breaker.js';
import { LlmError, classifyLlmError, visitorFailure } from './errors.js';
import { PROFILES, breakerFor, callLlm, resetLlmState } from './openai.js';
import { metrics } from '../log/metrics.js';

afterEach(() => { resetLlmState(); metrics.reset(); });

// ---- classification --------------------------------------------------------

const apiError = (status: number, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  OpenAI.APIError.generate(status, { error: body, ...body }, 'boom', new Headers(headers));

test('classification: provider statuses map to stable kinds', () => {
  const kind = (e: unknown, o?: Parameters<typeof classifyLlmError>[1]) => classifyLlmError(e, o).kind;
  assert.equal(kind(apiError(429, { code: 'rate_limit_exceeded' })), 'rate_limited');
  assert.equal(kind(apiError(429, { code: 'insufficient_quota' })), 'quota');
  assert.equal(kind(apiError(401)), 'misconfigured');
  assert.equal(kind(apiError(403)), 'misconfigured');
  assert.equal(kind(apiError(404)), 'misconfigured');
  assert.equal(kind(apiError(500)), 'upstream');
  assert.equal(kind(apiError(503)), 'upstream');
  assert.equal(kind(apiError(400)), 'bad_output');
  assert.equal(kind(new OpenAI.APIConnectionTimeoutError()), 'timeout');
  assert.equal(kind(new OpenAI.APIConnectionError({ message: 'down' })), 'unreachable');
  assert.equal(kind(new Error('x'), { deadlineHit: true }), 'timeout');
  assert.equal(kind(new Error('x'), { cancelled: true }), 'cancelled');
  assert.equal(kind(z.object({ a: z.string() }).safeParse({}).error), 'bad_output');
  assert.equal(kind(new Error('something odd')), 'unknown');
});

test('classification: a 429 carries Retry-After through; bad output does not count against provider health', () => {
  const e = classifyLlmError(apiError(429, {}, { 'retry-after': '7' }));
  assert.equal(e.retryAfter, 7);
  assert.equal(e.countsAgainstHealth, true);
  assert.equal(classifyLlmError(new LlmError('bad_output', 'x')).countsAgainstHealth, false);
  assert.equal(new LlmError('cancelled', 'x').countsAgainstHealth, false);
});

test('visitors get "busy" (retryable, with a wait) for rate limits and paused calls, "unavailable" otherwise, and never provider text', () => {
  const busy = visitorFailure(new LlmError('rate_limited', 'org-123 hit the 30000 TPM limit', 429, 9));
  assert.deepEqual(busy, { status: 503, code: 'busy', error: 'The assistant is very busy right now. Please try again in a moment.', retryAfter: 9 });
  assert.equal(visitorFailure(new LlmError('circuit_open', 'paused')).code, 'busy');
  for (const k of ['timeout', 'upstream', 'unreachable', 'quota', 'misconfigured', 'bad_output', 'unknown'] as const) {
    const f = visitorFailure(new LlmError(k, 'secret provider detail sk-123'));
    assert.equal(f.code, 'unavailable', k);
    assert.ok(!f.error.includes('secret') && !f.error.includes('sk-'), k);
  }
});

// ---- breaker ---------------------------------------------------------------

test('breaker: opens after N failures in a row, probes once after the cool-down, closes on success', () => {
  let t = 0;
  const b = new CircuitBreaker({ threshold: 3, openMs: 1000, now: () => t });
  for (let i = 0; i < 2; i++) { assert.ok(b.acquire().ok); b.failure(); }
  assert.equal(b.state, 'closed');
  b.acquire(); b.failure(); // third
  assert.equal(b.state, 'open');
  const refused = b.acquire();
  assert.ok(!refused.ok && refused.retryAfterMs === 1000);
  t = 1000;
  assert.equal(b.state, 'half_open');
  assert.deepEqual(b.acquire(), { ok: true, probe: true });
  assert.ok(!b.acquire().ok, 'only one probe at a time');
  b.success();
  assert.equal(b.state, 'closed');
  assert.deepEqual(b.acquire(), { ok: true, probe: false });
});

test('breaker: a failed probe re-opens it; a success resets the failure streak; cancelled does nothing', () => {
  let t = 0;
  const b = new CircuitBreaker({ threshold: 2, openMs: 1000, now: () => t });
  b.failure(); b.success(); b.failure();
  assert.equal(b.state, 'closed', 'streak was reset');
  b.failure();
  assert.equal(b.state, 'open');
  t = 1500;
  b.acquire(); b.failure();
  assert.equal(b.state, 'open');
  t = 2400;
  assert.equal(b.state, 'open', 'cool-down restarted at the failed probe');
  t = 2500;
  b.acquire(); b.neutral();
  assert.equal(b.state, 'half_open');
  assert.ok(b.acquire().ok, 'a cancelled probe frees the slot');
});

// ---- callLlm ---------------------------------------------------------------

test('callLlm: after repeated provider failures calls fail fast without reaching the provider', async () => {
  let reached = 0;
  const failing = async () => { reached++; throw apiError(500); };
  for (let i = 0; i < 5; i++) await assert.rejects(callLlm('turn', failing), (e: LlmError) => e.kind === 'upstream');
  assert.equal(reached, 5);
  await assert.rejects(callLlm('turn', failing), (e: LlmError) => e.kind === 'circuit_open' && (e.retryAfter ?? 0) > 0);
  assert.equal(reached, 5, 'the sixth call never left the building');
  assert.equal(breakerFor('turn').state, 'open');
  assert.equal(breakerFor('analysis').state, 'closed', 'other profiles are unaffected');
});

test('callLlm: unusable model output does not trip the breaker (the provider is healthy)', async () => {
  for (let i = 0; i < 10; i++) await assert.rejects(callLlm('refine', async () => { throw new LlmError('bad_output', 'bad json'); }), (e: LlmError) => e.kind === 'bad_output');
  assert.equal(breakerFor('refine').state, 'closed');
});

test('callLlm: the total deadline aborts a hung call and reports a timeout', async () => {
  const saved = PROFILES.turn.deadlineMs;
  PROFILES.turn.deadlineMs = 40;
  try {
    const started = Date.now();
    await assert.rejects(
      callLlm('turn', (_c, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) ),
      (e: LlmError) => e.kind === 'timeout',
    );
    assert.ok(Date.now() - started < 1000);
  } finally { PROFILES.turn.deadlineMs = saved; }
});

test('callLlm: a caller cancelling is "cancelled", not a provider failure', async () => {
  const ctl = new AbortController();
  const p = callLlm('content', (_c, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))), { signal: ctl.signal });
  ctl.abort();
  await assert.rejects(p, (e: LlmError) => e.kind === 'cancelled');
  assert.equal(breakerFor('content').state, 'closed');
});

test('callLlm: records outcome counts and timings', async () => {
  await callLlm('search', async () => 'ok');
  await assert.rejects(callLlm('search', async () => { throw apiError(429); }));
  const s = metrics.snapshot();
  const count = (outcome: string) => s.counters.find((c) => c.name === 'llm_calls_total' && c.labels.profile === 'search' && c.labels.outcome === outcome)?.value;
  assert.equal(count('ok'), 1);
  assert.equal(count('rate_limited'), 1);
  assert.equal(s.timings.find((t) => t.name === 'llm_call_ms')?.count, 2);
});

test('every profile fits its callers: total deadline covers the attempts, and a chat turn fits the site timeout', () => {
  for (const [name, p] of Object.entries(PROFILES)) {
    assert.ok(p.deadlineMs >= p.attemptMs, `${name}: deadline shorter than one attempt`);
    assert.ok(p.retries >= 0 && p.retries <= 2, name);
  }
  // Site chat timeout is 90s; a refine turn may call refine then content.
  assert.ok(PROFILES.refine.deadlineMs + PROFILES.content.deadlineMs <= 90_000);
  // Jobs: research ceiling 240s (search + analysis), blueprint ceiling 180s (structure + one content round).
  assert.ok(PROFILES.search.deadlineMs + PROFILES.analysis.deadlineMs < 240_000);
  assert.ok(PROFILES.structure.deadlineMs + PROFILES.content.deadlineMs <= 180_000);
});

// ---- the real SDK against a fake server ------------------------------------

async function fakeOpenAi(handler: (req: IncomingMessage, res: ServerResponse, n: number) => void) {
  let n = 0;
  const server: Server = createServer((req, res) => handler(req, res, ++n));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  return {
    client: new OpenAI({ apiKey: 'sk-test', baseURL, maxRetries: 1, timeout: 2000 }),
    hits: () => n,
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};
const embeddingBody = { object: 'list', data: [{ object: 'embedding', index: 0, embedding: [0.1] }], model: 'm', usage: { prompt_tokens: 1, total_tokens: 1 } };
const embed = (client: OpenAI) => callLlm('embedding', (c, o) => c.embeddings.create({ model: 'm', input: 'x' }, o), { client });

test('SDK: a rate-limited request is retried after the server-provided delay and then succeeds', async () => {
  const s = await fakeOpenAi((_req, res, n) => n === 1
    ? json(res, 429, { error: { code: 'rate_limit_exceeded', message: 'slow down' } }, { 'retry-after-ms': '20' })
    : json(res, 200, embeddingBody));
  try {
    const out = await embed(s.client);
    assert.equal(out.data[0].embedding[0], 0.1);
    assert.equal(s.hits(), 2);
  } finally { await s.close(); }
});

test('SDK: persistent 5xx is retried once, then reported as upstream', async () => {
  const s = await fakeOpenAi((_req, res) => json(res, 500, { error: { message: 'oops' } }, { 'retry-after-ms': '10' }));
  try {
    await assert.rejects(embed(s.client), (e: LlmError) => e.kind === 'upstream' && e.status === 500);
    assert.equal(s.hits(), 2, 'one try plus one retry');
  } finally { await s.close(); }
});

test('SDK: a bad key is "misconfigured" and is not retried; an empty billing balance is "quota"', async () => {
  const bad = await fakeOpenAi((_req, res) => json(res, 401, { error: { code: 'invalid_api_key', message: 'Incorrect API key provided: sk-test' } }));
  try {
    await assert.rejects(embed(bad.client), (e: LlmError) => e.kind === 'misconfigured');
    assert.equal(bad.hits(), 1);
  } finally { await bad.close(); }
  resetLlmState();
  const quota = await fakeOpenAi((_req, res) => json(res, 429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } }));
  try {
    await assert.rejects(embed(quota.client), (e: LlmError) => e.kind === 'quota');
  } finally { await quota.close(); }
});

test('SDK: a server that never answers is cut off by the deadline, not left hanging', async () => {
  const saved = PROFILES.embedding.deadlineMs;
  PROFILES.embedding.deadlineMs = 150;
  const s = await fakeOpenAi(() => { /* never respond */ });
  try {
    const started = Date.now();
    await assert.rejects(embed(s.client), (e: LlmError) => e.kind === 'timeout');
    assert.ok(Date.now() - started < 1500);
  } finally { PROFILES.embedding.deadlineMs = saved; await s.close(); }
});
