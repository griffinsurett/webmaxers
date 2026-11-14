// backend/src/db/index.ts
// Shared Postgres pool for the pgvector knowledge base and sessions.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../config/index.js';
import { log } from '../services/log/logger.js';

// numeric columns come back as strings by default; prices are small, so parse to number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));

/** Maps DATABASE_SSL to the pg driver's option. Hosted databases (Supabase and others) require TLS. */
export function sslOption(mode: string): pg.PoolConfig['ssl'] {
  if (mode === 'require') return { rejectUnauthorized: true };
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  return undefined; // disable: whatever the connection string itself says
}

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10, ssl: sslOption(config.databaseSsl) });

// When Postgres restarts or the network drops, a connection emits "error". With no listener Node
// treats that as fatal and kills the whole process, including every in-flight research and
// blueprint job. The pool discards a broken connection and opens a new one on demand, so all that
// is needed is to note it. Two cases need a listener:
//  - idle connections: the pool re-emits their errors on `pool`;
//  - connections currently checked out (e.g. a per-session lock held while a model call runs):
//    the pool does not watch those, so every connection gets its own listener when it is created.
pool.on('error', (err) => log.warn('idle database connection failed; the pool will replace it', { err }));
pool.on('connect', (client) => {
  client.on('error', (err) => log.debug('database connection error', { err }));
});

const SCHEMA_PATH = fileURLToPath(new URL('../../db/schema.sql', import.meta.url));

// Arbitrary constant; every instance takes the same lock so concurrent starts apply the schema one at a time.
const MIGRATION_LOCK_ID = 7_301_986_442;

/**
 * Applies db/schema.sql (idempotent). Safe to call from several instances at once: they queue on a
 * Postgres advisory lock instead of racing on `create ... if not exists`.
 */
export async function migrate(): Promise<void> {
  const sql = await readFile(SCHEMA_PATH, 'utf8');
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await client.query(sql);
    } finally {
      try {
        await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
      } catch {
        broken = true; // lock state unknown: drop the connection, which releases the lock
      }
    }
  } finally {
    client.release(broken);
  }
}

/** True when the database answers a trivial query within `timeoutMs`. Never throws. */
export async function pingDatabase(timeoutMs = 2000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const query = pool.query('select 1').then(() => true);
    query.catch(() => {}); // a late failure after the timeout must not become an unhandled rejection
    const timeout = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
    return await Promise.race([query, timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Formats a JS number array as a pgvector literal for `$n::vector` parameters. */
export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
