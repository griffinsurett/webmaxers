// HTTP-level security checks against the real Express app (no database needed): response headers,
// CORS allow-list, operator routes stay closed without the token, and bad bodies fail generically.
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp } from '../app.js';
import { config } from '../config/index.js';

let server: Server;
let base = '';

before(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('responses carry hardening headers and do not advertise Express', async () => {
  const res = await fetch(`${base}/api/admin/metrics`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('CORS rejects unknown origins and never echoes them back', async () => {
  const res = await fetch(`${base}/api/chat/start`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.ok(res.status >= 400 && res.status < 500);
  assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://evil.example');

  const allowed = config.corsOrigins[0];
  const ok = await fetch(`${base}/api/admin/metrics`, { headers: { Origin: allowed } });
  assert.equal(ok.headers.get('access-control-allow-origin'), allowed);
});

test('operator routes refuse missing or wrong tokens', async () => {
  const expected = config.adminToken ? 401 : 404; // routes do not exist without ADMIN_TOKEN
  for (const headers of [{}, { Authorization: 'Bearer wrong-token' }, { Authorization: 'Bearer ' }]) {
    const res = await fetch(`${base}/api/admin/metrics`, { headers });
    assert.equal(res.status, expected);
  }
  const kb = await fetch(`${base}/api/kb/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'pricing' }),
  });
  assert.equal(kb.status, expected);
});

test('malformed and oversized bodies get a generic 4xx with no internals', async () => {
  const bad = await fetch(`${base}/api/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(bad.status, 400);
  const text = await bad.text();
  assert.deepEqual(JSON.parse(text), { error: 'Invalid request.' });
  assert.ok(!/SyntaxError|at \w+|node_modules/.test(text));

  const big = await fetch(`${base}/api/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pad: 'x'.repeat(40_000) }),
  });
  assert.equal(big.status, 413);
});
