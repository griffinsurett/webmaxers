// Burst throttling and migrations against the real Postgres (skipped when it is not reachable).
// Start it with: npm run db:up
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test, type TestContext } from 'node:test';
import { migrate, pingDatabase, pool } from '../../db/index.js';
import { evaluate, postgresStore, type Policy } from './limiter.js';

let up = false;
before(async () => {
  up = await pingDatabase(1500);
  if (up) await migrate();
});
after(async () => {
  if (up) await pool.query(`delete from rate_limits where key like 'test-%'`);
  await pool.end();
});

const policy = (name: string): Policy => ({ name, rules: [{ windowSeconds: 10, limit: 3 }, { windowSeconds: 60, limit: 5 }] });
/** Registers a test that skips itself at run time when the database is not reachable. */
function dbTest(name: string, fn: () => Promise<void>) {
  test(name, async (t: TestContext) => {
    if (!up) return t.skip('database not running (npm run db:up)');
    await fn();
  });
}

dbTest('migrate is safe to run concurrently (advisory lock) and repeatedly', async () => {
  await Promise.all([migrate(), migrate(), migrate(), migrate()]);
  await migrate();
  const { rows } = await pool.query(`select to_regclass('public.rate_limits') as t`);
  assert.ok(rows[0].t);
});

dbTest('counts accumulate per window and the limit is enforced exactly', async () => {
  const key = `test-${randomUUID()}`;
  const p = policy('t-count');
  const at = new Date('2030-01-01T00:00:01.000Z'); // 1s into a window: 9s left in the 10s window
  const allowed: boolean[] = [];
  let last;
  for (let i = 0; i < 5; i++) {
    last = await postgresStore.hit(p, key, at);
    allowed.push(evaluate(p, last) === null);
  }
  assert.deepEqual(allowed, [true, true, true, false, false]);
  assert.deepEqual(evaluate(p, last!), { retryAfter: 9 });
});

dbTest('a new window starts from zero; other clients are unaffected', async () => {
  const key = `test-${randomUUID()}`;
  const other = `test-${randomUUID()}`;
  const p = policy('t-window');
  const t0 = new Date('2030-01-01T00:00:01.000Z');
  for (let i = 0; i < 4; i++) await postgresStore.hit(p, key, t0);
  assert.notEqual(evaluate(p, await postgresStore.hit(p, key, t0)), null);
  // 10s window rolled over; the 60s window (5 per minute) still has the earlier hits.
  const t1 = new Date('2030-01-01T00:00:11.000Z');
  const next = await postgresStore.hit(p, key, t1);
  assert.equal(next.find((r) => r.bucket === 't-window:10s')!.count, 1);
  assert.equal(next.find((r) => r.bucket === 't-window:60s')!.count, 6);
  assert.deepEqual(evaluate(p, next), { retryAfter: 49 }); // minute limit still exceeded
  // After the minute rolls over everything is allowed again.
  assert.equal(evaluate(p, await postgresStore.hit(p, key, new Date('2030-01-01T00:01:01.000Z'))), null);
  assert.equal(evaluate(p, await postgresStore.hit(p, other, t0)), null);
});

dbTest('limits survive a restart: the counters are in the database, not in memory', async () => {
  const key = `test-${randomUUID()}`;
  const p = policy('t-restart');
  const at = new Date('2030-01-01T00:00:01.000Z');
  for (let i = 0; i < 3; i++) await postgresStore.hit(p, key, at);
  // Simulate a restart: drop every pooled connection, then keep counting through fresh ones.
  const clients = await Promise.all(Array.from({ length: 10 }, () => pool.connect()));
  await Promise.all(clients.map((c) => c.query('select pg_terminate_backend(pg_backend_pid())').catch(() => {})));
  clients.forEach((c) => c.release(true));
  const after = await postgresStore.hit(p, key, at);
  assert.equal(after.find((r) => r.bucket === 't-restart:10s')!.count, 4);
  assert.notEqual(evaluate(p, after), null);
});

dbTest('parallel requests cannot slip past the limit', async () => {
  const key = `test-${randomUUID()}`;
  const p: Policy = { name: 't-race', rules: [{ windowSeconds: 10, limit: 20 }] };
  const at = new Date('2030-01-01T00:00:01.000Z');
  const results = await Promise.all(Array.from({ length: 60 }, () => postgresStore.hit(p, key, at)));
  const allowed = results.filter((r) => evaluate(p, r) === null).length;
  assert.equal(allowed, 20);
});

dbTest('purge removes only counters whose window ended', async () => {
  const old = `test-${randomUUID()}`;
  const fresh = `test-${randomUUID()}`;
  const p = policy('t-purge');
  await postgresStore.hit(p, old, new Date('2020-01-01T00:00:01.000Z'));
  await postgresStore.hit(p, fresh); // real clock
  await postgresStore.purge();
  const { rows } = await pool.query(`select key from rate_limits where key = any($1)`, [[old, fresh]]);
  assert.deepEqual([...new Set(rows.map((r) => r.key))], [fresh]); // one row per window for the fresh key
});

dbTest('the process survives the database dropping an idle connection (the pool replaces it)', async () => {
  // Park one connection idle in the pool, then kill it from a different connection, as a database
  // restart or network blip would. (Killing it through the pool could pick the same connection.)
  const victim = await pool.connect();
  const killer = await pool.connect();
  const { rows: [{ pid }] } = await victim.query('select pg_backend_pid() as pid');
  victim.release();
  await killer.query('select pg_terminate_backend($1)', [pid]);
  killer.release();
  await new Promise((r) => setTimeout(r, 200)); // the "error" event arrives here; unhandled it would crash the run
  assert.equal((await pool.query('select 1 as ok')).rows[0].ok, 1, 'the pool recovered');
});

dbTest('the process survives the database dropping a connection that is checked out (e.g. a session lock held during a model call)', async () => {
  const held = await pool.connect(); // stays checked out and idle between queries, like withSessionLock
  const killer = await pool.connect();
  const { rows: [{ pid }] } = await held.query('select pg_backend_pid() as pid');
  await killer.query('select pg_terminate_backend($1)', [pid]);
  killer.release();
  await new Promise((r) => setTimeout(r, 200)); // the "error" event arrives here; unhandled it would crash the run
  held.release(true); // a broken connection is discarded, never reused
  assert.equal((await pool.query('select 1 as ok')).rows[0].ok, 1, 'the pool recovered');
});

test('DATABASE_SSL maps to the driver option (hosted databases need TLS; local Docker does not)', async () => {
  const { sslOption } = await import('../../db/index.js');
  assert.equal(sslOption('disable'), undefined);
  assert.deepEqual(sslOption('require'), { rejectUnauthorized: true });
  assert.deepEqual(sslOption('no-verify'), { rejectUnauthorized: false });
});
