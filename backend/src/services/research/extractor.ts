// backend/src/services/research/extractor.ts
// Turns crawled HTML into structured FACTS. Deterministic: no LLM, nothing executed.
//
// Everything text-like that leaves this file passes `clean()`: normalized, length-capped, and
// dropped if it looks like markup or prompt injection (the page is then flagged
// `suspicious`). The analysis step (4e) only ever sees these facts, never raw HTML.
import type { AnyNode } from 'domhandler';
import { looksUnsafe, normalizeText } from '../security/inputGuard.js';
import type { CrawledPage, SiteCrawl } from './crawler.js';
import type { PageRole } from './classify.js';
import { loadHtml, textOf, type Doc } from './html.js';
import {
  BOOKING_PROVIDERS, CHAT_PROVIDERS, CTA_TEXT, PLATFORMS, SOCIAL_SITES, TRUST_PATTERNS, hostMatches, matchProviders, type TrustTag,
} from './signals.js';

export type CtaKind = 'call' | 'email' | 'booking' | 'contact' | 'form' | 'link';
export type CtaPlace = 'header' | 'body' | 'footer';

export interface Cta { text: string; kind: CtaKind; place: CtaPlace }
export interface FormFacts { fieldCount: number; kinds: string[]; hasFileUpload: boolean; hasCaptcha: boolean }
export interface TrustSignal { tag: TrustTag; snippet: string }
export interface NavItem { label: string; path?: string; children: NavItem[] }

export interface PageFacts {
  url: string;
  path: string;
  role: PageRole;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  h3Count: number;
  wordCount: number;
  excerpt: string;
  ctas: Cta[];
  phones: string[];
  /** The page has at least one tel: link (set directly from the markup, not inferred from CTA wording). */
  clickToCall: boolean;
  forms: FormFacts[];
  trust: TrustSignal[];
  schemaTypes: string[];
  aggregateRating?: { value: string; count?: string };
  imageCount: number;
  imagesWithAlt: number;
  hasVideo: boolean;
  internalLinks: number;
  /** True when text on the page looked like markup or an attempt to instruct an AI; it was dropped. */
  suspicious: boolean;
}

export interface SiteFacts {
  host: string;
  rootUrl: string;
  pages: PageFacts[];
  nav: NavItem[];
  platform?: string;
  bookingTools: string[];
  chatTools: string[];
  social: string[];
  phones: string[];
  hasClickToCall: boolean;
  primaryCta?: Cta;
  schemaTypes: string[];
  inventory: SiteCrawl['inventory'];
  limitedVisibility: boolean;
  limitedReasons: SiteCrawl['limitedReasons'];
  totals: { pagesAnalyzed: number; words: number; forms: number; thinPages: string[] };
  suspicious: boolean;
}

const THIN_PAGE_WORDS = 300;
const bare = (h: string) => h.replace(/^www\./, '');

class Clean {
  suspicious = false;
  /** Normalizes and caps a string; returns '' (and flags the page) if it looks unsafe. */
  text(value: string | undefined, max = 140): string {
    const t = normalizeText(value ?? '').slice(0, max);
    if (t && looksUnsafe(t)) {
      this.suspicious = true;
      return '';
    }
    return t;
  }

  /**
   * URL paths come straight from links on a hostile page and land in the model prompt, so they
   * get the same treatment as page text: a plain character set, a length cap, and an injection
   * check on the words inside ("/ignore-all-previous-instructions").
   */
  path(value: string | undefined): string {
    const p = (value ?? '').slice(0, 80);
    if (!/^[A-Za-z0-9/_\-.~%]*$/.test(p)) {
      this.suspicious = true;
      return '/[omitted]';
    }
    let words = p;
    try { words = decodeURIComponent(p); } catch { /* keep the raw form */ }
    if (looksUnsafe(words.replace(/[-_/.]+/g, ' '))) {
      this.suspicious = true;
      return '/[omitted]';
    }
    return p || '/';
  }
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  return text.slice(start, Math.min(text.length, index + length + 40)).trim();
}

function mainText($: Doc): { text: string; words: number } {
  const root = $('main, [role="main"], article').first();
  const text = textOf(root.length ? root : $('body'), ['nav', 'header', 'footer']);
  return { text, words: text ? text.split(' ').length : 0 };
}

function placeOf($: Doc, el: AnyNode): CtaPlace {
  const node = $(el);
  if (node.closest('footer').length) return 'footer';
  if (node.closest('header, nav').length) return 'header';
  return 'body';
}

function ctaKind(href: string, base: string): CtaKind {
  const h = href.trim().toLowerCase();
  if (h.startsWith('tel:')) return 'call';
  if (h.startsWith('mailto:')) return 'email';
  try {
    if (matchProviders([new URL(href, base)], BOOKING_PROVIDERS).length > 0) return 'booking';
  } catch { /* unparseable href: fall through */ }
  if (/contact|quote|estimate|request|book|schedule|appointment/.test(h)) return 'contact';
  if (h.startsWith('#')) return 'form';
  return 'link';
}

function extractCtas($: Doc, clean: Clean, base: string): Cta[] {
  const seen = new Set<string>();
  const out: Cta[] = [];
  const push = (text: string, kind: CtaKind, place: CtaPlace) => {
    const key = `${text.toLowerCase()}|${kind}|${place}`;
    if (seen.has(key) || out.length >= 15) return;
    seen.add(key);
    out.push({ text, kind, place });
  };
  // Click-to-call links count whatever their wording ("(555) 123-4567" is the common label)
  // and are collected first so the cap can never crowd them out.
  $('a[href]').each((_, el) => {
    const node = $(el);
    if (!(node.attr('href') ?? '').trim().toLowerCase().startsWith('tel:')) return;
    push(clean.text(node.text() || node.attr('aria-label'), 40) || 'Call', 'call', placeOf($, el));
  });
  $('a, button, input[type="submit"], input[type="button"]').each((_, el) => {
    if (out.length >= 15) return;
    const node = $(el);
    const raw = node.is('input') ? node.attr('value') : node.text() || node.attr('aria-label');
    const text = clean.text(raw, 50);
    if (!text || text.length > 40 || !CTA_TEXT.test(text)) return;
    const kind = node.is('a') ? ctaKind(node.attr('href') ?? '', base) : 'form';
    push(text, kind, placeOf($, el));
  });
  return out;
}

function extractPhones($: Doc, text: string): string[] {
  const found = new Set<string>();
  const add = (s: string) => {
    const digits = s.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length === 10 && !/^(\d)\1{9}$/.test(digits)) found.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  };
  $('a[href^="tel:"]').each((_, el) => add(($(el).attr('href') ?? '').slice(4)));
  for (const m of text.matchAll(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g)) add(m[0]);
  return [...found].slice(0, 5);
}

function fieldKind(f: { type?: string; name?: string; label?: string; tag: string }): string {
  const s = `${f.type ?? ''} ${f.name ?? ''} ${f.label ?? ''}`.toLowerCase();
  if (f.type === 'file') return 'file';
  if (f.type === 'email' || /e-?mail/.test(s)) return 'email';
  if (f.type === 'tel' || /phone|mobile|tel\b/.test(s)) return 'phone';
  if (f.tag === 'textarea' || /message|comment|details|describe|how can/.test(s)) return 'message';
  if (f.tag === 'select') return /service|type|project|reason|subject/.test(s) ? 'service-select' : 'select';
  if (f.type === 'date' || /date|time|when/.test(s)) return 'date';
  if (/zip|postal/.test(s)) return 'zip';
  if (/address|city/.test(s)) return 'address';
  if (/name/.test(s)) return 'name';
  return 'other';
}

function extractForms($: Doc): FormFacts[] {
  const out: FormFacts[] = [];
  $('form').each((_, form) => {
    if (out.length >= 5) return;
    const node = $(form);
    if (node.attr('role') === 'search' || node.find('input[type="search"]').length) return;
    const fields = node.find('input, textarea, select').filter((_, e) => {
      const t = ($(e).attr('type') ?? '').toLowerCase();
      return !['hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio'].includes(t);
    });
    if (fields.length === 0) return;
    const kinds = new Set<string>();
    fields.each((_, e) => {
      const f = $(e);
      const id = f.attr('id');
      const label = (id ? $(`label[for="${id}"]`).text() : '') || f.attr('placeholder') || f.attr('aria-label') || '';
      kinds.add(fieldKind({ type: (f.attr('type') ?? '').toLowerCase(), name: f.attr('name'), label, tag: (e as { tagName?: string }).tagName ?? 'input' }));
    });
    out.push({
      fieldCount: fields.length,
      kinds: [...kinds].sort(),
      hasFileUpload: kinds.has('file'),
      hasCaptcha: node.find('.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey]').length > 0,
    });
  });
  return out;
}

function extractSchema($: Doc): { types: string[]; rating?: { value: string; count?: string } } {
  const types = new Set<string>();
  let rating: { value: string; count?: string } | undefined;
  const walk = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) return void node.slice(0, 100).forEach((n) => walk(n, depth + 1));
    const obj = node as Record<string, unknown>;
    const t = obj['@type'];
    for (const v of Array.isArray(t) ? t : [t]) if (typeof v === 'string' && /^[A-Za-z]{2,40}$/.test(v)) types.add(v);
    const ar = obj.aggregateRating as Record<string, unknown> | undefined;
    if (ar && typeof ar === 'object' && !rating && (typeof ar.ratingValue === 'string' || typeof ar.ratingValue === 'number')) {
      rating = { value: String(ar.ratingValue).slice(0, 6), count: ar.reviewCount !== undefined ? String(ar.reviewCount).slice(0, 8) : undefined };
    }
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  $('script[type="application/ld+json"]').slice(0, 10).each((_, el) => {
    const raw = $(el).text();
    if (raw.length > 200_000) return;
    try { walk(JSON.parse(raw)); } catch { /* malformed JSON-LD is common; ignore */ }
  });
  $('[itemtype]').slice(0, 30).each((_, el) => {
    const m = ($(el).attr('itemtype') ?? '').match(/schema\.org\/([A-Za-z]{2,40})$/);
    if (m) types.add(m[1]);
  });
  return { types: [...types].sort().slice(0, 30), rating };
}

export function extractPage(page: CrawledPage): PageFacts {
  const $ = loadHtml(page.html);
  const clean = new Clean();
  const host = new URL(page.url).hostname;
  const { text, words } = mainText($);

  const headings = (sel: string, max: number) =>
    $(sel).slice(0, max).map((_, el) => clean.text($(el).text(), 120)).get().filter(Boolean);

  const trust: TrustSignal[] = [];
  // Matching is bounded in length as well as in pattern shape: page text is attacker-controlled.
  const fullText = textOf($('body')).slice(0, 120_000);
  for (const { tag, re } of TRUST_PATTERNS) {
    const m = re.exec(fullText);
    if (m) {
      const snippet = clean.text(snippetAround(fullText, m.index, m[0].length), 110);
      if (snippet) trust.push({ tag, snippet });
    }
  }

  const schema = extractSchema($);
  const links = $('a[href]').toArray().map((a) => $(a).attr('href') ?? '');
  const internalLinks = links.filter((h) => {
    try { return bare(new URL(h, page.url).hostname) === bare(host); } catch { return false; }
  }).length;

  const images = $('img');
  return {
    url: page.url,
    path: clean.path(page.path),
    role: page.role,
    title: clean.text($('title').first().text(), 120),
    metaDescription: clean.text($('meta[name="description"]').attr('content'), 200),
    h1: headings('h1', 5),
    h2: headings('h2', 20),
    h3Count: $('h3').length,
    wordCount: words,
    excerpt: clean.text(text, 400),
    ctas: extractCtas($, clean, page.url),
    clickToCall: $('a[href]').toArray().some((a) => ($(a).attr('href') ?? '').trim().toLowerCase().startsWith('tel:')),
    phones: extractPhones($, fullText),
    forms: extractForms($),
    trust,
    schemaTypes: schema.types,
    aggregateRating: schema.rating,
    imageCount: images.length,
    imagesWithAlt: images.filter((_, el) => Boolean(($(el).attr('alt') ?? '').trim())).length,
    hasVideo: $('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"]').length > 0,
    internalLinks,
    suspicious: clean.suspicious,
  };
}

function extractNav(html: string, pageUrl: string, clean: Clean): NavItem[] {
  const $ = loadHtml(html);
  const host = new URL(pageUrl).hostname;
  const pathOf = (href?: string): string | undefined => {
    if (!href) return undefined;
    try {
      const u = new URL(href, pageUrl);
      return bare(u.hostname) === bare(host) ? clean.path(u.pathname) : undefined;
    } catch { return undefined; }
  };
  const itemsOf = (ul: ReturnType<Doc>, depth: number): NavItem[] =>
    ul.children('li').slice(0, 15).map((_, li) => {
      const item = $(li);
      const anchor = item.children('a').first().length ? item.children('a').first() : item.find('a').first();
      const label = clean.text(anchor.length ? anchor.text() : item.children('span, button').first().text(), 40);
      const sub = depth < 2 ? item.find('ul').first() : $();
      return { label, path: pathOf(anchor.attr('href')), children: sub.length ? itemsOf(sub, depth + 1).filter((c) => c.label) : [] };
    }).get().filter((i: NavItem) => i.label);

  // Primary nav = the top-level list (not nested inside another list item) with the most
  // linked items, among lists inside <nav>/<header>. This skips small widgets such as
  // font-size or language switchers.
  let best: ReturnType<Doc> | null = null;
  let bestCount = 0;
  $('nav ul, header ul, [role="navigation"] ul').each((_, el) => {
    const ul = $(el);
    if (ul.parents('li').length > 0) return;
    const count = ul.children('li').filter((_, li) => $(li).find('a').length > 0).length;
    if (count > bestCount && count <= 40) { best = ul; bestCount = count; }
  });
  if (best && bestCount >= 3) return itemsOf(best, 0);

  // No list-based menu: fall back to the container with the most plain links.
  let container: ReturnType<Doc> | null = null;
  let links = 0;
  $('nav, header').each((_, el) => {
    const count = $(el).find('a').length;
    if (count >= 3 && count <= 120 && count > links) { container = $(el); links = count; }
  });
  if (!container) return [];
  return (container as ReturnType<Doc>).find('a').slice(0, 15).map((_, a) => ({ label: clean.text($(a).text(), 40), path: pathOf($(a).attr('href')), children: [] as NavItem[] })).get().filter((i: NavItem) => i.label);
}

export function extractSite(crawl: SiteCrawl): SiteFacts {
  const pages = crawl.pages.map(extractPage);
  const home = crawl.pages[0];
  const clean = new Clean();
  const nav = extractNav(home.html, home.url, clean);

  // Resources a page LOADS (scripts, frames, stylesheets, images) vs links it merely POINTS to.
  // Chat widgets and platforms are judged by what loads; a link to intercom.io is not a widget.
  const loaded: URL[] = [];
  const linked: URL[] = [];
  let generator = '';
  for (const p of crawl.pages) {
    const $p = loadHtml(p.html);
    generator ||= $p('meta[name="generator"]').attr('content') ?? '';
    const collect = (sel: string, attr: string, into: URL[]) => {
      $p(sel).slice(0, 1500).each((_, el) => {
        const raw = $p(el).attr(attr);
        if (!raw) return;
        try { into.push(new URL(raw, p.url)); } catch { /* skip junk URLs */ }
      });
    };
    collect('script[src], iframe[src], link[href], img[src], source[src], embed[src], object[data]', 'src', loaded);
    collect('link[href]', 'href', loaded);
    collect('object[data]', 'data', loaded);
    collect('a[href]', 'href', linked);
  }
  const platform =
    PLATFORMS.find((p) => p.generator?.test(generator))?.name ??
    PLATFORMS.find((p) => loaded.some((u) => p.hosts?.some((d) => hostMatches(u.hostname, d)) || p.paths?.some((x) => u.pathname.includes(x))))?.name;
  const bookingTools = matchProviders([...loaded, ...linked], BOOKING_PROVIDERS);
  const chatTools = matchProviders(loaded, CHAT_PROVIDERS);
  const social = [...new Set(SOCIAL_SITES
    .filter((s) => linked.some((u) => hostMatches(u.hostname, s.host) && (!s.pathPrefix || u.pathname.startsWith(s.pathPrefix))))
    .map((s) => s.name))];

  const phones = [...new Set(pages.flatMap((p) => p.phones))].slice(0, 5);
  const homeFacts = pages[0];
  const primaryCta =
    homeFacts.ctas.find((c) => c.place !== 'footer' && (c.kind === 'call' || c.kind === 'contact' || c.kind === 'booking' || c.kind === 'form')) ?? homeFacts.ctas[0];

  return {
    host: crawl.host,
    rootUrl: crawl.rootUrl,
    pages,
    nav,
    platform,
    bookingTools,
    chatTools,
    social,
    phones,
    hasClickToCall: pages.some((p) => p.clickToCall),
    primaryCta,
    schemaTypes: [...new Set(pages.flatMap((p) => p.schemaTypes))].sort(),
    inventory: crawl.inventory,
    limitedVisibility: crawl.limitedVisibility,
    limitedReasons: crawl.limitedReasons,
    totals: {
      pagesAnalyzed: pages.length,
      words: pages.reduce((n, p) => n + p.wordCount, 0),
      forms: pages.reduce((n, p) => n + p.forms.length, 0),
      thinPages: pages.filter((p) => p.wordCount < THIN_PAGE_WORDS && p.role !== 'contact').map((p) => p.path),
    },
    suspicious: clean.suspicious || pages.some((p) => p.suspicious),
  };
}
