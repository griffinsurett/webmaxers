// Research job tests: virtual web + fake search/LLM. No network, no database.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RawAnalysis } from './analysis.js';
import { PoliteFetcher } from './fetcher.js';
import { friendlyReason, runResearch, type ProgressEvent, type ResearchDeps, type ResearchInput } from './job.js';
import type { RawRequest } from './safeFetch.js';

const prose = 'We are a family owned plumbing company serving Austin. Licensed and insured with free estimates and 24/7 emergency service. '.repeat(5);
const home = (name: string, extra = '') => `<html><head><title>${name} Plumbing Austin</title></head><body>
  <header><nav><ul><li><a href="/services">Services</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li></ul></nav></header>
  <main><h1>${name} Plumbing</h1><p>${prose}</p><a class="btn" href="tel:5125550100">Call Now</a>${extra}</main></body></html>`;
const inner = (t: string) => `<html><head><title>${t}</title></head><body><main><h1>${t}</h1><p>${prose}</p></main></body></html>`;
const siteFiles = (name: string) => ({ '/': home(name), '/services': inner('Services'), '/about': inner('About'), '/contact': inner('Contact') });

function web(sites: Record<string, Record<string, string> | number>, extra: Partial<ResearchDeps> = {}) {
  const requested: string[] = [];
  const request: RawRequest = async (url) => {
    const host = url.hostname.replace(/^www\./, '');
    requested.push(host + url.pathname);
    if (url.pathname === '/robots.txt') return { status: 404, contentType: 'text/plain', body: Buffer.alloc(0) };
    const site = sites[host];
    if (typeof site === 'number') return { status: site, contentType: 'text/html', body: Buffer.alloc(0) };
    const html = site?.[url.pathname];
    return html ? { status: 200, contentType: 'text/html', body: Buffer.from(html) } : { status: 404, contentType: 'text/html', body: Buffer.alloc(0) };
  };
  const calls = { search: 0, llm: 0, llmInput: '' };
  const deps: ResearchDeps = {
    search: { search: async () => { calls.search++; return { candidates: [{ name: 'Rooter', url: 'https://rooter.com', reason: 'Local plumber.' }, { name: 'Pipe Pros', url: 'https://pipepros.com', reason: 'Local plumber.' }], citedUrls: ['https://rooter.com'] }; } },
    llm: { analyze: async ({ user }): Promise<RawAnalysis> => {
      calls.llm++; calls.llmInput = user;
      return { competitors: [{ key: 'c1', whatWorks: [{ point: 'Puts a call button on the homepage.', why: 'Easy to act.', evidence: ['c1-F1', 'c1-F2', 'c1-F3', 'c1-F4', 'c1-F5', 'c1-F6', 'c1-F7', 'c1-F8'].slice(0, 4) }], gaps: [] }], patterns: [], ownSite: null, opportunities: [{ point: 'Make every service its own page.', why: 'Helps local search.', evidence: [], basis: 'reasonable_recommendation' }] };
    } },
    makeFetcher: () => new PoliteFetcher({ request, resolver: async () => ['93.184.216.34'] }),
    ...extra,
  };
  return { deps, requested, calls };
}
const INPUT: ResearchInput = { businessName: 'Bob Plumbing', industry: 'plumbing', serviceArea: 'Austin, TX', services: ['drains'], primaryGoal: 'calls', ownUrl: 'https://bob.com', competitorUrls: ['https://rooter.com', 'https://pipepros.com'] };

test('visitor-named competitors: no discovery, all sites read, findings verified', async () => {
  const w = web({ 'bob.com': siteFiles('Bob'), 'rooter.com': siteFiles('Rooter'), 'pipepros.com': siteFiles('Pipe Pros') });
  const events: ProgressEvent[] = [];
  const rec = await runResearch(INPUT, w.deps, (e) => events.push(e));
  assert.equal(w.calls.search, 0);
  assert.equal(rec.status, 'complete');
  assert.deepEqual(rec.sites.map((s) => [s.key, s.status]), [['own', 'read'], ['c1', 'read'], ['c2', 'read']]);
  assert.ok(rec.sites.every((s) => s.facts.length > 5 && s.facts.every((f) => f.id.startsWith(`${s.key}-F`))));
  assert.equal(rec.findings?.competitors[0].whatWorks.length, 1);
  assert.equal(rec.findings?.opportunities[0].support, 'reasonable_recommendation');
  const steps = events.filter((e) => e.type === 'step').map((e) => (e as { step: string }).step);
  assert.deepEqual(steps, ['reading', 'analyzing']);
  assert.equal(events.filter((e) => e.type === 'site' && e.status === 'done').length, 3);
  assert.ok(w.calls.llmInput.includes('site="own"') && w.calls.llmInput.includes('site="c2"'));
});

test('no competitors given: discovers them, announces them, reads them', async () => {
  const w = web({ 'bob.com': siteFiles('Bob'), 'rooter.com': siteFiles('Rooter'), 'pipepros.com': siteFiles('Pipe Pros') });
  const events: ProgressEvent[] = [];
  const rec = await runResearch({ ...INPUT, competitorUrls: [] }, w.deps, (e) => events.push(e));
  assert.equal(w.calls.search, 1);
  const announced = events.find((e) => e.type === 'competitors');
  assert.deepEqual(announced && announced.type === 'competitors' && announced.items.map((i) => [i.host, i.source]), [['rooter.com', 'discovered'], ['pipepros.com', 'discovered']]);
  assert.deepEqual(rec.sites.filter((s) => s.role === 'competitor').map((s) => s.source), ['discovered', 'discovered']);
  assert.equal(events[0].type, 'step');
});

test('no own site: competitors only, analysis gets no own site', async () => {
  const w = web({ 'rooter.com': siteFiles('Rooter'), 'pipepros.com': siteFiles('Pipe Pros') });
  const rec = await runResearch({ ...INPUT, ownUrl: undefined }, w.deps);
  assert.equal(rec.status, 'complete');
  assert.ok(!rec.sites.some((s) => s.role === 'own'));
  assert.match(w.calls.llmInput, /no website of their own/);
});

test('a blocked or missing site is reported kindly and skipped; the rest still analyzed', async () => {
  const w = web({ 'bob.com': siteFiles('Bob'), 'rooter.com': 429, 'pipepros.com': siteFiles('Pipe Pros') });
  const rec = await runResearch(INPUT, w.deps);
  assert.equal(rec.status, 'partial');
  const bad = rec.sites.find((s) => s.host === 'rooter.com');
  assert.equal(bad?.status, 'failed');
  assert.match(bad?.note ?? '', /blocks automated readers/);
  assert.ok(rec.findings, 'analysis still ran on the readable sites');
  assert.ok(rec.notices.some((n) => /rooter\.com/.test(n)));
  assert.ok(!/429|http/i.test(rec.notices.join(' ')), 'no raw technical detail for the visitor');
});

test('nothing readable: failed record, no model call, conversation can continue', async () => {
  const w = web({ 'bob.com': 403, 'rooter.com': 500, 'pipepros.com': 404 });
  const rec = await runResearch(INPUT, w.deps);
  assert.equal(rec.status, 'failed');
  assert.equal(rec.findings, null);
  assert.equal(w.calls.llm, 0);
  assert.ok(rec.notices.length > 0);
});

test('model failure keeps the facts and degrades to partial', async () => {
  const w = web({ 'bob.com': siteFiles('Bob'), 'rooter.com': siteFiles('Rooter'), 'pipepros.com': siteFiles('P') }, {
    llm: { analyze: async () => { throw new Error('429 rate limit'); } },
  });
  const rec = await runResearch(INPUT, w.deps);
  assert.equal(rec.status, 'partial');
  assert.equal(rec.findings, null);
  assert.ok(rec.sites.every((s) => s.facts.length > 0));
  assert.ok(rec.notices.some((n) => /written analysis/.test(n)));
});

test('discovery problems degrade: search failure or thin intake never crash the job', async () => {
  const w = web({ 'bob.com': siteFiles('Bob') }, { search: { search: async () => { throw new Error('boom'); } } });
  const rec = await runResearch({ ...INPUT, competitorUrls: [] }, w.deps);
  assert.ok(rec.notices.some((n) => /look up local competitors/.test(n)));
  assert.equal(rec.sites.length, 1);

  const w2 = web({ 'bob.com': siteFiles('Bob') });
  const rec2 = await runResearch({ ...INPUT, competitorUrls: [], industry: '', serviceArea: '' }, w2.deps);
  assert.equal(w2.calls.search, 0);
  assert.ok(rec2.notices.some((n) => /enough about your business/.test(n)));
});

test('limited-visibility sites are flagged, not trusted', async () => {
  const spa = { '/': '<html><body><div id="root"></div><script src="/a.js"></script></body></html>' };
  const w = web({ 'bob.com': siteFiles('Bob'), 'rooter.com': spa, 'pipepros.com': siteFiles('P') });
  const rec = await runResearch(INPUT, w.deps);
  const s = rec.sites.find((x) => x.host === 'rooter.com');
  assert.equal(s?.status, 'limited');
  assert.match(s?.note ?? '', /very little to automated readers/);
  assert.equal(rec.status, 'partial');
  assert.ok(s?.facts.some((f) => f.kind === 'visibility'));
});

test('caps sites at three competitors', async () => {
  const many = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
  const w = web(Object.fromEntries(['bob.com', ...many].map((h) => [h, siteFiles(h)])));
  const rec = await runResearch({ ...INPUT, competitorUrls: many.map((h) => `https://${h}`) }, w.deps);
  assert.equal(rec.sites.filter((s) => s.role === 'competitor').length, 3);
  assert.ok(!w.requested.some((r) => r.startsWith('d.com') || r.startsWith('e.com')));
});

test('friendly reasons never leak technical detail', () => {
  assert.match(friendlyReason('http_error', 403), /blocks automated/);
  assert.match(friendlyReason('robots_disallowed'), /asks automated tools/);
  assert.match(friendlyReason('timeout'), /respond in time/);
  assert.match(friendlyReason('non_public_address'), /safely/);
  assert.match(friendlyReason('http_error', 404), /safely/);
});

test('a discovery crash is contained: the job still reads the visitor site and reports a notice', async () => {
  const w = web({ 'bob.com': siteFiles('Bob') }, { search: { search: async () => { throw new TypeError('kaboom'); } } });
  const rec = await runResearch({ ...INPUT, competitorUrls: [] }, w.deps);
  assert.equal(rec.sites.length, 1);
  assert.ok(rec.notices.length > 0);
});
