// backend/src/services/kbadmin/store.ts
// Storage and the publish / undo rules for admin knowledge uploads.
//
// A pricing upload moves draft -> approved (set by the admin in Supabase) -> published, or draft -> rejected.
// Publishing writes the approved items to pricing_catalog in ONE transaction, after re-checking that the catalog still matches what the
// admin reviewed and that the result still satisfies everything the agent depends on. What it
// changed is stored on the upload, so the latest publish can be undone exactly.
import type { PoolClient } from 'pg';
import { pool } from '../../db/index.js';
import type { CatalogItem } from '../../types/index.js';
import { log } from '../log/logger.js';
import { deleteChunksBySku, deleteChunksBySource, describeItem, insertChunks, type Chunk } from '../rag/index.js';
import { validateCatalog } from './catalogRules.js';
import { chunkGuidance } from './chunker.js';
import { fieldsOf, type ItemFields, type ReviewItem } from './pricingVerify.js';

export type UploadKind = 'pricing' | 'guidance';
export type UploadStatus = 'processing' | 'draft' | 'approved' | 'published' | 'rejected' | 'reverted' | 'failed' | 'undo';

export interface PricingProposal { kind: 'pricing'; items: ReviewItem[] }
export interface GuidanceProposal { kind: 'guidance'; total: number; chunks: { heading: string; content: string }[]; warnings?: string[] }
export type Proposal = PricingProposal | GuidanceProposal;

interface AppliedItem { sku: string; before: ItemFields | null; after: ItemFields }
interface Applied { prevVersion: string | null; items: AppliedItem[]; chunks?: number }

export interface UploadSummary {
  id: string; kind: UploadKind; filename: string; status: UploadStatus; bytes: number;
  createdAt: string; publishedAt: string | null; version: string | null; error: string | null;
  counts: { changed: number; new: number; unchanged: number; rejected: number } | null;
  chunks: number | null;
}

export interface UploadDetail extends UploadSummary { proposal: Proposal | null; canRevert: boolean }

export type PublishFailure = 'not_found' | 'not_draft' | 'nothing_selected' | 'stale' | 'invalid' | 'not_latest' | 'wrong_kind';
export class PublishError extends Error {
  constructor(public readonly code: PublishFailure, message: string, public readonly details: string[] = []) {
    super(message);
    this.name = 'PublishError';
  }
}

/** A processing upload this old never finished (the server restarted, say). */
const STALE_PROCESSING = "interval '5 minutes'";
const CHUNK_SOURCE = (id: string) => `upload:${id}`;
const PRICING_CHUNK_SOURCE = (id: string) => `upload:pricing:${id}`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const toSummary = (r: any): UploadSummary => {
  const proposal = r.proposal as Proposal | null;
  const counts = proposal?.kind === 'pricing'
    ? proposal.items.reduce((c, i) => ({ ...c, [i.status]: c[i.status] + 1 }), { changed: 0, new: 0, unchanged: 0, rejected: 0 })
    : null;
  return {
    id: r.id, kind: r.kind, filename: r.filename, status: r.status, bytes: r.bytes,
    createdAt: new Date(r.created_at).toISOString(), publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    version: r.version, error: r.error, counts, chunks: proposal?.kind === 'guidance' ? proposal.total : null,
  };
};

export async function sweepStale(): Promise<void> {
  await pool.query(
    `update kb_uploads set status = 'failed', error = 'The upload was interrupted before it finished. Please upload it again.'
     where status = 'processing' and created_at < now() - ${STALE_PROCESSING}`,
  );
}

export async function listUploads(limit = 30): Promise<UploadSummary[]> {
  await sweepStale();
  const { rows } = await pool.query(
    `select id, kind, filename, status, bytes, created_at, published_at, version, error, proposal
     from kb_uploads order by created_at desc limit $1`, [limit],
  );
  return rows.map(toSummary);
}

/** The newest published, not-yet-reverted pricing upload: the only one that can be undone. */
async function latestPublishedPricingId(client: Pick<PoolClient, 'query'> = pool): Promise<string | null> {
  const { rows } = await client.query(
    `select id from kb_uploads where kind = 'pricing' and status in ('published', 'undo') order by published_at desc limit 1`,
  );
  return rows[0]?.id ?? null;
}

export async function getUpload(id: string): Promise<UploadDetail | null> {
  await sweepStale();
  const { rows } = await pool.query(
    `select id, kind, filename, status, bytes, created_at, published_at, version, error, proposal from kb_uploads where id = $1`, [id],
  );
  if (!rows[0]) return null;
  const summary = toSummary(rows[0]);
  const canRevert = (summary.status === 'published' || summary.status === 'undo')
    && (summary.kind === 'guidance' || (await latestPublishedPricingId()) === id);
  return { ...summary, proposal: rows[0].proposal as Proposal | null, canRevert };
}

/** The extracted text, for the extraction step and for tests. Not sent to the browser. */
export async function getUploadText(id: string): Promise<string | null> {
  const { rows } = await pool.query('select extracted_text from kb_uploads where id = $1', [id]);
  return rows[0]?.extracted_text ?? null;
}

/** True once any pricing upload has been published and not undone: the database, not the seed files, is then the source of truth. */
export async function hasActivePricingUploads(): Promise<boolean> {
  const { rows } = await pool.query(`select 1 from kb_uploads where kind = 'pricing' and status in ('published', 'undo') limit 1`);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Creating and finishing drafts
// ---------------------------------------------------------------------------

export async function createUpload(input: {
  kind: UploadKind; filename: string; mime: string; bytes: number; text: string; status: 'processing' | 'draft' | 'failed';
  proposal?: Proposal; error?: string; storagePath?: string; storageEtag?: string;
}): Promise<string> {
  const { rows } = await pool.query(
    `insert into kb_uploads (kind, filename, mime, bytes, status, extracted_text, proposal, error, storage_path, storage_etag)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [input.kind, input.filename.slice(0, 200), input.mime, input.bytes, input.status, input.text, input.proposal ? JSON.stringify(input.proposal) : null,
      input.error?.slice(0, 500) ?? null, input.storagePath ?? null, input.storageEtag ?? null],
  );
  return rows[0].id;
}

/** Has this exact version of this stored file already been read? */
export async function hasStoredFile(path: string, etag: string): Promise<boolean> {
  const { rows } = await pool.query('select 1 from kb_uploads where storage_path = $1 and storage_etag = $2', [path, etag]);
  return rows.length > 0;
}

export async function idsByStatus(status: UploadStatus, limit = 20): Promise<string[]> {
  const { rows } = await pool.query('select id from kb_uploads where status = $1 order by created_at limit $2', [status, limit]);
  return rows.map((r) => r.id);
}

/** Sets the status (and the message the admin sees in the Table Editor) whatever it was before. */
export async function setStatus(id: string, status: UploadStatus, error: string | null = null): Promise<void> {
  await pool.query('update kb_uploads set status = $2, error = $3 where id = $1', [id, status, error?.slice(0, 500) ?? null]);
}

/** Everything a draft proposes that can be applied: the changed and new items that passed verification. */
export async function approvableSkus(id: string): Promise<string[]> {
  const { rows } = await pool.query('select proposal from kb_uploads where id = $1', [id]);
  const proposal = rows[0]?.proposal as Proposal | null;
  if (proposal?.kind !== 'pricing') return [];
  return proposal.items.filter((i) => i.status === 'changed' || i.status === 'new').map((i) => i.sku);
}

export async function setDraft(id: string, proposal: Proposal): Promise<void> {
  await pool.query(`update kb_uploads set status = 'draft', proposal = $2, error = null where id = $1 and status = 'processing'`, [id, JSON.stringify(proposal)]);
}

export async function failUpload(id: string, message: string): Promise<void> {
  await pool.query(`update kb_uploads set status = 'failed', error = $2 where id = $1 and status = 'processing'`, [id, message.slice(0, 500)]);
}

/** Forgets an upload that never produced a draft (a transient failure), so the file is read again. */
export async function discardUpload(id: string): Promise<void> {
  await pool.query(`delete from kb_uploads where id = $1 and status = 'processing'`, [id]);
}

export async function rejectUpload(id: string): Promise<void> {
  const { rowCount } = await pool.query(`update kb_uploads set status = 'rejected' where id = $1 and status = 'draft'`, [id]);
  if (!rowCount) throw new PublishError('not_draft', 'Only a draft can be rejected.');
}

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

const rowToItem = (r: any): CatalogItem => ({
  sku: r.sku, kind: r.kind, name: r.name, description: r.description, price: r.price, setup: r.setup,
  monthly: r.monthly, includedPages: r.included_pages, unit: r.unit, version: r.version, metadata: r.metadata ?? {},
});

async function lockCatalog(client: PoolClient): Promise<{ all: CatalogItem[]; active: CatalogItem[] }> {
  const { rows } = await client.query(`select sku, kind, name, description, price, setup, monthly, included_pages, unit, version, metadata, active from pricing_catalog for update`);
  const all = rows.map(rowToItem);
  return { all, active: rows.filter((r) => r.active).map(rowToItem) };
}

const sameFields = (a: ItemFields, b: ItemFields) => (Object.keys(a) as (keyof ItemFields)[]).every((k) => a[k] === b[k]);

async function writeItem(client: PoolClient, sku: string, f: ItemFields, version: string, active: boolean): Promise<void> {
  await client.query(
    `insert into pricing_catalog (sku, kind, name, description, price, setup, monthly, included_pages, unit, active, version, metadata, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'{}'::jsonb,now())
     on conflict (sku) do update set
       kind = excluded.kind, name = excluded.name, description = excluded.description, price = excluded.price,
       setup = excluded.setup, monthly = excluded.monthly, included_pages = excluded.included_pages,
       unit = excluded.unit, active = excluded.active, version = excluded.version, updated_at = now()`,
    [sku, f.kind, f.name, f.description, f.price, f.setup, f.monthly, f.includedPages, f.unit, active, version],
  );
}

const pricingChunk = (id: string, sku: string, f: ItemFields, version: string): Chunk => ({
  source: PRICING_CHUNK_SOURCE(id),
  heading: `Pricing > ${f.name}`,
  content: describeItem({
    sku, kind: f.kind, name: f.name, description: f.description, price: f.price, setup: f.setup,
    monthly: f.monthly, included_pages: f.includedPages ?? undefined, unit: f.unit,
  }),
  metadata: { sku, kind: f.kind, version },
});

/** Makes search describe the new figures instead of the old. Best effort: the catalog (the source of every price) is already right. */
async function refreshPricingChunks(id: string, items: { sku: string; f: ItemFields | null }[], version: string): Promise<void> {
  try {
    await deleteChunksBySku(items.map((i) => i.sku));
    await insertChunks(items.filter((i): i is { sku: string; f: ItemFields } => i.f !== null).map((i) => pricingChunk(id, i.sku, i.f, version)));
  } catch (err) {
    log.warn('could not refresh pricing text chunks after a catalog change', { err });
  }
}

const versionLabel = (id: string) => `up-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 8)}`;

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export async function publishPricing(id: string, approvedSkus: string[], from: UploadStatus[] = ['draft']): Promise<{ version: string; applied: number }> {
  const client = await pool.connect();
  let version = '';
  let toApply: { sku: string; before: ItemFields | null; after: ItemFields }[] = [];
  try {
    await client.query('begin');
    const { rows } = await client.query(`select kind, status, proposal from kb_uploads where id = $1 for update`, [id]);
    const upload = rows[0];
    if (!upload) throw new PublishError('not_found', 'That upload was not found.');
    if (upload.kind !== 'pricing') throw new PublishError('wrong_kind', 'That is not a pricing upload.');
    if (!from.includes(upload.status)) throw new PublishError('not_draft', 'Only a draft can be published.');

    const approved = new Set(approvedSkus);
    const items = ((upload.proposal as PricingProposal).items).filter((i) => (i.status === 'changed' || i.status === 'new') && approved.has(i.sku));
    if (items.length === 0) throw new PublishError('nothing_selected', 'Select at least one change to publish.');

    const { all, active } = await lockCatalog(client);
    const bySku = new Map(all.map((c) => [c.sku, c]));
    const activeBySku = new Map(active.map((c) => [c.sku, c]));

    // The catalog must still be what the admin reviewed.
    const moved = items.filter((i) => (i.before ? !(activeBySku.has(i.sku) && sameFields(fieldsOf(activeBySku.get(i.sku)!), i.before)) : activeBySku.has(i.sku)));
    if (moved.length) {
      throw new PublishError('stale', 'The catalog changed since this draft was made. Upload the document again to review it against the current prices.', moved.map((m) => m.sku));
    }

    toApply = items.map((i) => ({ sku: i.sku, before: i.before, after: i.after as ItemFields }));

    // The result must still satisfy everything the agent depends on.
    const next = new Map(activeBySku);
    for (const a of toApply) next.set(a.sku, { ...(bySku.get(a.sku) ?? { description: '', unit: 'each', version: '', metadata: {}, sku: a.sku }), ...a.after, sku: a.sku, version: '' } as CatalogItem);
    const problems = validateCatalog([...next.values()]);
    if (problems.length) throw new PublishError('invalid', 'Publishing this would break the agent, so nothing was changed.', problems);

    version = versionLabel(id);
    const prevVersion = active[0]?.version ?? null;
    for (const a of toApply) await writeItem(client, a.sku, a.after, version, true);
    await client.query(`update pricing_catalog set version = $1, updated_at = now() where active`, [version]); // one label for the whole catalog
    const applied: Applied = { prevVersion, items: toApply };
    await client.query(`update kb_uploads set status = 'published', published_at = now(), version = $2, applied = $3 where id = $1`, [id, version, JSON.stringify(applied)]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await refreshPricingChunks(id, toApply.map((a) => ({ sku: a.sku, f: a.after })), version);
  return { version, applied: toApply.length };
}

export async function publishGuidance(id: string, from: UploadStatus[] = ['draft']): Promise<{ chunks: number }> {
  const { rows } = await pool.query(`select kind, status, filename, extracted_text from kb_uploads where id = $1`, [id]);
  const upload = rows[0];
  if (!upload) throw new PublishError('not_found', 'That upload was not found.');
  if (upload.kind !== 'guidance') throw new PublishError('wrong_kind', 'That is not a guidance upload.');
  if (!from.includes(upload.status)) throw new PublishError('not_draft', 'Only a draft can be published.');

  // Claim it first so it cannot be published twice.
  const claim = await pool.query(`update kb_uploads set status = 'published', published_at = now() where id = $1 and status::text = any($2::text[])`, [id, from]);
  if (!claim.rowCount) throw new PublishError('not_draft', 'Only a draft can be published.');
  try {
    const chunks = chunkGuidance(upload.extracted_text, upload.filename, id);
    await insertChunks(chunks);
    await pool.query(`update kb_uploads set applied = $2 where id = $1`, [id, JSON.stringify({ prevVersion: null, items: [], chunks: chunks.length } satisfies Applied)]);
    return { chunks: chunks.length };
  } catch (err) {
    await deleteChunksBySource(CHUNK_SOURCE(id)).catch(() => {});
    await pool.query(`update kb_uploads set status = $2, published_at = null where id = $1`, [id, upload.status]);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

export async function revertUpload(id: string): Promise<void> {
  const { rows } = await pool.query(`select kind, status from kb_uploads where id = $1`, [id]);
  const upload = rows[0];
  if (!upload) throw new PublishError('not_found', 'That upload was not found.');
  if (upload.status !== 'published' && upload.status !== 'undo') throw new PublishError('not_draft', 'Only a published upload can be undone.');

  if (upload.kind === 'guidance') {
    await deleteChunksBySource(CHUNK_SOURCE(id));
    await pool.query(`update kb_uploads set status = 'reverted', reverted_at = now() where id = $1`, [id]);
    return;
  }

  const client = await pool.connect();
  let restored: { sku: string; f: ItemFields | null }[] = [];
  let version = '';
  try {
    await client.query('begin');
    const locked = await client.query(`select status, applied from kb_uploads where id = $1 for update`, [id]);
    if (locked.rows[0]?.status !== 'published' && locked.rows[0]?.status !== 'undo') throw new PublishError('not_draft', 'Only a published upload can be undone.');
    if ((await latestPublishedPricingId(client)) !== id) throw new PublishError('not_latest', 'Only the most recent pricing upload can be undone. Undo the newer one first.');

    const applied = locked.rows[0].applied as Applied;
    const { active } = await lockCatalog(client);
    const activeBySku = new Map(active.map((c) => [c.sku, c]));
    const changedSince = applied.items.filter((a) => !(activeBySku.has(a.sku) && sameFields(fieldsOf(activeBySku.get(a.sku)!), a.after)));
    if (changedSince.length) throw new PublishError('stale', 'The catalog was changed after this upload, so it cannot be undone safely.', changedSince.map((c) => c.sku));

    version = applied.prevVersion ?? 'restored';
    for (const a of applied.items) {
      if (a.before) await writeItem(client, a.sku, a.before, version, true);
      else await client.query(`update pricing_catalog set active = false, updated_at = now() where sku = $1`, [a.sku]); // an item this upload added
    }
    await client.query(`update pricing_catalog set version = $1, updated_at = now() where active`, [version]);
    await client.query(`update kb_uploads set status = 'reverted', reverted_at = now() where id = $1`, [id]);
    await client.query('commit');
    restored = applied.items.map((a) => ({ sku: a.sku, f: a.before }));
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await refreshPricingChunks(id, restored, version);
}
