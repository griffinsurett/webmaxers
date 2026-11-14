// backend/src/services/rag/index.ts
// Knowledge base: structured pricing catalog + embedded knowledge chunks (pgvector).
//
// - Seed files live in backend/kb/. `demo-pricing.json` becomes catalog rows (the only
//   source of prices) AND text chunks; every `*.md` file is split by `##` section.
// - Retrieval uses pgvector cosine similarity. Without an OpenAI key, chunks are stored
//   un-embedded and search falls back to Postgres full-text ranking, so the KB still works.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from '../../config/index.js';
import { pool, toVectorLiteral } from '../../db/index.js';
import { callLlm } from '../llm/openai.js';
import { log } from '../log/logger.js';
import type { CatalogItem, CatalogKind } from '../../types/index.js';

const KB_DIR = fileURLToPath(new URL('../../../kb/', import.meta.url));
const PRICING_FILE = 'demo-pricing.json';

export interface PricingSeedItem {
  sku: string;
  kind: CatalogKind;
  name: string;
  description?: string;
  price?: number;
  setup?: number;
  monthly?: number;
  included_pages?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}

interface PricingSeed {
  version: string;
  items: PricingSeedItem[];
}

export interface Chunk {
  source: string;
  heading: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface KbSearchResult {
  source: string;
  heading: string;
  content: string;
  similarity: number;
  mode: 'vector' | 'keyword';
}

export interface SyncResult {
  catalogVersion: string;
  catalogItems: number;
  deactivatedItems: number;
  chunks: number;
  embedded: boolean;
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

/** Plain-language text for one catalog item, so pricing is also retrievable via RAG. */
export function describeItem(item: PricingSeedItem): string {
  const parts = [`${item.name} (SKU ${item.sku}, ${item.kind.replace('_', ' ')}).`];
  if (item.kind === 'website_type') {
    parts.push(`Base price ${money(item.price ?? 0)}, includes up to ${item.included_pages} pages.`);
  } else if (item.kind === 'addon') {
    const monthly = item.monthly ? ` + ${money(item.monthly)}/month` : ', no monthly fee';
    parts.push(`Setup ${money(item.setup ?? 0)}${monthly}.`);
  } else {
    parts.push(`Price ${money(item.price ?? 0)} ${item.unit ?? 'each'}.`);
  }
  if (item.description) parts.push(item.description);
  return parts.join(' ');
}

/** Splits a markdown file into one chunk per `##` section, prefixed with the `#` title. */
function chunkMarkdown(source: string, markdown: string): Chunk[] {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? source;
  const sections = markdown.split(/^##\s+/m).slice(1);
  return sections
    .map((section) => {
      const [headingLine, ...body] = section.split('\n');
      const heading = `${title} > ${headingLine.trim()}`;
      return { source, heading, content: body.join('\n').trim(), metadata: { title } };
    })
    .filter((c) => c.content.length > 0);
}

async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const res = await callLlm('embedding', (client, opts) =>
      client.embeddings.create({ model: config.openaiEmbeddingModel, input: texts.slice(i, i + 100) }, opts));
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

export class RagService {
  /**
   * Re-syncs the whole knowledge base from backend/kb/: upserts catalog rows,
   * deactivates SKUs no longer in the seed, and rebuilds all chunks.
   */
  async syncKnowledgeBase(options: { embed?: boolean } = {}): Promise<SyncResult> {
    const seed = JSON.parse(await readFile(path.join(KB_DIR, PRICING_FILE), 'utf8')) as PricingSeed;
    const mdFiles = (await readdir(KB_DIR)).filter((f) => f.endsWith('.md')).sort();

    const chunks: Chunk[] = seed.items.map((item) => ({
      source: PRICING_FILE,
      heading: `Pricing > ${item.name}`,
      content: describeItem(item),
      metadata: { sku: item.sku, kind: item.kind, version: seed.version },
    }));
    for (const file of mdFiles) {
      chunks.push(...chunkMarkdown(file, await readFile(path.join(KB_DIR, file), 'utf8')));
    }

    // Embed before opening the transaction so a slow API call never holds locks.
    const embeddings = config.openaiApiKey && options.embed !== false
      ? await embed(chunks.map((c) => `${c.heading}\n${c.content}`))
      : null;

    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const item of seed.items) {
        await client.query(
          `insert into pricing_catalog
             (sku, kind, name, description, price, setup, monthly, included_pages, unit, active, version, metadata, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11,now())
           on conflict (sku) do update set
             kind = excluded.kind, name = excluded.name, description = excluded.description,
             price = excluded.price, setup = excluded.setup, monthly = excluded.monthly,
             included_pages = excluded.included_pages, unit = excluded.unit, active = true,
             version = excluded.version, metadata = excluded.metadata, updated_at = now()`,
          [
            item.sku, item.kind, item.name, item.description ?? '', item.price ?? 0,
            item.setup ?? 0, item.monthly ?? 0, item.included_pages ?? null,
            item.unit ?? 'each', seed.version, item.metadata ?? {},
          ],
        );
      }
      const deactivated = await client.query(
        `update pricing_catalog set active = false, updated_at = now()
         where active and not (sku = any($1::text[]))`,
        [seed.items.map((i) => i.sku)],
      );

      // Uploaded guidance (source "upload:<id>") belongs to the admin, not to the seed files.
      await client.query("delete from kb_chunks where source not like 'upload:%'");
      for (const [i, c] of chunks.entries()) {
        await client.query(
          `insert into kb_chunks (source, heading, content, metadata, embedding)
           values ($1,$2,$3,$4,$5::vector)`,
          [c.source, c.heading, c.content, c.metadata, embeddings ? toVectorLiteral(embeddings[i]) : null],
        );
      }
      await client.query('commit');

      return {
        catalogVersion: seed.version,
        catalogItems: seed.items.length,
        deactivatedItems: deactivated.rowCount ?? 0,
        chunks: chunks.length,
        embedded: Boolean(embeddings),
      };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Active catalog rows, the authoritative source for every price. */
  async getCatalog(): Promise<CatalogItem[]> {
    const { rows } = await pool.query(
      `select sku, kind, name, description, price, setup, monthly,
              included_pages as "includedPages", unit, version, metadata
       from pricing_catalog where active
       order by case kind when 'website_type' then 0 when 'page' then 1 when 'content' then 2 else 3 end, price, setup, sku`,
    );
    return rows as CatalogItem[];
  }

  /** Top-k knowledge chunks for a query (vector search, or keyword fallback). */
  async searchKnowledgeBase(query: string, matchCount = 5): Promise<KbSearchResult[]> {
    const { rows: [{ n }] } = await pool.query(
      'select count(*)::int as n from kb_chunks where embedding is not null',
    );

    if (config.openaiApiKey && n > 0) {
      try {
        const [vector] = await embed([query]);
        const { rows } = await pool.query(
          'select source, heading, content, similarity from match_kb_chunks($1::vector, $2)',
          [toVectorLiteral(vector), matchCount],
        );
        return rows.map((r) => ({ ...r, mode: 'vector' as const }));
      } catch (err) {
        // Embeddings are slow, rate-limited or down: keyword search still finds relevant chunks.
        log.warn('embedding search failed; using keyword search', { err });
      }
    }

    // OR-match the query's stemmed terms so natural questions still find relevant chunks.
    const { rows } = await pool.query(
      `with q as (
         select nullif(replace(plainto_tsquery('english', $1)::text, '&', '|'), '')::tsquery as query
       )
       select source, heading, content,
              ts_rank(to_tsvector('english', heading || ' ' || content), q.query) as similarity
       from kb_chunks, q
       where q.query is not null
         and to_tsvector('english', heading || ' ' || content) @@ q.query
       order by similarity desc
       limit $2`,
      [query, matchCount],
    );
    return rows.map((r) => ({ ...r, mode: 'keyword' as const }));
  }
}

export const ragService = new RagService();

/** Embeds texts, or returns null when that is not possible (no key, provider down): chunks are then stored for keyword search. */
export async function tryEmbed(texts: string[]): Promise<number[][] | null> {
  if (!config.openaiApiKey || texts.length === 0) return null;
  try {
    return await embed(texts);
  } catch (err) {
    log.warn('embedding failed; storing chunks for keyword search only', { err });
    return null;
  }
}

/** Adds chunks to the knowledge base (embedded when possible). Returns how many were stored. */
export async function insertChunks(chunks: Chunk[]): Promise<{ stored: number; embedded: boolean }> {
  if (chunks.length === 0) return { stored: 0, embedded: false };
  const vectors = await tryEmbed(chunks.map((c) => `${c.heading}\n${c.content}`));
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const [i, c] of chunks.entries()) {
      await client.query(
        `insert into kb_chunks (source, heading, content, metadata, embedding) values ($1,$2,$3,$4,$5::vector)`,
        [c.source, c.heading, c.content, c.metadata, vectors ? toVectorLiteral(vectors[i]) : null],
      );
    }
    await client.query('commit');
    return { stored: chunks.length, embedded: Boolean(vectors) };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export const deleteChunksBySource = async (source: string): Promise<number> =>
  (await pool.query('delete from kb_chunks where source = $1', [source])).rowCount ?? 0;

/** Removes the text chunk that describes one catalog item (so a changed price is not searchable at its old value). */
export const deleteChunksBySku = async (skus: string[]): Promise<number> =>
  (await pool.query(`delete from kb_chunks where metadata->>'sku' = any($1::text[])`, [skus])).rowCount ?? 0;

const SEED_LOCK_ID = 7_301_986_443;

/**
 * Makes a brand-new database usable: loads the price catalog and knowledge base the first time
 * the service starts. Does nothing once a catalog exists, so later deploys never overwrite edits
 * made through the admin sync. Safe with several instances starting at once (advisory lock).
 * If embedding fails (no key, provider down) the catalog is still loaded and search runs on
 * keywords until an admin sync adds embeddings.
 */
export async function seedKnowledgeBaseIfEmpty(): Promise<'already_seeded' | 'seeded' | 'seeded_without_embeddings'> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('select pg_advisory_lock($1)', [SEED_LOCK_ID]);
    try {
      const { rows: [{ n }] } = await client.query('select count(*)::int as n from pricing_catalog where active');
      if (n > 0) return 'already_seeded';
      try {
        await ragService.syncKnowledgeBase();
        return 'seeded';
      } catch (err) {
        log.warn('knowledge base embedding failed; loading it without embeddings', { err });
        await ragService.syncKnowledgeBase({ embed: false });
        return 'seeded_without_embeddings';
      }
    } finally {
      await client.query('select pg_advisory_unlock($1)', [SEED_LOCK_ID]).catch(() => { broken = true; });
    }
  } finally {
    client.release(broken); // a connection that may still hold the lock is destroyed, never reused
  }
}
