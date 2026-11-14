import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowed, parseRobots, loadRobots } from './robots.js';
import type { RawRequest } from './safeFetch.js';

const txt = `
User-agent: *
Disallow: /admin/
Disallow: /*.pdf$
Allow: /admin/public
Crawl-delay: 2

User-agent: WebmaxxersBot
Disallow: /private
Crawl-delay: 99
`;

test('prefers the group naming our bot over *', () => {
  const r = parseRobots(txt);
  assert.equal(isAllowed(r, '/private/x'), false);
  assert.equal(isAllowed(r, '/admin/x'), true); // * group does not apply to us
  assert.equal(r.crawlDelay, 5); // capped
});

test('wildcard group: longest match wins, Allow wins ties, $ and * work', () => {
  const r = parseRobots(txt.split('User-agent: WebmaxxersBot')[0]);
  assert.equal(isAllowed(r, '/admin/secret'), false);
  assert.equal(isAllowed(r, '/admin/public/page'), true);
  assert.equal(isAllowed(r, '/files/menu.pdf'), false);
  assert.equal(isAllowed(r, '/files/menu.pdfx'), true);
  assert.equal(isAllowed(r, '/services'), true);
  assert.equal(isAllowed(r, '/robots.txt'), true);
  assert.equal(r.crawlDelay, 2);
});

test('empty Disallow allows all; blockAll blocks all; junk is ignored', () => {
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), '/x'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /'), '/x'), false);
  assert.equal(isAllowed(parseRobots('<html>not robots</html>\n\u0000'), '/x'), true);
  assert.equal(isAllowed({ rules: [], crawlDelay: 0, blockAll: true }, '/x'), false);
});

const web = (status: number, body = ''): RawRequest => async () => ({
  status, contentType: 'text/plain', body: Buffer.from(body),
});
const deps = (req: RawRequest) => ({ request: req, resolver: async () => ['93.184.216.34'] });

test('missing robots.txt allows; server error or fetch failure blocks (conservative)', async () => {
  assert.equal((await loadRobots('https://a.com', deps(web(404)))).blockAll, false);
  assert.equal((await loadRobots('https://a.com', deps(web(500)))).blockAll, true);
  const failing: RawRequest = async () => { throw new Error('boom'); };
  assert.equal((await loadRobots('https://a.com', deps(failing))).blockAll, true);
  const r = await loadRobots('https://a.com', deps(web(200, 'User-agent: *\nDisallow: /nope')));
  assert.equal(isAllowed(r, '/nope'), false);
});

test('an empty User-agent value never matches our bot', () => {
  const r = parseRobots('User-agent:\nDisallow: /secret\n\nUser-agent: *\nDisallow: /other');
  assert.equal(isAllowed(r, '/secret'), true);
  assert.equal(isAllowed(r, '/other'), false);
});

test('hostile wildcard patterns cannot freeze the matcher (ReDoS regression)', () => {
  const evil = `User-agent: *\nDisallow: /${'a*'.repeat(40)}b\nDisallow: /${'*'.repeat(500)}x`;
  const r = parseRobots(evil);
  const t = Date.now();
  for (let i = 0; i < 50; i++) isAllowed(r, `/${'a'.repeat(400)}`);
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t}ms`);
  assert.equal(isAllowed(r, '/services'), true);
});

test('glob semantics: prefix by default, * wildcard, $ anchor, exact product token, merged groups', () => {
  const r = parseRobots('User-agent: *\nDisallow: /tmp*/cache\nDisallow: /*.json$\nAllow: /tmp-ok/cache');
  assert.equal(isAllowed(r, '/tmp123/cache/x'), false);
  assert.equal(isAllowed(r, '/a/b.json'), false);
  assert.equal(isAllowed(r, '/a/b.jsonx'), true);
  assert.equal(isAllowed(r, '/tmp-ok/cache'), true); // longer Allow wins
  assert.equal(isAllowed(r, '/other'), true);

  // A group for a *different* crawler that merely contains letters of our name never applies.
  const other = parseRobots('User-agent: bot\nDisallow: /\n\nUser-agent: x\nDisallow: /\n\nUser-agent: *\nDisallow: /nope');
  assert.equal(isAllowed(other, '/anything'), true);
  assert.equal(isAllowed(other, '/nope'), false);
  // Two groups naming us are merged, not first-wins.
  const merged = parseRobots('User-agent: WebmaxxersBot\nDisallow: /one\n\nUser-agent: *\nDisallow: /star\n\nUser-agent: WebmaxxersBot\nDisallow: /two');
  assert.equal(isAllowed(merged, '/one'), false);
  assert.equal(isAllowed(merged, '/two'), false);
  assert.equal(isAllowed(merged, '/star'), true);
});

test('an HTML soft-404 at /robots.txt means "no restrictions", but real failures still block', async () => {
  const resolver = async () => ['93.184.216.34'];
  const html: RawRequest = async () => ({ status: 200, contentType: 'text/html', body: Buffer.from('<html>app shell</html>') });
  assert.equal((await loadRobots('https://a.com', { request: html, resolver })).blockAll, false);
  const timeout: RawRequest = async () => { const e = new Error('t') as Error & { reason: string }; e.reason = 'timeout'; throw e; };
  assert.equal((await loadRobots('https://a.com', { request: timeout, resolver })).blockAll, true);
});
