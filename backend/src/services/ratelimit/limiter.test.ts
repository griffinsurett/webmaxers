// Burst throttling: key normalisation, decision logic and the HTTP behaviour (no database needed).
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { createHealthRouter } from '../../routes/health.js';
import {
  POLICIES, RATE_LIMITED_MESSAGE, clientKey, evaluate, rateLimit,
  type HitResult, type Policy, type RateLimitStore,
} from './limiter.js';

test('clientKey: IPv4 stays, IPv4-mapped IPv6 collapses, IPv6 is reduced to its /64', () => {
  assert.equal(clientKey('203.0.113.7'), '203.0.113.7');
  assert.equal(clientKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(clientKey('2001:db8:abcd:12:aaaa:bbbb:cccc:dddd'), '2001:db8:abcd:12::/64');
  // Different interface ids inside one /64 are the same visitor.
  assert.equal(clientKey('2001:db8:abcd:12::1'), clientKey('2001:DB8:ABCD:0012:ffff:ffff:ffff:ffff'));
  // Compressed forms expand correctly, and a different /64 is a different key.
  assert.equal(clientKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.notEqual(clientKey('2001:db8:0:1::1'), clientKey('2001:db8:0:2::1'));
  assert.equal(clientKey('fe80::1%en0'), 'fe80:0:0:0::/64');
  assert.equal(clientKey('::1'), '0:0:0:0::/64');
  assert.equal(clientKey(undefined), 'unknown');
  assert.equal(clientKey('not an ip'), 'unknown');
});

const policy: Policy = { name: 'p', rules: [{ windowSeconds: 10, limit: 3 }, { windowSeconds: 60, limit: 5 }] };
const hit = (bucket: string, count: number, retryAfter: number): HitResult => ({ bucket, count, retryAfter });

test('evaluate: allows at the limit, blocks above it, and waits for the longest exceeded window', () => {
  assert.equal(evaluate(policy, [hit('p:10s', 3, 4), hit('p:60s', 3, 40)]), null);
  assert.deepEqual(evaluate(policy, [hit('p:10s', 4, 3.2), hit('p:60s', 4, 40)]), { retryAfter: 4 });
  assert.deepEqual(evaluate(policy, [hit('p:10s', 2, 3), hit('p:60s', 6, 41.5)]), { retryAfter: 42 });
  assert.deepEqual(evaluate(policy, [hit('p:10s', 9, 8), hit('p:60s', 9, 41)]), { retryAfter: 41 });
  assert.deepEqual(evaluate(policy, [hit('p:10s', 4, 0.01), hit('p:60s', 1, 50)]), { retryAfter: 1 });
});

test('every policy has sane rules: a longer window never allows fewer requests than a shorter one', () => {
  for (const p of Object.values(POLICIES)) {
    const rules = [...p.rules].sort((a, b) => a.windowSeconds - b.windowSeconds);
    for (let i = 1; i < rules.length; i++) assert.ok(rules[i].limit >= rules[i - 1].limit, p.name);
    for (const r of rules) assert.ok(r.limit > 0 && r.windowSeconds > 0, p.name);
  }
});

/** In-memory store with the same counting contract as the Postgres one (one fixed window). */
function memoryStore() {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const store: RateLimitStore = {
    async hit(p, key) {
      keys.push(key);
      return p.rules.map((r) => {
        const id = `${p.name}:${r.windowSeconds}s|${key}`;
        const count = (counts.get(id) ?? 0) + 1;
        counts.set(id, count);
        return { bucket: `${p.name}:${r.windowSeconds}s`, count, retryAfter: 7.2 };
      });
    },
    async purge() { return 0; },
  };
  return { store, keys };
}

async function serve(app: express.Express) {
  const server = await new Promise<import('node:http').Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test('middleware: requests over the limit get a retryable 429 with Retry-After; others pass', async () => {
  const { store, keys } = memoryStore();
  const app = express();
  app.post('/x', rateLimit({ name: 'x', rules: [{ windowSeconds: 10, limit: 2 }] }, { store, enabled: true }), (_req, res) => void res.json({ ok: true }));
  const s = await serve(app);
  try {
    const statuses: number[] = [];
    let blocked: Response | undefined;
    for (let i = 0; i < 4; i++) {
      const r = await fetch(`${s.base}/x`, { method: 'POST' });
      statuses.push(r.status);
      if (r.status === 429) blocked = r;
    }
    assert.deepEqual(statuses, [200, 200, 429, 429]);
    assert.equal(blocked!.headers.get('retry-after'), '8');
    assert.deepEqual(await blocked!.json(), { error: RATE_LIMITED_MESSAGE, code: 'rate_limited' });
    assert.ok(keys.every((k) => k === '127.0.0.1'));
  } finally { await s.close(); }
});

test('middleware: different clients are counted separately', async () => {
  const { store } = memoryStore();
  const app = express();
  app.set('trust proxy', 1);
  app.get('/x', rateLimit({ name: 'x', rules: [{ windowSeconds: 10, limit: 1 }] }, { store, enabled: true }), (_req, res) => void res.json({ ok: true }));
  const s = await serve(app);
  try {
    const call = (ip: string) => fetch(`${s.base}/x`, { headers: { 'X-Forwarded-For': ip } }).then((r) => r.status);
    assert.equal(await call('198.51.100.1'), 200);
    assert.equal(await call('198.51.100.1'), 429);
    assert.equal(await call('198.51.100.2'), 200);
  } finally { await s.close(); }
});

test('middleware: a failing store lets the request through and reports the error', async () => {
  const errors: unknown[] = [];
  const store: RateLimitStore = { async hit() { throw new Error('db down'); }, async purge() { return 0; } };
  const app = express();
  app.get('/x', rateLimit(POLICIES.chat, { store, enabled: true, onError: (e) => errors.push(e) }), (_req, res) => void res.json({ ok: true }));
  const s = await serve(app);
  try {
    assert.equal((await fetch(`${s.base}/x`)).status, 200);
    assert.equal(errors.length, 1);
  } finally { await s.close(); }
});

test('middleware: when disabled the store is never touched', async () => {
  let calls = 0;
  const store: RateLimitStore = { async hit() { calls++; return []; }, async purge() { return 0; } };
  const app = express();
  app.get('/x', rateLimit(POLICIES.chat, { store, enabled: false }), (_req, res) => void res.json({ ok: true }));
  const s = await serve(app);
  try {
    assert.equal((await fetch(`${s.base}/x`)).status, 200);
    assert.equal(calls, 0);
  } finally { await s.close(); }
});

test('health: a draining instance reports 503 without touching the database', async () => {
  let pinged = false;
  const app = express();
  app.use(createHealthRouter(async () => { pinged = true; return true; }, () => true));
  const s = await serve(app);
  try {
    const r = await fetch(`${s.base}/health`);
    assert.equal(r.status, 503);
    assert.equal((await r.json() as { status: string }).status, 'shutting_down');
    assert.equal(pinged, false);
  } finally { await s.close(); }
});

test('health: 200 when the database answers, 503 when it does not (never throws)', async () => {
  for (const [ok, status, body] of [[true, 200, 'ok'], [false, 503, 'degraded']] as const) {
    const app = express();
    app.use(createHealthRouter(async () => ok));
    const s = await serve(app);
    try {
      const r = await fetch(`${s.base}/health`);
      assert.equal(r.status, status);
      const json = await r.json() as { status: string; database: string };
      assert.equal(json.status, body);
      assert.equal(json.database, ok ? 'up' : 'down');
    } finally { await s.close(); }
  }
});
