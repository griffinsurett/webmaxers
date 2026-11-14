// safeFetch policy tests against a virtual web (injected request + resolver). No network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PoliteFetcher } from './fetcher.js';
import { safeFetch, type RawRequest } from './safeFetch.js';

type Page = { status?: number; location?: string; body?: string; type?: string };
function virtualWeb(pages: Record<string, Page>, dns: Record<string, string[] | (() => string[])>) {
  const seen: { url: string; address: string }[] = [];
  const request: RawRequest = async (url, address) => {
    seen.push({ url: `${url.protocol}//${url.hostname}${url.pathname}`, address });
    const p = pages[`${url.protocol}//${url.hostname}${url.pathname}`] ?? { status: 404 };
    return { status: p.status ?? 200, contentType: p.type ?? 'text/html', location: p.location, body: Buffer.from(p.body ?? '') };
  };
  const resolver = async (h: string) => {
    const r = dns[h];
    if (!r) throw new Error('NXDOMAIN');
    return typeof r === 'function' ? r() : r;
  };
  return { request, resolver, seen };
}
const PUBLIC = ['93.184.216.34'];

test('fetches a page and pins the socket to the validated address', async () => {
  const w = virtualWeb({ 'https://acme.com/': { body: '<h1>Hi</h1>' } }, { 'acme.com': PUBLIC });
  const r = await safeFetch('acme.com', 'html', w);
  assert.equal(r.ok && r.body, '<h1>Hi</h1>');
  assert.equal(w.seen[0].address, '93.184.216.34');
});

test('follows same-site redirects (http→https, www) but not cross-domain ones', async () => {
  const w = virtualWeb({
    'http://acme.com/': { status: 301, location: 'https://www.acme.com/' },
    'https://www.acme.com/': { body: 'ok' },
    'https://evil.com/': { body: 'bad' },
    'https://acme.com/go': { status: 302, location: 'https://evil.com/' },
  }, { 'acme.com': PUBLIC, 'www.acme.com': PUBLIC, 'evil.com': PUBLIC });
  const ok = await safeFetch('http://acme.com', 'html', w);
  assert.equal(ok.ok && ok.redirects, 1);
  assert.deepEqual(await safeFetch('https://acme.com/go', 'html', w), { ok: false, reason: 'cross_domain_redirect' });
});

test('redirects to internal addresses, other schemes and IPs are blocked', async () => {
  for (const location of ['http://127.0.0.1/admin', 'http://169.254.169.254/', 'file:///etc/passwd', 'javascript:alert(1)']) {
    const w = virtualWeb({ 'https://acme.com/': { status: 302, location } }, { 'acme.com': PUBLIC });
    const r = await safeFetch('acme.com', 'html', w);
    assert.equal(r.ok, false, location);
    assert.equal(w.seen.length, 1, 'the internal target was never requested');
  }
});

test('DNS rebinding: a host that turns private on a later lookup is blocked before connecting', async () => {
  let calls = 0;
  const w = virtualWeb(
    { 'https://acme.com/': { status: 302, location: '/two' }, 'https://acme.com/two': { body: 'secret' } },
    { 'acme.com': () => (++calls === 1 ? PUBLIC : ['10.0.0.7']) },
  );
  assert.deepEqual(await safeFetch('acme.com', 'html', w), { ok: false, reason: 'non_public_address' });
  assert.equal(w.seen.length, 1);
});

test('host resolving to any private address is refused without a request', async () => {
  const w = virtualWeb({}, { 'evil.com': ['93.184.216.34', '192.168.0.4'] });
  assert.deepEqual(await safeFetch('evil.com', 'html', w), { ok: false, reason: 'non_public_address' });
  assert.equal(w.seen.length, 0);
});

test('caps redirects, reports http errors, rejects unsafe start URLs', async () => {
  const loop = virtualWeb({ 'https://acme.com/': { status: 302, location: '/' } }, { 'acme.com': PUBLIC });
  assert.deepEqual(await safeFetch('acme.com', 'html', loop), { ok: false, reason: 'too_many_redirects' });
  const gone = virtualWeb({ 'https://acme.com/': { status: 503 } }, { 'acme.com': PUBLIC });
  assert.deepEqual(await safeFetch('acme.com', 'html', gone), { ok: false, reason: 'http_error', status: 503 });
  assert.deepEqual(await safeFetch('http://localhost', 'html', gone), { ok: false, reason: 'internal_host' });
  assert.deepEqual(await safeFetch('http://10.0.0.1', 'html', gone), { ok: false, reason: 'ip_literal' });
});

test('PoliteFetcher obeys robots.txt and the per-job fetch budget', async () => {
  const w = virtualWeb({
    'https://acme.com/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /private' },
    'https://acme.com/': { body: 'home' },
    'https://acme.com/private/a': { body: 'secret' },
  }, { 'acme.com': PUBLIC });
  const f = new PoliteFetcher(w, 4); // robots.txt and every page hop each cost one fetch
  assert.equal((await f.fetchHtml('https://acme.com/')).ok, true);
  assert.deepEqual(await f.fetchHtml('https://acme.com/private/a'), { ok: false, reason: 'robots_disallowed' });
  assert.equal(w.seen.some((s) => s.url.endsWith('/private/a')), false);
  assert.equal((await f.fetchHtml('https://acme.com/')).ok, true);
  assert.deepEqual(await f.fetchHtml('https://acme.com/'), { ok: false, reason: 'budget_exceeded' });
});

test('crawl-delay is honored even when fetches run concurrently', async () => {
  const times: number[] = [];
  const request: RawRequest = async (url) => {
    if (url.pathname === '/robots.txt') return { status: 200, contentType: 'text/plain', body: Buffer.from('User-agent: *\nCrawl-delay: 0.2') };
    times.push(Date.now());
    return { status: 200, contentType: 'text/html', body: Buffer.from('ok') };
  };
  const f = new PoliteFetcher({ request, resolver: async () => PUBLIC });
  await Promise.all(['/a', '/b', '/c'].map((p) => f.fetchHtml(`https://acme.com${p}`)));
  assert.equal(times.length, 3);
  assert.ok(times[1] - times[0] >= 180 && times[2] - times[1] >= 180, `gaps: ${times[1] - times[0]}, ${times[2] - times[1]}`);
});

test('robots.txt is enforced on redirect targets, including a different host (www)', async () => {
  const requested: string[] = [];
  const request: RawRequest = async (url) => {
    requested.push(`${url.hostname}${url.pathname}`);
    const text = (body: string) => ({ status: 200, contentType: 'text/plain', body: Buffer.from(body) });
    if (url.hostname === 'acme.com' && url.pathname === '/robots.txt') return text('User-agent: *\nDisallow: /private');
    if (url.hostname === 'www.acme.com' && url.pathname === '/robots.txt') return text('User-agent: *\nDisallow: /');
    if (url.pathname === '/robots.txt') return { status: 404, contentType: 'text/plain', body: Buffer.alloc(0) };
    if (url.hostname === 'acme.com' && url.pathname === '/allowed') return { status: 302, contentType: 'text/html', location: '/private/data', body: Buffer.alloc(0) };
    if (url.hostname === 'acme.com' && url.pathname === '/') return { status: 301, contentType: 'text/html', location: 'https://www.acme.com/', body: Buffer.alloc(0) };
    return { status: 200, contentType: 'text/html', body: Buffer.from('secret') };
  };
  const f = new PoliteFetcher({ request, resolver: async () => PUBLIC });
  assert.deepEqual(await f.fetchHtml('https://acme.com/allowed'), { ok: false, reason: 'robots_disallowed' });
  assert.deepEqual(await f.fetchHtml('https://acme.com/'), { ok: false, reason: 'robots_disallowed' });
  assert.ok(!requested.includes('acme.com/private/data'));
  assert.ok(!requested.includes('www.acme.com/'), 'the www host disallows everything and was never fetched');
});

test('the fetch budget counts redirect hops and robots files, and cannot be overshot concurrently', async () => {
  let real = 0;
  const request: RawRequest = async () => { real++; return { status: 200, contentType: 'text/html', body: Buffer.from('ok') }; };
  const f = new PoliteFetcher({ request, resolver: async () => PUBLIC }, 5);
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => f.fetchHtml(`https://acme.com/p${i}`)));
  assert.ok(real <= 5, `real requests: ${real}`);
  assert.ok(results.filter((r) => !r.ok && r.reason === 'budget_exceeded').length >= 5);
});

test('hostile deeply nested pages are refused before parsing', async () => {
  const deep = `<html><body>${'<div>'.repeat(5000)}x</body></html>`;
  const request: RawRequest = async (url) => url.pathname === '/robots.txt'
    ? { status: 404, contentType: 'text/plain', body: Buffer.alloc(0) }
    : { status: 200, contentType: 'text/html', body: Buffer.from(deep) };
  const f = new PoliteFetcher({ request, resolver: async () => PUBLIC });
  assert.deepEqual(await f.fetchHtml('https://acme.com/'), { ok: false, reason: 'too_complex' });
});
