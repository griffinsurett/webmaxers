// Crawler tests on a virtual website. No network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyPage } from './classify.js';
import { crawlSite, MAX_PAGES_PER_SITE } from './crawler.js';
import { PoliteFetcher } from './fetcher.js';
import type { RawRequest } from './safeFetch.js';

const LOREM = 'We are a family owned plumbing company serving the greater Austin area with fast, honest repairs. '.repeat(6);
const page = (body: string, nav = '') => `<html><head><title>t</title></head><body><nav>${nav}</nav><main><p>${LOREM}</p>${body}</main></body></html>`;

function site(files: Record<string, string>, opts: { robots?: string; sitemap?: string } = {}) {
  const requested: string[] = [];
  const request: RawRequest = async (url) => {
    requested.push(url.pathname);
    const type = (t = 'text/html') => ({ contentType: t });
    if (url.pathname === '/robots.txt') {
      return opts.robots ? { status: 200, ...type('text/plain'), body: Buffer.from(opts.robots) } : { status: 404, ...type(), body: Buffer.alloc(0) };
    }
    if (url.pathname === '/sitemap.xml') {
      return opts.sitemap ? { status: 200, ...type('application/xml'), body: Buffer.from(opts.sitemap) } : { status: 404, ...type(), body: Buffer.alloc(0) };
    }
    const body = files[url.pathname];
    return body === undefined ? { status: 404, ...type(), body: Buffer.alloc(0) } : { status: 200, ...type(), body: Buffer.from(body) };
  };
  const fetcher = new PoliteFetcher({ request, resolver: async () => ['93.184.216.34'] });
  return { fetcher, requested };
}

const NAV = `
  <a href="/services">Services</a><a href="/about-us">About</a><a href="/contact">Contact</a>
  <a href="/pricing">Pricing</a><a href="/service-areas">Areas</a><a href="/blog">Blog</a>
  <a href="/reviews">Reviews</a><a href="/our-work">Our Work</a><a href="/faq">FAQ</a>`;
const BODY_LINKS = `
  <a href="/services/drain-cleaning">Drains</a><a href="/services/water-heaters">Heaters</a><a href="/services/repiping">Repiping</a>
  <a href="/service-areas/round-rock">Round Rock</a><a href="/service-areas/cedar-park">Cedar Park</a>
  <a href="/blog/winter-pipes">post</a><a href="/blog/how-much-repipe">post</a><a href="/blog/leaks">post</a>
  <a href="/privacy-policy">Privacy</a><a href="https://www.facebook.com/acme">FB</a><a href="https://other.com/x">x</a>
  <a href="mailto:a@acme.com">mail</a><a href="tel:5125550100">call</a><a href="/menu.pdf">pdf</a><a href="#top">top</a>`;
const files = (): Record<string, string> => ({
  '/': page(BODY_LINKS, NAV),
  '/services': page('<h1>Services</h1>'), '/about-us': page('<h1>About</h1>'), '/contact': page('<form></form>'),
  '/pricing': page('<h1>Pricing</h1>'), '/service-areas': page('<h1>Areas</h1>'), '/blog': page('<h1>Blog</h1>'),
  '/reviews': page('r'), '/our-work': page('w'), '/faq': page('f'),
  '/services/drain-cleaning': page('d'), '/services/water-heaters': page('h'), '/services/repiping': page('p'),
  '/service-areas/round-rock': page('rr'), '/privacy-policy': page('legal'),
});

test('classifies pages by path and link text', () => {
  assert.equal(classifyPage('/'), 'home');
  assert.equal(classifyPage('/services'), 'services');
  assert.equal(classifyPage('/services/drain-cleaning'), 'service-detail');
  assert.equal(classifyPage('/about-us'), 'about');
  assert.equal(classifyPage('/request-a-quote'), 'contact');
  assert.equal(classifyPage('/service-areas'), 'locations');
  assert.equal(classifyPage('/service-areas/round-rock'), 'location-detail');
  assert.equal(classifyPage('/plumber-in-austin'), 'location-detail');
  assert.equal(classifyPage('/blog'), 'blog');
  assert.equal(classifyPage('/blog/winter-pipes'), 'blog-post');
  assert.equal(classifyPage('/privacy-policy'), 'legal');
  assert.equal(classifyPage('/our-work'), 'projects');
  assert.equal(classifyPage('/x7', 'Meet the team'), 'about');
  assert.equal(classifyPage('/zzz'), 'other');
});

test('picks the pages that explain the business, within the page cap', async () => {
  const { fetcher, requested } = site(files());
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  const { crawl } = r;
  assert.equal(crawl.pages[0].role, 'home');
  assert.ok(crawl.pages.length <= MAX_PAGES_PER_SITE);
  const roles = crawl.pages.map((p) => p.role);
  for (const need of ['services', 'about', 'contact', 'pricing', 'locations']) assert.ok(roles.includes(need as never), need);
  assert.ok(roles.filter((x) => x === 'service-detail').length <= 2);
  assert.ok(!roles.includes('legal') && !roles.includes('blog-post'));
  assert.ok(!requested.includes('/privacy-policy'));
  assert.equal(crawl.limitedVisibility, false);
});

test('inventory counts everything the site exposes, fetched or not; off-site links are ignored', async () => {
  const { fetcher } = site(files());
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.equal(r.crawl.inventory['service-detail'], 3);
  assert.equal(r.crawl.inventory['blog-post'], 3);
  assert.equal(r.crawl.inventory['location-detail'], 2);
  const all = r.crawl.pages.map((p) => p.url).join(' ');
  assert.ok(!/facebook|other\.com|mailto|\.pdf/.test(all));
});

test('never requests more than the cap even on a huge nav', async () => {
  const many = Array.from({ length: 60 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join('');
  const f = { '/': page('', many), ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`/p${i}`, page('x')])) };
  const { fetcher, requested } = site(f);
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.ok(r.crawl.pages.length <= MAX_PAGES_PER_SITE);
  assert.ok(requested.filter((p) => p.startsWith('/p')).length <= MAX_PAGES_PER_SITE - 1);
});

test('flags JavaScript-rendered shells as limited visibility', async () => {
  const { fetcher } = site({ '/': '<html><body><div id="root"></div><script src="/app.js"></script></body></html>' });
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.equal(r.crawl.limitedVisibility, true);
  assert.ok(r.crawl.limitedReasons.includes('js_rendered'));
});

test('uses sitemap.xml when the homepage has almost no links; ignores off-site entries', async () => {
  const sitemap = `<urlset><url><loc>https://acme.com/services</loc></url><url><loc>https://acme.com/about</loc></url>
    <url><loc>https://evil.com/x</loc></url><url><loc>https://acme.com/contact</loc></url></urlset>`;
  const { fetcher, requested } = site({ '/': page('<a href="/services">s</a>'), '/services': page('s'), '/about': page('a'), '/contact': page('c') }, { sitemap });
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.equal(r.crawl.usedSitemap, true);
  assert.ok(r.crawl.pages.some((p) => p.path === '/about'));
  assert.ok(!r.crawl.pages.some((p) => p.url.includes('evil.com')));
  assert.ok(requested.includes('/sitemap.xml'));
});

test('skips pages blocked by robots.txt and reports them', async () => {
  const { fetcher, requested } = site(files(), { robots: 'User-agent: *\nDisallow: /pricing' });
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.ok(r.crawl.skipped.some((s) => s.url.endsWith('/pricing') && s.reason === 'robots_disallowed'));
  assert.ok(!requested.includes('/pricing'));
});

test('treats www and bare domain as one site; reports unreachable homepages', async () => {
  const { fetcher } = site({ '/': page('<a href="https://www.acme.com/services">s</a><a href="/about">a</a><a href="/contact">c</a>'), '/services': page('s'), '/about': page('a'), '/contact': page('c') });
  const r = await crawlSite('acme.com', fetcher);
  assert.ok(r.ok);
  assert.ok(r.crawl.pages.some((p) => p.path === '/services'));
  const down = await crawlSite('acme.com', site({}).fetcher);
  assert.deepEqual(down, { ok: false, reason: 'http_error', status: 404 });
});
