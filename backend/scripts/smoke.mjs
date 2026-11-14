#!/usr/bin/env node
// Post-deploy smoke test. Read-only and free: it never starts a conversation, never calls the
// model, never writes anything. Run it after every deploy, and from the launch rehearsal.
//
//   npm run smoke -- https://api.example.com https://webmaxxers.com
//                    ^ backend URL             ^ the site origin that must be allowed (optional)
//
// Exit code 0 = every check passed.

const [rawBase, siteOrigin] = process.argv.slice(2);
if (!rawBase || !/^https?:\/\//.test(rawBase)) {
  console.error('Usage: npm run smoke -- <backend-url> [site-origin]');
  process.exit(2);
}
const base = rawBase.replace(/\/+$/, '');

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
};
const get = (path, init = {}) => fetch(base + path, { ...init, signal: AbortSignal.timeout(10_000) });
const expect = (cond, message) => { if (!cond) throw new Error(message); };

await check('health: service up and database reachable', async () => {
  const r = await get('/health');
  const body = await r.json().catch(() => ({}));
  expect(r.status === 200, `status ${r.status} (${JSON.stringify(body)})`);
  expect(body.status === 'ok' && body.database === 'up', `unexpected body ${JSON.stringify(body)}`);
  expect(r.headers.get('x-request-id'), 'no X-Request-Id header');
  return `status ok, request id ${r.headers.get('x-request-id')}`;
});

await check('catalog: prices are loaded (first start seeded the database)', async () => {
  const r = await get('/api/catalog');
  expect(r.status === 200, `status ${r.status}`);
  const body = await r.json();
  const items = Array.isArray(body) ? body : body.items;
  expect(Array.isArray(items) && items.length > 0, 'the catalog is empty');
  return `${items.length} catalog items`;
});

if (siteOrigin) {
  await check(`CORS: ${siteOrigin} may call the API (and read Retry-After)`, async () => {
    const r = await get('/api/chat/start', {
      method: 'OPTIONS',
      headers: { Origin: siteOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(r.status === 204 || r.status === 200, `preflight status ${r.status}`);
    expect(r.headers.get('access-control-allow-origin') === siteOrigin, `allow-origin was "${r.headers.get('access-control-allow-origin')}": add ${siteOrigin} to CORS_ORIGINS`);
    const health = await get('/health', { headers: { Origin: siteOrigin } });
    expect(/retry-after/i.test(health.headers.get('access-control-expose-headers') ?? ''), 'Retry-After is not exposed to the browser');
    return 'preflight allowed';
  });

  await check('CORS: an unknown origin is refused', async () => {
    const r = await get('/api/catalog', { headers: { Origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin') === null, 'an unknown origin was allowed');
    return 'refused';
  });
}

await check('admin routes are not open to the public', async () => {
  const r = await get('/api/admin/metrics');
  expect(r.status === 401 || r.status === 404, `status ${r.status}: admin metrics are reachable without a token`);
  return `status ${r.status}`;
});

await check('transport: https in production, no server banner', async () => {
  const r = await get('/health');
  expect(!r.headers.get('x-powered-by'), 'X-Powered-By is exposed');
  const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(base);
  expect(local || base.startsWith('https://'), 'the backend is not served over https');
  return local ? 'local address' : 'https';
});

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.detail}`);
}
console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
