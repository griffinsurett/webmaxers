// Admin knowledge uploads against a real Postgres. Every test runs in a throwaway database that this
// file creates and drops, so it can never touch a real catalog. Skipped when Postgres is not running
// (npm run db:up).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test, type TestContext } from 'node:test';
import express from 'express';
import pg from 'pg';
import { config } from '../../config/index.js';
import type { ProposedItem } from './pricingVerify.js';

// ---- an isolated database ---------------------------------------------------

const testDb = `bp_test_${randomBytes(5).toString('hex')}`;
const adminUrl = (() => { const u = new URL(config.databaseUrl); u.pathname = '/postgres'; return u.toString(); })();
const testUrl = (() => { const u = new URL(config.databaseUrl); u.pathname = `/${testDb}`; return u.toString(); })();

let up = false;
try {
  const c = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 1500 });
  await c.connect();
  await c.query(`create database ${testDb}`);
  await c.end();
  up = true;
} catch { /* no database: every test below skips itself */ }

config.databaseUrl = testUrl; // read by the pool when db/index.js is first imported (below)
config.openaiApiKey = '';     // never call the real model or embedding service from tests
config.adminToken = 'test-admin-token-1234567890';

const { pool, migrate } = await import('../../db/index.js');
const { ragService, seedKnowledgeBaseIfEmpty } = await import('../rag/index.js');
const { pricingService } = await import('../pricing/index.js');
const store = await import('./store.js');
const { verifyProposal } = await import('./pricingVerify.js');
const { kbRouter } = await import('../../routes/kb.js');

let firstSeed: string | null = null;
if (up) { await migrate(); firstSeed = await seedKnowledgeBaseIfEmpty(); }

after(async () => {
  await pool.end();
  if (!up) return;
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  await c.query(`drop database if exists ${testDb} with (force)`);
  await c.end();
});

function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (t: TestContext) => {
    if (!up) return t.skip('database not running (npm run db:up)');
    await pool.query('delete from kb_uploads');
    await pool.query(`delete from kb_chunks where source like 'upload:%'`);
    await ragService.syncKnowledgeBase({ embed: false }); // back to the shipped catalog
    config.adminToken = 'test-admin-token-1234567890';
    await fn();
  });
}

// ---- helpers ---------------------------------------------------------------

const DOC = `Webmaxxers pricing, January
Starter Website: $1,400 (up to 5 pages)
Each additional standard page is $275.
Priority support: $120 per month.`;

const proposed = (over: Partial<ProposedItem>): ProposedItem => ({
  sku: 'site-starter', kind: 'website_type', name: null, description: null, price: 1400, setup: null, monthly: null,
  includedPages: 5, unit: null, sourceQuote: 'Starter Website: $1,400 (up to 5 pages)', ...over,
});
const STARTER = proposed({});
const PAGE = proposed({ sku: 'page-standard', kind: 'page', price: 275, includedPages: null, sourceQuote: 'Each additional standard page is $275.' });
const SUPPORT = proposed({ sku: 'addon-priority-support', kind: 'addon', name: 'Priority support', price: null, includedPages: null, monthly: 120, sourceQuote: 'Priority support: $120 per month.' });

async function draft(items: ProposedItem[], doc = DOC): Promise<string> {
  const id = await store.createUpload({ kind: 'pricing', filename: 'prices.txt', mime: 'text/plain', bytes: doc.length, text: doc, status: 'processing' });
  await store.setDraft(id, { kind: 'pricing', items: verifyProposal(items, await ragService.getCatalog(), doc) });
  return id;
}
const price = async (sku: string) => (await ragService.getCatalog()).find((c) => c.sku === sku)?.price;
const rejectedWith = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: unknown) => e instanceof store.PublishError && e.code === code, `expected ${code}`);
const fivePages = ['home', 'about', 'services', 'projects', 'contact'].map((id) => ({ id, sku: 'page-standard', included: true, classification: 'core' as const }));

// ---- first start ------------------------------------------------------------

dbTest('first start: an empty database is seeded once, and not again', async () => {
  assert.equal(firstSeed, 'seeded', 'the throwaway database started empty');
  assert.equal(await seedKnowledgeBaseIfEmpty(), 'already_seeded');
  await pool.query('update pricing_catalog set active = false');
  assert.equal(await seedKnowledgeBaseIfEmpty(), 'seeded', 'an emptied catalog is loaded again');
  assert.ok((await ragService.getCatalog()).length > 15);
});

dbTest('every table has row-level security on (Supabase\'s public API can read nothing), and the app still works', async () => {
  const { rows } = await pool.query(`select relname, relrowsecurity from pg_class where relname = any($1)`, [['pricing_catalog', 'kb_chunks', 'sessions', 'rate_limits', 'kb_uploads']]);
  assert.equal(rows.length, 5);
  assert.ok(rows.every((r) => r.relrowsecurity), JSON.stringify(rows));
  assert.ok((await ragService.getCatalog()).length > 0, 'the owner role is unaffected');
});

// ---- publish ----------------------------------------------------------------

dbTest('publishing changes the prices the agent quotes, immediately and as one catalog version', async () => {
  const id = await draft([STARTER, PAGE, SUPPORT]);
  const out = await store.publishPricing(id, ['site-starter', 'page-standard', 'addon-priority-support']);
  assert.equal(out.applied, 3);

  assert.equal(await price('site-starter'), 1400);
  assert.equal(await price('page-standard'), 275);
  const support = (await ragService.getCatalog()).find((c) => c.sku === 'addon-priority-support');
  assert.equal(support?.monthly, 120);
  assert.equal(support?.name, 'Priority support');
  assert.ok((await ragService.getCatalog()).every((c) => c.version === out.version), 'one version label for the whole catalog');

  // The pricing engine, which the whole agent uses, quotes from the new figures.
  const quote = pricingService.calculate({ websiteTypeSku: 'site-starter', pages: fivePages }, await ragService.getCatalog());
  assert.equal(quote.totals.initialInvestment, 1400);

  const detail = await store.getUpload(id);
  assert.equal(detail?.status, 'published');
  assert.equal(detail?.version, out.version);
});

dbTest('search text follows the change: the old figure is gone and the new one is findable', async () => {
  await store.publishPricing(await draft([STARTER]), ['site-starter']);
  const { rows } = await pool.query(`select content from kb_chunks where metadata->>'sku' = 'site-starter'`);
  assert.equal(rows.length, 1, 'exactly one description of the item');
  assert.match(rows[0].content, /\$1,400/);
  assert.doesNotMatch(rows[0].content, /\$1,250/);
});

dbTest('only the approved items are applied', async () => {
  const id = await draft([STARTER, PAGE]);
  await store.publishPricing(id, ['site-starter']);
  assert.equal(await price('site-starter'), 1400);
  assert.equal(await price('page-standard'), 250, 'not approved, so unchanged');
});

dbTest('unverified items (rejected) can never be published, even if their code is approved', async () => {
  const hallucinated = proposed({ sku: 'page-standard', kind: 'page', price: 9999, includedPages: null, sourceQuote: 'Each additional standard page is $275.' });
  const id = await draft([STARTER, hallucinated]);
  await rejectedWith(store.publishPricing(id, ['page-standard']), 'nothing_selected');
  assert.equal(await price('page-standard'), 250);
});

dbTest('a catalog that changed since the draft was reviewed is refused (stale), and nothing is written', async () => {
  const id = await draft([STARTER, PAGE]);
  await pool.query(`update pricing_catalog set price = 1300 where sku = 'site-starter'`);
  await assert.rejects(store.publishPricing(id, ['site-starter', 'page-standard']), (e: unknown) => e instanceof store.PublishError && e.code === 'stale' && e.details.includes('site-starter'));
  assert.equal(await price('site-starter'), 1300);
  assert.equal(await price('page-standard'), 250, 'the other approved item was not applied either');
  assert.equal((await store.getUpload(id))?.status, 'draft');
});

dbTest('a change that would break the agent is refused and rolls back EVERYTHING in the batch', async () => {
  const id = await draft([STARTER, PAGE]);
  // Craft a draft whose first item would leave the starter website with no base price.
  const { rows } = await pool.query('select proposal from kb_uploads where id = $1', [id]);
  const proposal = rows[0].proposal;
  proposal.items.find((i: any) => i.sku === 'site-starter').after.price = 0;
  await pool.query('update kb_uploads set proposal = $2 where id = $1', [id, JSON.stringify(proposal)]);

  await assert.rejects(store.publishPricing(id, ['site-starter', 'page-standard']), (e: unknown) => e instanceof store.PublishError && e.code === 'invalid' && e.details.some((d) => d.includes('site-starter')));
  assert.equal(await price('site-starter'), 1250);
  assert.equal(await price('page-standard'), 250, 'atomic: the valid change was not applied either');
});

dbTest('publish is single-use, and a rejected or published draft cannot be published again', async () => {
  const id = await draft([STARTER]);
  await rejectedWith(store.publishPricing(id, []), 'nothing_selected');
  await store.publishPricing(id, ['site-starter']);
  await rejectedWith(store.publishPricing(id, ['site-starter']), 'not_draft');
  const other = await draft([PAGE]);
  await store.rejectUpload(other);
  await rejectedWith(store.publishPricing(other, ['page-standard']), 'not_draft');
  await rejectedWith(store.publishPricing('00000000-0000-4000-8000-000000000000', ['x']), 'not_found');
});

dbTest('two admins publishing the same draft at the same moment: exactly one wins', async () => {
  const id = await draft([STARTER, PAGE]);
  const results = await Promise.allSettled([store.publishPricing(id, ['site-starter']), store.publishPricing(id, ['site-starter'])]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await price('site-starter'), 1400);
});

// ---- undo -------------------------------------------------------------------

dbTest('undo restores the previous prices, version and search text, and removes an added item', async () => {
  const before = (await ragService.getCatalog()).map((c) => ({ sku: c.sku, price: c.price, setup: c.setup, monthly: c.monthly, version: c.version }));
  const id = await draft([STARTER, PAGE, SUPPORT]);
  await store.publishPricing(id, ['site-starter', 'page-standard', 'addon-priority-support']);
  assert.equal((await store.getUpload(id))?.canRevert, true);

  await store.revertUpload(id);
  const after = (await ragService.getCatalog()).map((c) => ({ sku: c.sku, price: c.price, setup: c.setup, monthly: c.monthly, version: c.version }));
  assert.deepEqual(after, before, 'the catalog is exactly as it was');
  assert.equal((await ragService.getCatalog()).some((c) => c.sku === 'addon-priority-support'), false);
  const { rows } = await pool.query(`select content from kb_chunks where metadata->>'sku' = 'site-starter'`);
  assert.equal(rows.length, 1);
  assert.match(rows[0].content, /\$1,250/);
  assert.equal((await store.getUpload(id))?.status, 'reverted');
});

dbTest('only the most recent pricing upload can be undone, newest first', async () => {
  const a = await draft([STARTER]);
  await store.publishPricing(a, ['site-starter']);
  const b = await draft([PAGE]);
  await store.publishPricing(b, ['page-standard']);
  assert.equal((await store.getUpload(a))?.canRevert, false);
  await rejectedWith(store.revertUpload(a), 'not_latest');
  await store.revertUpload(b);
  await store.revertUpload(a);
  assert.equal(await price('site-starter'), 1250);
  assert.equal(await price('page-standard'), 250);
});

dbTest('undo refuses when the catalog was edited after the upload (it would overwrite that edit)', async () => {
  const id = await draft([STARTER]);
  await store.publishPricing(id, ['site-starter']);
  await pool.query(`update pricing_catalog set price = 1500 where sku = 'site-starter'`);
  await rejectedWith(store.revertUpload(id), 'stale');
  assert.equal(await price('site-starter'), 1500);
});

// ---- guidance ---------------------------------------------------------------

dbTest('guidance text becomes searchable, survives a re-sync from the seed files, and can be undone', async () => {
  const text = '# Roofers\n\nRoofing companies convert best with a storm damage landing page and a free inspection offer.';
  const { chunkGuidance } = await import('./chunker.js');
  const preview = chunkGuidance(text, 'roofing.md', 'preview');
  const id = await store.createUpload({ kind: 'guidance', filename: 'roofing.md', mime: 'text/plain', bytes: text.length, text, status: 'draft', proposal: { kind: 'guidance', total: preview.length, chunks: preview.map((c) => ({ heading: c.heading, content: c.content })) } });

  assert.deepEqual(await ragService.searchKnowledgeBase('storm damage landing page', 3).then((r) => r.filter((x) => x.source.startsWith('upload:'))), []);
  assert.equal((await store.publishGuidance(id)).chunks, 1);
  const found = await ragService.searchKnowledgeBase('storm damage landing page', 3);
  assert.ok(found.some((r) => r.source === `upload:${id}` && /free inspection/.test(r.content)));

  await ragService.syncKnowledgeBase({ embed: false }); // re-import of the seed files
  assert.equal((await pool.query('select 1 from kb_chunks where source = $1', [`upload:${id}`])).rowCount, 1, 'uploaded text is not wiped by a seed sync');

  await store.revertUpload(id);
  assert.equal((await pool.query('select 1 from kb_chunks where source = $1', [`upload:${id}`])).rowCount, 0);
  assert.equal(await store.hasActivePricingUploads(), false, 'guidance never blocks a seed sync');
});

dbTest('an upload that never finished is marked failed instead of "processing" forever', async () => {
  const id = await store.createUpload({ kind: 'pricing', filename: 'old.pdf', mime: 'application/pdf', bytes: 10, text: 'x', status: 'processing' });
  await pool.query(`update kb_uploads set created_at = now() - interval '10 minutes' where id = $1`, [id]);
  const list = await store.listUploads();
  assert.equal(list.find((u) => u.id === id)?.status, 'failed');
});

async function serve(app: express.Express) {
  const server: Server = await new Promise((resolve) => { const s = createServer(app).listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
const auth = { Authorization: `Bearer ${'test-admin-token-1234567890'}` };
const postJson = (base: string, path: string, body: unknown = {}) => fetch(base + path, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ---- the seed-file sync guard -----------------------------------------------

dbTest('re-importing the seed files cannot silently undo published prices', async () => {
  await store.publishPricing(await draft([STARTER]), ['site-starter']);
  const s = await serve(express().use(express.json()).use(kbRouter));
  try {
    const blocked = await postJson(s.base, '/api/kb/sync');
    assert.equal(blocked.status, 409);
    assert.equal(((await blocked.json()) as any).code, 'uploads_published');
    assert.equal(await price('site-starter'), 1400);
    assert.equal((await postJson(s.base, '/api/kb/sync', { force: true })).status, 200);
    assert.equal(await price('site-starter'), 1250, 'an explicit force does re-import');
  } finally { await s.close(); }
});
