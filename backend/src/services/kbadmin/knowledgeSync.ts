// backend/src/services/kbadmin/knowledgeSync.ts
// Connects the Supabase dashboard to the agent, so no separate admin tool is needed.
//
//   The admin, in the Supabase dashboard             The backend, every minute or so
//   ------------------------------------             --------------------------------
//   drops a file into Storage > knowledge/pricing    reads it, checks every number against the file's
//   (or knowledge/guidance)                          own words, writes a draft to the kb_uploads table
//   reads kb_price_review, sets status "approved"    publishes it: new quotes use the new prices
//   sets status "rejected"                           leaves everything as it was
//   sets status "undo" on a published row            puts the previous prices back
//
// Anything that goes wrong is written to the row's "error" column, which is visible in the same place.
import type { PoolClient } from 'pg';
import { config } from '../../config/index.js';
import { pool } from '../../db/index.js';
import type { CatalogItem } from '../../types/index.js';
import { LlmError } from '../llm/errors.js';
import { log } from '../log/logger.js';
import { metrics } from '../log/metrics.js';
import { chunkGuidance } from './chunker.js';
import { MAX_UPLOAD_BYTES, UploadError, extractFileText } from './extractText.js';
import type { PricingExtractor } from './pricingExtract.js';
import { verifyProposal } from './pricingVerify.js';
import {
  PublishError, approvableSkus, createUpload, discardUpload, failUpload, hasStoredFile, idsByStatus, publishGuidance,
  publishPricing, revertUpload, setDraft, setStatus, sweepStale, type GuidanceProposal,
} from './store.js';

// ---------------------------------------------------------------------------
// Supabase Storage
// ---------------------------------------------------------------------------

export interface StoredFile { path: string; etag: string; size: number | null }

export interface StorageClient {
  /** Files in the bucket's pricing/ and guidance/ folders. */
  list(): Promise<StoredFile[]>;
  download(path: string, maxBytes: number): Promise<Buffer>;
}

const FOLDERS = ['pricing', 'guidance'] as const;
const PAGE = 100;
const REQUEST_TIMEOUT_MS = 20_000;

export function createSupabaseStorage(options: { url: string; serviceKey: string; bucket: string; fetchImpl?: typeof fetch }): StorageClient {
  const base = `${options.url.replace(/\/+$/, '')}/storage/v1/object`;
  const doFetch = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${options.serviceKey}`, apikey: options.serviceKey };
  // Errors carry the status only: never the key, never the response body.
  const fail = (what: string, status: number) => new Error(`Supabase Storage ${what} failed with status ${status}`);

  return {
    async list() {
      const out: StoredFile[] = [];
      for (const folder of FOLDERS) {
        for (let offset = 0; ; offset += PAGE) {
          const res = await doFetch(`${base}/list/${encodeURIComponent(options.bucket)}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix: folder, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (!res.ok) throw fail('listing', res.status);
          const items = (await res.json()) as { name?: string; id?: string | null; updated_at?: string; metadata?: { eTag?: string; etag?: string; size?: number } | null }[];
          for (const item of items) {
            // Folders have no id; Supabase also keeps an invisible placeholder file in empty folders.
            if (!item.id || !item.name || item.name.startsWith('.')) continue;
            const etag = item.metadata?.eTag ?? item.metadata?.etag ?? item.updated_at;
            if (!etag) continue;
            out.push({ path: `${folder}/${item.name}`, etag, size: typeof item.metadata?.size === 'number' ? item.metadata.size : null });
          }
          if (items.length < PAGE) break;
        }
      }
      return out;
    },

    async download(path, maxBytes) {
      const url = `${base}/${encodeURIComponent(options.bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await doFetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2) });
      if (!res.ok) throw fail('download', res.status);
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) throw new UploadError('too_large', `The file is larger than ${maxBytes / 1024 / 1024} MB.`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new UploadError('too_large', `The file is larger than ${maxBytes / 1024 / 1024} MB.`);
      return buf;
    },
  };
}

// ---------------------------------------------------------------------------
// One pass
// ---------------------------------------------------------------------------

export interface SyncDeps {
  storage: StorageClient;
  extractor: PricingExtractor;
  getCatalog: () => Promise<CatalogItem[]>;
  /** Whether a model is available for reading pricing files. */
  hasModel: () => boolean;
}

export interface SyncReport {
  skipped?: 'another_instance';
  read: number;
  published: number;
  undone: number;
  failed: number;
}

/** At most this many new files are read per pass, so a pass stays short. */
const MAX_NEW_PER_PASS = 5;
const SYNC_LOCK_ID = 7_301_986_444;
const TRANSIENT_MODEL_FAILURES = new Set(['rate_limited', 'timeout', 'upstream', 'unreachable', 'circuit_open']);

/** What the admin reads in the error column when the model step fails. Provider detail stays in the logs. */
export function extractionFailureMessage(err: unknown): string {
  if (err instanceof LlmError) {
    if (err.kind === 'bad_output') return 'The model could not turn this file into a price list. Try a clearer or shorter version.';
    if (err.kind === 'quota' || err.kind === 'misconfigured') return 'The model account is not working (check the OpenAI key and billing on the server).';
  }
  return 'Reading the file failed. Re-upload it to try again.';
}

export function guidanceProposal(text: string, filename: string): GuidanceProposal | null {
  const preview = chunkGuidance(text, filename, 'preview');
  if (preview.length === 0) return null;
  return {
    kind: 'guidance', total: preview.length, chunks: preview.map((c) => ({ heading: c.heading, content: c.content.slice(0, 400) })),
    // Prices belong in the catalog: a figure typed into guidance text goes out of date the next time prices change.
    warnings: /\$\s?\d/.test(text) ? ['This text contains dollar amounts. Prices are kept in one place, the price catalog, so put them in a file in the pricing folder instead. Amounts written into guidance text can become out of date and contradict the real prices.'] : [],
  };
}

const humanMessage = (err: unknown) => (err instanceof PublishError ? [err.message, ...err.details].join(' ') : 'Something went wrong. See the server logs.');

async function ingestNewFiles(deps: SyncDeps, report: SyncReport): Promise<void> {
  const files = await deps.storage.list();
  let handled = 0;
  for (const file of files) {
    if (handled >= MAX_NEW_PER_PASS) break;
    if (await hasStoredFile(file.path, file.etag)) continue;
    const kind = file.path.startsWith('pricing/') ? 'pricing' : 'guidance';
    const filename = file.path.slice(file.path.indexOf('/') + 1);
    const identity = { storagePath: file.path, storageEtag: file.etag };

    if (kind === 'pricing' && !deps.hasModel()) {
      log.warn('a pricing file is waiting but no OpenAI key is set on the server', { filename });
      continue; // not recorded, so it is read as soon as a key is set
    }
    handled++;

    let text: string; let mime: string; let bytes: number;
    try {
      if (file.size !== null && file.size > MAX_UPLOAD_BYTES) throw new UploadError('too_large', `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
      const buf = await deps.storage.download(file.path, MAX_UPLOAD_BYTES);
      const extracted = await extractFileText(buf, filename);
      text = extracted.text; mime = extracted.mime; bytes = buf.length;
    } catch (err) {
      if (err instanceof UploadError) {
        // A problem with the file itself: tell the admin, once, where they are already looking.
        await createUpload({ kind, filename, mime: 'unknown', bytes: file.size ?? 0, text: '', status: 'failed', error: err.message, ...identity });
        report.failed++;
        metrics.inc('kb_uploads_total', { kind, outcome: 'unreadable' });
      } else {
        log.warn('could not download a knowledge file; will retry', { filename, err }); // a hiccup: try again next pass
      }
      continue;
    }

    if (kind === 'guidance') {
      const proposal = guidanceProposal(text, filename);
      if (!proposal) {
        await createUpload({ kind, filename, mime, bytes, text, status: 'failed', error: 'No usable text was found in that file.', ...identity });
        report.failed++;
        continue;
      }
      await createUpload({ kind, filename, mime, bytes, text, status: 'draft', proposal, ...identity });
      report.read++;
      metrics.inc('kb_uploads_total', { kind, outcome: 'draft' });
      continue;
    }

    const id = await createUpload({ kind, filename, mime, bytes, text, status: 'processing', ...identity });
    const startedAt = Date.now();
    try {
      const current = await deps.getCatalog();
      const proposed = await deps.extractor.extract(text, current);
      if (proposed.length === 0) {
        await failUpload(id, 'No prices were found in that file.');
        report.failed++;
        metrics.inc('kb_uploads_total', { kind, outcome: 'empty' });
        continue;
      }
      const items = verifyProposal(proposed, current, text);
      await setDraft(id, { kind: 'pricing', items });
      report.read++;
      metrics.inc('kb_uploads_total', { kind, outcome: 'draft' });
      metrics.observe('kb_extract_ms', { kind }, Date.now() - startedAt);
      log.info('pricing file read', { items: items.length, rejected: items.filter((i) => i.status === 'rejected').length, ms: Date.now() - startedAt });
    } catch (err) {
      if (err instanceof LlmError && TRANSIENT_MODEL_FAILURES.has(err.kind)) {
        // The model was busy or slow: forget this attempt entirely so the file is read again next pass.
        await discardUpload(id);
        log.warn('the model was unavailable while reading a pricing file; will retry', { filename, kind: err.kind });
      } else {
        log.error('reading a pricing file failed', { filename, err });
        await failUpload(id, extractionFailureMessage(err)).catch(() => {});
        report.failed++;
        metrics.inc('kb_uploads_total', { kind, outcome: 'failed' });
      }
    }
  }
}

async function applyApprovals(report: SyncReport): Promise<void> {
  for (const id of await idsByStatus('approved')) {
    try {
      const { rows } = await pool.query('select kind from kb_uploads where id = $1', [id]);
      if (rows[0]?.kind === 'guidance') {
        const out = await publishGuidance(id, ['approved']);
        log.info('guidance published', { chunks: out.chunks });
      } else {
        const out = await publishPricing(id, await approvableSkus(id), ['approved']);
        log.info('pricing published', { items: out.applied, version: out.version });
      }
      report.published++;
      metrics.inc('kb_uploads_total', { outcome: 'published' });
    } catch (err) {
      // Say why where the admin is looking, and leave the row as failed so it is not retried forever.
      if (!(err instanceof PublishError)) log.error('publishing an approved upload failed', { err });
      await setStatus(id, 'failed', `Not published. ${humanMessage(err)}`).catch(() => {});
      report.failed++;
    }
  }
}

async function applyUndos(report: SyncReport): Promise<void> {
  for (const id of await idsByStatus('undo')) {
    try {
      await revertUpload(id);
      report.undone++;
      metrics.inc('kb_uploads_total', { outcome: 'reverted' });
      log.info('upload undone');
    } catch (err) {
      if (!(err instanceof PublishError)) log.error('undoing an upload failed', { err });
      // It is still published; put it back and say why the undo did not happen.
      await setStatus(id, 'published', `Could not undo. ${humanMessage(err)}`).catch(() => {});
    }
  }
}

/** One pass: read new files, publish what was approved, undo what was asked. Safe with several instances. */
export async function runKnowledgeSyncOnce(deps: SyncDeps): Promise<SyncReport> {
  const report: SyncReport = { read: 0, published: 0, undone: 0, failed: 0 };
  const lock: PoolClient = await pool.connect();
  let broken = false;
  try {
    const { rows } = await lock.query('select pg_try_advisory_lock($1) as ok', [SYNC_LOCK_ID]);
    if (!rows[0].ok) return { ...report, skipped: 'another_instance' };
    try {
      await sweepStale();
      // Decisions first, so an approval is never stuck behind a slow file.
      await applyApprovals(report);
      await applyUndos(report);
      await ingestNewFiles(deps, report);
    } finally {
      await lock.query('select pg_advisory_unlock($1)', [SYNC_LOCK_ID]).catch(() => { broken = true; });
    }
  } finally {
    lock.release(broken);
  }
  return report;
}

/** Runs a pass now and then every `intervalMs`. Returns a function that stops it. */
export function startKnowledgeSync(deps: SyncDeps, intervalMs = config.kbPollSeconds * 1000): () => void {
  let running = false;
  const pass = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runKnowledgeSyncOnce(deps);
      if (r.read || r.published || r.undone || r.failed) log.info('knowledge sync', { ...r });
    } catch (err) {
      log.warn('knowledge sync pass failed', { err });
    } finally {
      running = false;
    }
  };
  const first = setTimeout(pass, 3000);
  const timer = setInterval(pass, intervalMs);
  first.unref();
  timer.unref();
  return () => { clearTimeout(first); clearInterval(timer); };
}
