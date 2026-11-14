// backend/src/services/research/crawler.ts
// Reads one website through the PoliteFetcher: homepage → discover links (nav, body, then
// sitemap.xml if the site is link-poor) → pick the ~8 pages that explain the business best.
//
// It never leaves the site (same host only), never follows a link the URL guard rejects,
// and stops at a page and time budget. Sites that render with JavaScript show an almost
// empty homepage; those are flagged `limitedVisibility` instead of being rendered in a browser.
import { validateUrlSyntax } from '../security/urlGuard.js';
import { classifyPage, SELECTION_PRIORITY, type PageRole } from './classify.js';
import type { PoliteFetcher } from './fetcher.js';
import { loadHtml, visibleText } from './html.js';
import type { FetchFailure } from './safeFetch.js';

export const MAX_PAGES_PER_SITE = 8;
const CRAWL_CONCURRENCY = 3;
const SITE_TIME_BUDGET_MS = 25_000;
const MAX_SITEMAP_URLS = 300;
const MAX_LINKS = 500;
const SITEMAP_TRIGGER = 5;

export interface CrawledPage {
  url: string;
  path: string;
  role: PageRole;
  html: string;
}

export interface SiteCrawl {
  host: string;
  rootUrl: string;
  /** Homepage first. */
  pages: CrawledPage[];
  /** How many URLs of each role the site exposes (nav, body links, sitemap), fetched or not. */
  inventory: Partial<Record<PageRole, number>>;
  discoveredLinks: number;
  usedSitemap: boolean;
  skipped: { url: string; reason: FetchFailure }[];
  limitedVisibility: boolean;
  limitedReasons: ('thin_homepage' | 'js_rendered' | 'few_links' | 'few_pages_fetched')[];
}

export type CrawlResult = { ok: true; crawl: SiteCrawl } | { ok: false; reason: FetchFailure; status?: number };

interface Candidate {
  url: string;
  path: string;
  text: string;
  inNav: boolean;
  role: PageRole;
}

const bare = (host: string) => host.replace(/^www\./, '');

function collectLinks(html: string, pageUrl: string, host: string): Candidate[] {
  const $ = loadHtml(html);
  const found = new Map<string, Candidate>();
  $('a[href]').each((_, el) => {
    if (found.size >= MAX_LINKS) return;
    const href = ($(el).attr('href') ?? '').trim();
    if (!href || /^(#|mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return;
    let absolute: string;
    try {
      absolute = new URL(href, pageUrl).href;
    } catch {
      return;
    }
    const checked = validateUrlSyntax(absolute);
    if (!checked.ok || bare(checked.host) !== bare(host)) return;
    const path = new URL(checked.url).pathname || '/';
    if (path === '/') return;
    const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
    const inNav = $(el).closest('nav, header, [role="navigation"]').length > 0;
    const key = checked.url.replace(/\/+$/, ''); // /about and /about/ are one page
    const existing = found.get(key);
    if (existing) {
      existing.inNav ||= inNav;
      return;
    }
    found.set(key, { url: checked.url, path, text, inNav, role: classifyPage(path, text) });
  });
  return [...found.values()];
}

function sitemapUrls(xml: string, host: string): Candidate[] {
  const out: Candidate[] = [];
  for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    if (out.length >= MAX_SITEMAP_URLS) break;
    const checked = validateUrlSyntax(loc.replace(/&amp;/g, '&'));
    if (!checked.ok || bare(checked.host) !== bare(host)) continue;
    const path = new URL(checked.url).pathname || '/';
    if (path === '/' || /\.xml$/i.test(path)) continue;
    out.push({ url: checked.url, path, text: '', inNav: false, role: classifyPage(path) });
  }
  return out;
}

/** Chooses which discovered pages are worth fetching, most informative roles first. */
export function selectPages(candidates: Candidate[], limit: number): Candidate[] {
  const rank = (c: Candidate) => [c.inNav ? 0 : 1, c.path.length];
  const sorted = [...candidates].sort((a, b) => {
    const [an, al] = rank(a);
    const [bn, bl] = rank(b);
    return an - bn || al - bl;
  });
  const picked: Candidate[] = [];
  for (const role of SELECTION_PRIORITY) {
    const cap = role === 'service-detail' ? 2 : 1;
    for (const c of sorted.filter((x) => x.role === role).slice(0, cap)) {
      if (picked.length < limit) picked.push(c);
    }
  }
  for (const c of sorted) {
    if (picked.length >= limit) break;
    if (c.role === 'other' && c.inNav && !picked.includes(c)) picked.push(c);
  }
  return picked;
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function crawlSite(rootUrl: string, fetcher: PoliteFetcher): Promise<CrawlResult> {
  const deadline = Date.now() + SITE_TIME_BUDGET_MS;
  const home = await fetcher.fetchHtml(rootUrl);
  if (!home.ok) return { ok: false, reason: home.reason, status: home.status };

  const host = new URL(home.url).hostname;
  const origin = `${new URL(home.url).protocol}//${host}`;
  const skipped: SiteCrawl['skipped'] = [];

  const all = new Map<string, Candidate>();
  for (const c of collectLinks(home.body, home.url, host)) all.set(c.url.replace(/\/+$/, ''), c);
  const linkCount = all.size;

  let usedSitemap = false;
  if (linkCount < SITEMAP_TRIGGER) {
    const sm = await fetcher.fetchText(`${origin}/sitemap.xml`);
    if (sm.ok) {
      const urls = sitemapUrls(sm.body, host);
      usedSitemap = urls.length > 0;
      for (const c of urls) {
        const key = c.url.replace(/\/+$/, '');
        if (!all.has(key)) all.set(key, c);
      }
    }
  }

  const candidates = [...all.values()];
  const inventory: SiteCrawl['inventory'] = {};
  for (const c of candidates) inventory[c.role] = (inventory[c.role] ?? 0) + 1;

  const homePage: CrawledPage = { url: home.url, path: '/', role: 'home', html: home.body };
  const chosen = selectPages(candidates, MAX_PAGES_PER_SITE - 1);
  const fetched = await mapPool(chosen, CRAWL_CONCURRENCY, async (c) => {
    if (Date.now() > deadline) return { c, res: { ok: false as const, reason: 'timeout' as FetchFailure } };
    return { c, res: await fetcher.fetchHtml(c.url) };
  });
  const pages: CrawledPage[] = [homePage];
  for (const { c, res } of fetched) {
    if (res.ok) pages.push({ url: res.url, path: c.path, role: c.role, html: res.body });
    else skipped.push({ url: c.url, reason: res.reason });
  }

  const $home = loadHtml(home.body);
  const text = visibleText($home);
  const reasons: SiteCrawl['limitedReasons'] = [];
  if (text.length < 250) reasons.push('thin_homepage');
  if ($home('#root, #__next, #app, #___gatsby, [ng-app], app-root').length > 0 && text.length < 800) reasons.push('js_rendered');
  if (linkCount < 3 && !usedSitemap) reasons.push('few_links');
  if (pages.length < 2 && chosen.length > 0) reasons.push('few_pages_fetched');

  return {
    ok: true,
    crawl: {
      host, rootUrl: home.url, pages, inventory, discoveredLinks: candidates.length,
      usedSitemap, skipped, limitedVisibility: reasons.length > 0, limitedReasons: reasons,
    },
  };
}
