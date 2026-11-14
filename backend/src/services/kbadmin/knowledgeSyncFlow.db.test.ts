// The admin workflow end to end, the way it happens in the Supabase dashboard: a file appears in the storage
// bucket, the backend reads it, the admin changes a status cell, the backend acts. Runs against a real Postgres
// in a throwaway database that this file creates and drops. Skipped when Postgres is not running (npm run db:up).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test, type TestContext } from 'node:test';
import pg from 'pg';
import { config } from '../../config/index.js';
import { LlmError } from '../llm/errors.js';
import type { PricingExtractor } from './pricingExtract.js';
import type { ProposedItem } from './pricingVerify.js';
import type { StorageClient, StoredFile, SyncDeps } from './knowledgeSync.js';

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

config.databaseUrl = testUrl;
config.openaiApiKey = ''; // never call the real model or embedding service from tests

const { pool, migrate } = await import('../../db/index.js');
const { ragService, seedKnowledgeBaseIfEmpty } = await import('../rag/index.js');
const sync = await import('./knowledgeSync.js');
const store = await import('./store.js');

if (up) { await migrate(); await seedKnowledgeBaseIfEmpty(); }

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
    await pool.query('delete from sessions');
    await pool.query(`delete from kb_chunks where source like 'upload:%'`);
    await ragService.syncKnowledgeBase({ embed: false }); // back to the shipped catalog
    await fn();
  });
}

// ---- fakes: the storage bucket and the model --------------------------------

class FakeBucket implements StorageClient {
  files = new Map<string, { etag: string; buf: Buffer; size?: number | null }>();
  downloads = 0;
  put(path: string, content: string | Buffer, etag = `etag-${randomBytes(3).toString('hex')}`, size?: number | null) {
    this.files.set(path, { etag, buf: Buffer.isBuffer(content) ? content : Buffer.from(content), size });
  }
  async list(): Promise<StoredFile[]> { return [...this.files].map(([path, f]) => ({ path, etag: f.etag, size: f.size === undefined ? f.buf.length : f.size })); }
  async download(path: string): Promise<Buffer> { this.downloads++; const f = this.files.get(path); if (!f) throw new Error('gone'); return f.buf; }
}

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

function counting(items: ProposedItem[]) {
  const extractor: PricingExtractor & { calls: number } = { calls: 0, async extract() { this.calls++; return items; } };
  return extractor;
}
const depsOf = (bucket: FakeBucket, extractor: PricingExtractor, hasModel = true): SyncDeps =>
  ({ storage: bucket, extractor, getCatalog: () => ragService.getCatalog(), hasModel: () => hasModel });

const price = async (sku: string) => (await ragService.getCatalog()).find((c) => c.sku === sku)?.price;
const rowOf = async (filename: string) => (await pool.query('select id, status::text as status, error, version, storage_path from kb_uploads where filename = $1 order by created_at desc', [filename])).rows[0];
/** What the admin does in the Table Editor: change the status cell. */
const adminSets = (id: string, status: string) => pool.query('update kb_uploads set status = $2 where id = $1', [id, status]);

// ---- reading files ----------------------------------------------------------

dbTest('a pricing file dropped in the bucket is read, checked and shown to the admin, and changes nothing yet', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const report = await sync.runKnowledgeSyncOnce(depsOf(bucket, counting([STARTER, PAGE, SUPPORT])));
  assert.equal(report.read, 1);

  const row = await rowOf('january.txt');
  assert.equal(row.status, 'draft');
  assert.equal(row.storage_path, 'pricing/january.txt');
  assert.equal(await price('site-starter'), 1250, 'nothing is live until approved');

  // What the admin sees in Supabase: the readable review view.
  const { rows } = await pool.query(`select item_code, change, old_price, new_price, old_monthly, new_monthly, from_the_document, check_these from kb_price_review where upload_id = $1 order by item_code`, [row.id]);
  const byCode = Object.fromEntries(rows.map((r) => [r.item_code, r]));
  assert.equal(byCode['site-starter'].change, 'changed');
  assert.equal(byCode['site-starter'].old_price, 1250);
  assert.equal(byCode['site-starter'].new_price, 1400);
  assert.match(byCode['site-starter'].from_the_document, /Starter Website: \$1,400/);
  assert.equal(byCode['addon-priority-support'].change, 'new');
  assert.equal(byCode['addon-priority-support'].new_monthly, 120);
  assert.equal(rows.length, 3);
});

dbTest('a file is read once; the same name with new contents is read again', async () => {
  const bucket = new FakeBucket();
  const extractor = counting([STARTER]);
  bucket.put('pricing/p.txt', DOC, 'v1');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor));
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor));
  assert.equal(extractor.calls, 1, 'not read again');
  assert.equal(bucket.downloads, 1, 'not even downloaded again');
  bucket.put('pricing/p.txt', DOC, 'v2');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor));
  assert.equal(extractor.calls, 2);
  assert.equal((await pool.query(`select count(*)::int as n from kb_uploads where filename = 'p.txt'`)).rows[0].n, 2);
});

dbTest('a guidance file becomes a draft with a preview, and warns when it contains prices', async () => {
  const bucket = new FakeBucket();
  bucket.put('guidance/roofing.md', '# Roofers\n\nRoofing companies convert best with a storm damage landing page. Our starter package is $1,400.');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, counting([])));
  const row = await rowOf('roofing.md');
  assert.equal(row.status, 'draft');
  const detail = await store.getUpload(row.id);
  assert.equal(detail?.proposal?.kind, 'guidance');
  assert.match((detail!.proposal as any).warnings[0], /pricing folder/);
});

// ---- the admin's decisions ----------------------------------------------------

dbTest('APPROVE: setting the status cell to "approved" makes the agent use the new prices', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const deps = depsOf(bucket, counting([STARTER, PAGE, SUPPORT]));
  await sync.runKnowledgeSyncOnce(deps);
  const { id } = await rowOf('january.txt');

  await adminSets(id, 'approved');
  const report = await sync.runKnowledgeSyncOnce(deps);
  assert.equal(report.published, 1);

  assert.equal(await price('site-starter'), 1400);
  assert.equal(await price('page-standard'), 275);
  assert.equal((await ragService.getCatalog()).find((c) => c.sku === 'addon-priority-support')?.monthly, 120);
  const row = await rowOf('january.txt');
  assert.equal(row.status, 'published');
  assert.match(row.version, /^up-/);
  const { rows } = await pool.query(`select content from kb_chunks where metadata->>'sku' = 'site-starter'`);
  assert.match(rows[0].content, /\$1,400/, 'search text follows the change');
});

dbTest('REJECT: nothing is applied, and the row stays rejected', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const deps = depsOf(bucket, counting([STARTER]));
  await sync.runKnowledgeSyncOnce(deps);
  await adminSets((await rowOf('january.txt')).id, 'rejected');
  const report = await sync.runKnowledgeSyncOnce(deps);
  assert.equal(report.published, 0);
  assert.equal(await price('site-starter'), 1250);
  assert.equal((await rowOf('january.txt')).status, 'rejected');
});

dbTest('only items that passed verification are applied when the whole file is approved', async () => {
  const hallucinated = proposed({ sku: 'page-standard', kind: 'page', price: 9999, includedPages: null, sourceQuote: 'Each additional standard page is $275.' });
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const deps = depsOf(bucket, counting([STARTER, hallucinated]));
  await sync.runKnowledgeSyncOnce(deps);
  const { id } = await rowOf('january.txt');
  const review = await pool.query(`select item_code, change, rejected_because from kb_price_review where upload_id = $1`, [id]);
  assert.match(review.rows.find((r) => r.item_code === 'page-standard').rejected_because, /9999/);
  await adminSets(id, 'approved');
  await sync.runKnowledgeSyncOnce(deps);
  assert.equal(await price('site-starter'), 1400);
  assert.equal(await price('page-standard'), 250, 'the unverified change was never applied');
});

dbTest('approving a draft that is out of date is refused, and the reason is written where the admin is looking', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const deps = depsOf(bucket, counting([STARTER]));
  await sync.runKnowledgeSyncOnce(deps);
  const { id } = await rowOf('january.txt');
  await pool.query(`update pricing_catalog set price = 1300 where sku = 'site-starter'`); // someone edited the catalog meanwhile
  await adminSets(id, 'approved');
  await sync.runKnowledgeSyncOnce(deps);
  const row = await rowOf('january.txt');
  assert.equal(row.status, 'failed');
  assert.match(row.error, /^Not published\./);
  assert.match(row.error, /catalog changed/);
  assert.equal(await price('site-starter'), 1300, 'untouched');
  const again = await sync.runKnowledgeSyncOnce(deps);
  assert.equal(again.failed, 0, 'a failed row is not retried forever');
});

dbTest('UNDO: setting a published row to "undo" puts the previous prices back; only the latest can be undone', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/a.txt', DOC);
  const a = counting([STARTER]);
  await sync.runKnowledgeSyncOnce(depsOf(bucket, a));
  await adminSets((await rowOf('a.txt')).id, 'approved');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, a));

  bucket.put('pricing/b.txt', DOC);
  const b = counting([PAGE]);
  await sync.runKnowledgeSyncOnce(depsOf(bucket, b));
  await adminSets((await rowOf('b.txt')).id, 'approved');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, b));
  assert.equal(await price('site-starter'), 1400);
  assert.equal(await price('page-standard'), 275);

  // Undoing the older one first is refused, with the reason in the error column.
  await adminSets((await rowOf('a.txt')).id, 'undo');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, b));
  const refused = await rowOf('a.txt');
  assert.equal(refused.status, 'published');
  assert.match(refused.error, /Could not undo\. Only the most recent/);
  assert.equal(await price('site-starter'), 1400);

  // Newest first works, then the older one.
  await adminSets((await rowOf('b.txt')).id, 'undo');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, b));
  assert.equal(await price('page-standard'), 250);
  assert.equal((await rowOf('b.txt')).status, 'reverted');
  await adminSets((await rowOf('a.txt')).id, 'undo');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, b));
  assert.equal(await price('site-starter'), 1250);
});

dbTest('a guidance file approved in the dashboard becomes searchable, and can be undone', async () => {
  const bucket = new FakeBucket();
  bucket.put('guidance/electricians.md', '# Electricians\n\nElectricians win jobs with an emergency call-out page and licence details.');
  const deps = depsOf(bucket, counting([]));
  await sync.runKnowledgeSyncOnce(deps);
  const { id } = await rowOf('electricians.md');
  await adminSets(id, 'approved');
  await sync.runKnowledgeSyncOnce(deps);
  assert.ok((await ragService.searchKnowledgeBase('emergency call-out page', 3)).some((r) => r.source === `upload:${id}`));
  await adminSets(id, 'undo');
  await sync.runKnowledgeSyncOnce(deps);
  assert.ok(!(await ragService.searchKnowledgeBase('emergency call-out page', 3)).some((r) => r.source === `upload:${id}`));
});

// ---- problems are reported where the admin looks ----------------------------------

dbTest('a file that cannot be read is recorded as failed with a plain reason, and is not retried', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/tool.exe', 'MZ some binary-looking text that is long enough');
  bucket.put('pricing/huge.pdf', Buffer.from('%PDF-1.4'), 'e1', 6 * 1024 * 1024);
  bucket.put('pricing/empty.txt', '   ');
  const extractor = counting([STARTER]);
  const report = await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor));
  assert.equal(report.failed, 3);
  assert.match((await rowOf('tool.exe')).error, /Only PDF, \.txt and \.md/);
  assert.match((await rowOf('huge.pdf')).error, /larger than 5 MB/);
  assert.equal(bucket.downloads, 2, 'the oversized file was never even downloaded');
  assert.equal(extractor.calls, 0);
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor));
  assert.equal(bucket.downloads, 2, 'not retried');
});

dbTest('a busy or slow model is retried on the next pass instead of leaving a failed row behind', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const flaky: PricingExtractor & { calls: number } = { calls: 0, async extract() { this.calls++; if (this.calls === 1) throw new LlmError('rate_limited', 'org-1 hit TPM', 429); return [STARTER]; } };
  await sync.runKnowledgeSyncOnce(depsOf(bucket, flaky));
  assert.equal((await pool.query(`select count(*)::int as n from kb_uploads`)).rows[0].n, 0, 'no trace of the failed attempt');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, flaky));
  assert.equal((await rowOf('january.txt')).status, 'draft');
  assert.equal(flaky.calls, 2);
});

dbTest('a model that cannot make sense of the file reports it once, in plain words', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/messy.txt', DOC);
  const bad: PricingExtractor = { async extract() { throw new LlmError('bad_output', 'schema mismatch at items[3] sk-secret-123456'); } };
  await sync.runKnowledgeSyncOnce(depsOf(bucket, bad));
  const row = await rowOf('messy.txt');
  assert.equal(row.status, 'failed');
  assert.match(row.error, /clearer or shorter/);
  assert.ok(!/sk-|schema/.test(row.error));
  const empty: PricingExtractor = { async extract() { return []; } };
  bucket.put('pricing/notes.txt', 'Meeting notes about colours and snacks, nothing about money at all.');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, empty));
  assert.match((await rowOf('notes.txt')).error, /No prices were found/);
});

dbTest('without an OpenAI key, pricing files wait (unrecorded) while guidance still works; a key later picks them up', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  bucket.put('guidance/tips.md', '# Tips\n\nPlumbers do best with a service area page.');
  const extractor = counting([STARTER]);
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor, false));
  assert.equal(await rowOf('january.txt'), undefined);
  assert.equal((await rowOf('tips.md')).status, 'draft');
  await sync.runKnowledgeSyncOnce(depsOf(bucket, extractor, true));
  assert.equal((await rowOf('january.txt')).status, 'draft');
});

dbTest('a pass reads at most five new files, and the rest on the next', async () => {
  const bucket = new FakeBucket();
  for (let i = 0; i < 7; i++) bucket.put(`guidance/g${i}.md`, `# Note ${i}\n\nGuidance number ${i} about local businesses.`);
  const first = await sync.runKnowledgeSyncOnce(depsOf(bucket, counting([])));
  assert.equal(first.read, 5);
  const second = await sync.runKnowledgeSyncOnce(depsOf(bucket, counting([])));
  assert.equal(second.read, 2);
});

dbTest('two backend instances never run a pass at the same time', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const slow: PricingExtractor = { async extract() { await gate; return [STARTER]; } };
  const first = sync.runKnowledgeSyncOnce(depsOf(bucket, slow));
  await new Promise((r) => setTimeout(r, 150));
  const second = await sync.runKnowledgeSyncOnce(depsOf(bucket, counting([])));
  assert.equal(second.skipped, 'another_instance');
  release();
  assert.equal((await first).read, 1);
});

dbTest('the background loop does the work on its own, and stops when told', async () => {
  const bucket = new FakeBucket();
  bucket.put('pricing/january.txt', DOC);
  const extractor = counting([STARTER]);
  const stop = sync.startKnowledgeSync(depsOf(bucket, extractor), 50);
  for (let i = 0; i < 80 && extractor.calls === 0; i++) await new Promise((r) => setTimeout(r, 100));
  stop();
  assert.equal(extractor.calls, 1);
  const before = extractor.calls;
  bucket.put('pricing/later.txt', DOC);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(extractor.calls, before, 'stopped');
});

// ---- what the admin sees in Supabase --------------------------------------------

dbTest('the "generations" view shows what visitors made, one readable row each', async () => {
  const blueprint = { version: 1, status: 'complete', pages: [{ id: 'home' }, { id: 'about' }, { id: 'contact' }], pricing: { totals: { initialInvestment: 2250, monthly: 79 } } };
  const slots = { businessName: 'Acme Plumbing', industry: 'plumbing', serviceArea: 'Austin, TX', primaryGoal: 'calls', ownUrl: 'https://acme.example', services: [] };
  await pool.query(`insert into sessions (id, ip, stage, slots, messages, blueprint, message_count) values ('11111111-1111-4111-8111-111111111111','203.0.113.9','refine',$1,'[]',$2,7)`, [slots, JSON.stringify(blueprint)]);
  await pool.query(`insert into sessions (id, ip, stage, slots, messages, message_count) values ('22222222-2222-4222-8222-222222222222','203.0.113.10','intake','{}','[]',2)`);

  const { rows } = await pool.query(`select * from generations order by created_at`);
  assert.equal(rows.length, 2);
  const done = rows.find((r) => r.business === 'Acme Plumbing');
  assert.deepEqual(
    { stage: done.stage, industry: done.industry, area: done.area, goal: done.goal, messages: done.messages, has: done.has_blueprint, status: done.blueprint_status, pages: done.pages, invest: done.initial_investment, monthly: done.monthly },
    { stage: 'refine', industry: 'plumbing', area: 'Austin, TX', goal: 'calls', messages: 7, has: true, status: 'complete', pages: 3, invest: 2250, monthly: 79 },
  );
  const early = rows.find((r) => r.session_id === '22222222-2222-4222-8222-222222222222');
  assert.equal(early.has_blueprint, false);
  assert.equal(early.pages, 0);
  assert.ok(!('ip' in done), 'a visitor\'s network address is not in the overview');
});

dbTest('the status cell is a dropdown of valid choices (an enum), so a typo cannot be saved', async () => {
  const id = await store.createUpload({ kind: 'guidance', filename: 'x.md', mime: 'text/plain', bytes: 5, text: 'hello world, long enough', status: 'draft' });
  await assert.rejects(adminSets(id, 'aproved'), /invalid input value for enum/);
  const { rows } = await pool.query(`select enum_range(null::kb_upload_status)::text as r`);
  for (const s of ['draft', 'approved', 'published', 'rejected', 'undo', 'failed']) assert.ok(rows[0].r.includes(s), s);
});

dbTest('the views obey row-level security (security_invoker), and the schema is safe to apply again and again', async () => {
  const { rows } = await pool.query(`select relname, reloptions::text as o from pg_class where relname in ('kb_price_review', 'generations')`);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => /security_invoker=true/.test(r.o)), JSON.stringify(rows));
  await migrate(); await migrate();
  assert.equal((await pool.query('select count(*)::int as n from kb_uploads')).rows[0].n, 0);
});

dbTest('on Supabase the private "knowledge" bucket is created for you; anywhere else the step does nothing', async () => {
  assert.equal((await pool.query(`select to_regclass('storage.buckets') as t`)).rows[0].t, null, 'a plain Postgres has no storage schema');
  // Pretend to be Supabase: it has a storage.buckets table.
  await pool.query(`create schema if not exists storage`);
  await pool.query(`create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false)`);
  try {
    await migrate();
    await migrate(); // and again: no duplicate, no error
    const { rows } = await pool.query(`select id, name, public from storage.buckets`);
    assert.deepEqual(rows, [{ id: 'knowledge', name: 'knowledge', public: false }]);
  } finally {
    await pool.query('drop schema storage cascade');
  }
});
