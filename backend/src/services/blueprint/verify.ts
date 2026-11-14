// backend/src/services/blueprint/verify.ts
// Code-side verification and repair of the model's structure draft (5e). The model proposes;
// this decides. Everything that reaches the visitor or the pricing engine passes through here:
//  - SKUs must exist in the catalog and be the right kind; categories force matching page SKUs
//  - ids/slugs are normalized and unique, the tree has one home, no cycles, depth <= 3
//  - exactly five core pages (home + contact always among them), page and article caps
//  - evidence ids must be real research facts, otherwise the item is labelled a
//    "reasonable recommendation"
//  - no prices in text, no links/markup/injected instructions, no unknown domains
import { containsDomainLike, looksUnsafe, normalizeText } from '../security/inputGuard.js';
import type { CatalogItem } from '../../types/index.js';
import {
  type Basis, type Classification, type PageCategory, type PageDraft, type Priority, type StructureOutput,
} from './types.js';

export const MAX_PAGES = 30;
export const MAX_ARTICLES = 10;
export const MAX_LOCATION_PAGES = 8;
export const MAX_DEPTH = 3;
export const CORE_PAGES = 5;
export const MAX_RECOMMENDED_ADDONS = 6;

export interface VerifyContext {
  catalog: CatalogItem[];
  /** Fact ids from the research record; empty when research failed. */
  factIds: Set<string>;
  serviceArea?: string;
  services: string[];
  primaryGoal?: string;
  /** Hosts of analyzed sites: the only web addresses text may mention. */
  hosts: string[];
}

export interface PageNode {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  category: PageCategory;
  classification: Classification;
  sku: string;
  purpose: string;
  why: string;
  primaryCta: string;
  evidence: string[];
  basis: Basis;
}
export interface ArticleNode { id: string; title: string; customerQuestion: string; relatedPageId: string; conversionPath: string; priority: Priority; why: string }
export interface AddonNode { sku: string; recommended: boolean; reason: string; evidence: string[] }

export interface VerifiedStructure {
  websiteTypeSku: string | null;
  audience: string;
  strategy: string;
  pages: PageNode[];
  articles: ArticleNode[];
  addons: AddonNode[];
  /** What the verifier changed, for logs and tests (not shown to the visitor). */
  repairs: string[];
}

// Anything that reads as a price, a rate or a promotion. The model must never state money:
// numbers shown to the visitor come from the pricing engine only. Deliberately broad:
// symbols, currency words, number words, per-period rates ("500 per month", "99 / mo", "3k"),
// and price vocabulary next to a digit. Plain "free estimate" is allowed (a service feature).
const NUMBER_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|grand|million';
const MONEY_WORDS = 'dollars?|bucks|euros?|pounds?|usd|eur|gbp|cents?';
const PRICE_TEXT = new RegExp([
  String.raw`[$€£¥₹]\s?\d`,
  String.raw`\d\s?[$€£¥₹]`,
  String.raw`\b\d[\d,.]*\s?(?:k|${MONEY_WORDS})\b`,
  String.raw`\b\d[\d,.]*\s*(?:per|a|each|every|/)\s*(?:mo|month|monthly|yr|year|annum|week|wk|hour|hr|page|project|job)\b`,
  String.raw`\b(?:${NUMBER_WORDS})\b[^.]{0,25}\b(?:${MONEY_WORDS})\b`,
  String.raw`\b(?:price|prices|priced|pricing|cost|costs|costing|fee|fees|discount|discounts)\b[^.]{0,30}\d`,
  String.raw`\d[^.]{0,30}\b(?:price|prices|priced|pricing|cost|costs|fee|fees|discount|setup|upfront|one-time|per month|a month|monthly|annually)\b`,
  String.raw`\b(?:one-time|setup|upfront|monthly|annual|annually|per month|a month)\b[^.]{0,20}\d`,
  String.raw`\b(?:discounts?|free of charge|no charge|no cost|for free|percent off|half price|on sale)\b|%\s?off`,
].join('|'), 'i');

/** Credentials and numbers the model has no way of knowing: owner-supplied facts, never invented. */
const INVENTED_FACT = /\b(?:since|established in|founded in)\s+(?:19|20)\d\d\b|\b\d+\+?[\s-]*years?\b|\blicen[cs]e\s*(?:#|no\.?|number)\s*\w+|\b\d{3}[-.\s)]\s?\d{3}[-.\s]\d{4}\b|\b\d+\s?%/i;

export const slugify = (s: string, max = 40): string =>
  normalizeText(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');

/**
 * Sanitizes model text: null when unsafe (markup, injection, links, unknown domains, prices).
 * `noInvented` also rejects made-up credentials and statistics (years, percentages, licence
 * and phone numbers): used for every free-text field the visitor will read.
 */
export function cleanText(value: unknown, max: number, hosts: string[] = [], noInvented = false): string | null {
  if (typeof value !== 'string') return null;
  const t = normalizeText(value).slice(0, max);
  if (!t || looksUnsafe(t) || /[<>`]|https?:\/\/|\bwww\./i.test(t) || containsDomainLike(t, hosts) || PRICE_TEXT.test(t)) return null;
  if (noInvented && INVENTED_FACT.test(t)) return null;
  return t;
}

const CONTACT_TITLE = /^(?:contact(?:\s+us)?|get\s+in\s+touch|reach\s+us|request\s+(?:a\s+)?(?:quote|estimate|service|appointment)|book(?:\s+now|\s+online|\s+an?\s+appointment)?)$/i;
const CATEGORY_RANK: Record<PageCategory, number> = { core: 0, service: 1, resource: 2, location: 3, legal: 4 };

const SKU_FOR_CATEGORY: Partial<Record<PageCategory, string>> = { location: 'page-location', legal: 'page-legal', service: 'page-service' };

export function verifyStructure(raw: StructureOutput, ctx: VerifyContext): VerifiedStructure {
  const repairs: string[] = [];
  const note = (s: string) => repairs.push(s);
  const bySku = new Map(ctx.catalog.map((c) => [c.sku, c]));
  const pageSkuOk = (sku: string) => bySku.get(sku)?.kind === 'page';
  const has = (sku: string) => bySku.has(sku);

  const ct = (v: unknown, max: number) => cleanText(v, max, ctx.hosts, true);

  // ---- 1. Sanitize pages, normalize ids ----
  // idMap: the id the model used -> the id we ended up with, so parent links and article
  // references survive renames and de-duplication.
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  let pages: PageNode[] = [];
  for (const p of raw.pages) {
    const title = cleanText(p.title, 60, ctx.hosts);
    if (!title) { note(`dropped page with unsafe or empty title`); continue; }
    const wanted = slugify(p.id || title) || 'page';
    let id = wanted;
    for (let n = 2; usedIds.has(id); n++) id = `${wanted.slice(0, 36)}-${n}`;
    usedIds.add(id);
    if (!idMap.has(wanted)) idMap.set(wanted, id);
    const evidence = [...new Set(p.evidence)].filter((e) => ctx.factIds.has(e)).slice(0, 4);
    let basis: Basis = p.basis;
    if (basis === 'evidence' && evidence.length === 0) { basis = 'reasonable_recommendation'; note(`${id}: evidence basis without valid evidence`); }
    if (basis === 'intake' && ctx.services.length === 0) basis = 'reasonable_recommendation';
    pages.push({
      id, parentId: p.parentId ? slugify(p.parentId) : null, title,
      slug: slugify(p.slug || title),
      category: p.category, classification: p.classification, sku: p.sku,
      purpose: ct(p.purpose, 220) ?? `${title} page`,
      why: ct(p.why, 260) ?? 'Recommended based on what you told me about your business.',
      primaryCta: ct(p.primaryCta, 60) ?? 'Contact us',
      evidence, basis,
    });
  }
  for (const p of pages) if (p.parentId) p.parentId = idMap.get(p.parentId) ?? p.parentId;

  /** Renames a page everywhere: its id, its children's parent links, and the id map. */
  const rename = (from: string, to: string) => {
    for (const p of pages) { if (p.id === from) p.id = to; if (p.parentId === from) p.parentId = to; }
    for (const [k, v] of idMap) if (v === from) idMap.set(k, to);
    usedIds.delete(from); usedIds.add(to);
  };
  const freeId = (base: string) => { let id = base; for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`; return id; };

  // ---- 2. Home, contact ----
  let home = pages.find((p) => p.id === 'home') ?? pages.find((p) => p.parentId === null && (p.slug === '' || /^home$/i.test(p.title)));
  if (!home) {
    home = { id: 'home', parentId: null, title: 'Home', slug: '', category: 'core', classification: 'core', sku: 'page-standard', purpose: 'Explain what the business does and send visitors to the main action.', why: 'Every website needs a clear front door.', primaryCta: 'Contact us', evidence: [], basis: 'reasonable_recommendation' };
    const owner = pages.find((p) => p.id === 'home');
    if (owner) rename('home', freeId('home-page'));
    pages.unshift(home);
    usedIds.add('home');
    note('added missing home page');
  } else if (home.id !== 'home') {
    const owner = pages.find((p) => p.id === 'home' && p !== home);
    if (owner) rename('home', freeId('home-page'));
    rename(home.id, 'home');
  }
  home.parentId = null; home.slug = ''; home.category = 'core'; home.classification = 'core';
  pages = [home, ...pages.filter((p) => p !== home)];
  for (const p of pages) if (p !== home) {
    if (p.parentId === null || p.parentId === p.id || !pages.some((q) => q.id === p.parentId)) p.parentId = 'home';
  }

  // Exactly one contact page, with the id "contact", directly under Home (so removing any other
  // page can never take it with it). Matched by id, slug or an unambiguous title; "Contact
  // Lenses" is a service page, not the contact page.
  const contactMatch = pages.find((p) => p !== home && (p.id === 'contact' || p.slug === 'contact' || CONTACT_TITLE.test(p.title)));
  if (contactMatch) {
    const squatter = pages.find((p) => p.id === 'contact' && p !== contactMatch);
    if (squatter) rename('contact', freeId('contact-page'));
    if (contactMatch.id !== 'contact') rename(contactMatch.id, 'contact');
    contactMatch.parentId = 'home'; contactMatch.slug = 'contact'; contactMatch.category = 'core'; contactMatch.classification = 'core';
    if (contactMatch.sku !== 'page-advanced') contactMatch.sku = 'page-standard';
  } else {
    const squatter = pages.find((p) => p.id === 'contact');
    if (squatter) rename('contact', freeId('contact-page'));
    pages.push({ id: 'contact', parentId: 'home', title: 'Contact', slug: 'contact', category: 'core', classification: 'core', sku: 'page-standard', purpose: 'Make it easy to call, request a quote or send a message.', why: 'Visitors who are ready to act need an obvious next step.', primaryCta: 'Request a quote', evidence: [], basis: 'reasonable_recommendation' });
    usedIds.add('contact');
    note('added missing contact page');
  }

  // ---- 3. Break cycles, cap depth ----
  const byId = () => new Map(pages.map((p) => [p.id, p]));
  const depthOf = (p: PageNode, map: Map<string, PageNode>): number => {
    let d = 0; let cur: PageNode | undefined = p; const seen = new Set<string>();
    while (cur && cur.parentId !== null) {
      if (seen.has(cur.id)) return Infinity;
      seen.add(cur.id);
      cur = map.get(cur.parentId); d++;
    }
    return d;
  };
  for (const p of pages) {
    const map = byId();
    if (p.id !== 'home' && depthOf(p, map) === Infinity) { p.parentId = 'home'; note(`${p.id}: broke parent cycle`); }
  }
  for (let guard = 0; guard < 200; guard++) {
    const map = byId();
    const deep = pages.find((p) => depthOf(p, map) > MAX_DEPTH);
    if (!deep) break;
    deep.parentId = map.get(deep.parentId!)?.parentId ?? 'home';
    note(`${deep.id}: reparented to cap depth`);
  }

  // ---- 4. Catalog SKUs and category consistency ----
  for (const p of pages) {
    const forced = SKU_FOR_CATEGORY[p.category];
    if (forced && has(forced) && p.sku !== 'page-advanced') { if (p.sku !== forced) note(`${p.id}: sku set to ${forced}`); p.sku = forced; }
    else if (!pageSkuOk(p.sku)) { p.sku = 'page-standard'; note(`${p.id}: invalid sku replaced`); }
  }

  // ---- 5. Location pages only with a service area, capped ----
  let locations = 0;
  pages = pages.filter((p) => {
    if (p.category !== 'location') return true;
    if (!ctx.serviceArea || ++locations > MAX_LOCATION_PAGES) { note(`${p.id}: location page dropped`); return false; }
    return true;
  });
  // children of dropped pages go to home
  const alive = new Set(pages.map((p) => p.id));
  for (const p of pages) if (p.parentId && !alive.has(p.parentId)) p.parentId = 'home';

  // ---- 6. Unique slugs among siblings; empty slugs repaired ----
  const slugSeen = new Set<string>();
  for (const p of pages) {
    if (p.id === 'home') continue;
    let slug = p.slug || slugify(p.title) || p.id;
    const base = slug;
    for (let n = 2; slugSeen.has(`${p.parentId}/${slug}`); n++) slug = `${base}-${n}`.slice(0, 60);
    slugSeen.add(`${p.parentId}/${slug}`);
    p.slug = slug;
  }

  // ---- 7. Exactly five core pages where possible (home and contact always among them) ----
  const musts = new Set(['home', 'contact']);
  for (const p of pages) if (musts.has(p.id)) p.classification = 'core';
  const core = pages.filter((p) => p.classification === 'core');
  if (core.length > CORE_PAGES) {
    let extra = core.length - CORE_PAGES;
    for (const p of [...core].reverse()) {
      if (extra === 0) break;
      if (musts.has(p.id)) continue;
      p.classification = 'recommended'; extra--; note(`${p.id}: demoted from core`);
    }
  } else if (core.length < CORE_PAGES) {
    // Promote the most foundational pages first (core > service > resource > location > legal).
    const candidates = pages.filter((q) => q.classification !== 'core')
      .map((q, i) => ({ q, rank: [q.classification === 'recommended' ? 0 : 1, q.parentId === 'home' ? 0 : 1, CATEGORY_RANK[q.category], i] }))
      .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] || a.rank[3] - b.rank[3]);
    for (const { q } of candidates.slice(0, CORE_PAGES - core.length)) { q.classification = 'core'; note(`${q.id}: promoted to core`); }
  }

  // ---- 8. Page cap: drop the least important leaves first ----
  while (pages.length > MAX_PAGES) {
    const map = byId();
    const parents = new Set(pages.map((p) => p.parentId));
    const removable = pages.filter((p) => p.classification !== 'core' && !parents.has(p.id))
      .map((p) => ({ p, rank: [p.classification === 'future' ? 0 : 1, -depthOf(p, map), -pages.indexOf(p)] }))
      .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2]);
    if (removable.length === 0) break;
    pages = pages.filter((p) => p !== removable[0].p);
    note(`${removable[0].p.id}: dropped to respect page cap`);
  }

  // ---- 9. Articles ----
  const pageIds = new Set(pages.map((p) => p.id));
  const artIds = new Set<string>(); // article ids never collide with page ids: costs are keyed by id
  const articles: ArticleNode[] = [];
  for (const a of raw.articles) {
    if (articles.length >= MAX_ARTICLES) break;
    const title = cleanText(a.title, 100, ctx.hosts);
    const question = ct(a.customerQuestion, 180);
    const wantedRelated = slugify(a.relatedPageId);
    const related = idMap.get(wantedRelated) ?? wantedRelated;
    if (!title || !question || !pageIds.has(related)) { note('dropped article'); continue; }
    const wanted = slugify(a.id || title) || 'article';
    let id = pageIds.has(wanted) ? `${wanted.slice(0, 30)}-article` : wanted;
    for (let n = 2; artIds.has(id) || pageIds.has(id); n++) id = `${wanted.slice(0, 30)}-article-${n}`;
    artIds.add(id);
    articles.push({
      id, title, customerQuestion: question, relatedPageId: related, priority: a.priority,
      conversionPath: ct(a.conversionPath, 140) ?? 'Leads readers to the related service page.',
      why: ct(a.why, 200) ?? 'Answers a question customers ask before buying.',
    });
  }

  // ---- 10. Add-ons: every catalog add-on appears once, with a reason ----
  const addons: AddonNode[] = [];
  const addonSkus = ctx.catalog.filter((c) => c.kind === 'addon');
  const proposed = new Map<string, StructureOutput['addons'][number]>();
  for (const a of raw.addons) if (bySku.get(a.sku)?.kind === 'addon' && !proposed.has(a.sku)) proposed.set(a.sku, a);
  let recommendedCount = 0;
  const ecommerce = raw.websiteTypeSku === 'site-ecommerce' || ctx.primaryGoal === 'sales';
  for (const item of addonSkus) {
    const a = proposed.get(item.sku);
    let recommended = a?.recommended ?? false;
    let reason = (a && ct(a.reason, 240)) || (a ? '' : item.description || 'Not needed based on what you told me.');
    if (item.sku === 'addon-payments' && recommended && !ecommerce) { recommended = false; reason = 'Only needed if you sell online.'; note('payments recommended without an online-sales goal'); }
    if (recommended && ++recommendedCount > MAX_RECOMMENDED_ADDONS) { recommended = false; reason = reason || item.description; note(`${item.sku}: not recommended (cap)`); }
    addons.push({
      sku: item.sku, recommended,
      reason: reason || (recommended ? 'Recommended for your business.' : 'Not needed based on what you told me.'),
      evidence: a ? [...new Set(a.evidence)].filter((e) => ctx.factIds.has(e)).slice(0, 4) : [],
    });
  }

  const websiteTypeSku = bySku.get(raw.websiteTypeSku)?.kind === 'website_type' ? raw.websiteTypeSku : null;
  return {
    websiteTypeSku,
    audience: ct(raw.audience, 200) ?? 'Local customers looking for this service.',
    strategy: ct(raw.strategy, 400) ?? 'A clear, fast website that turns visitors into calls and requests.',
    pages, articles, addons, repairs,
  };
}

/** Path of every page from the parent chain: home "/", others "/parent/child". */
export function pathsOf(pages: { id: string; parentId: string | null; slug: string }[]): Map<string, string> {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out = new Map<string, string>();
  for (const p of pages) {
    const parts: string[] = [];
    let cur: typeof p | undefined = p;
    for (let i = 0; cur && cur.parentId !== null && i < 10; i++) { parts.unshift(cur.slug); cur = byId.get(cur.parentId); }
    out.set(p.id, `/${parts.join('/')}`);
  }
  return out;
}

export type { PageDraft };

// ---------------------------------------------------------------------------
// Page content (pass 2)
// ---------------------------------------------------------------------------

import type { ContentOutput, ContentSection } from './types.js';

/** Sanitized sections per requested page id. Pages the model skipped or filled with junk are simply absent. */
export function verifyContent(raw: ContentOutput, requestedIds: string[], hosts: string[] = []): Map<string, ContentSection[]> {
  const wanted = new Set(requestedIds);
  const out = new Map<string, ContentSection[]>();
  for (const p of raw.pages) {
    const id = slugify(p.id);
    if (!wanted.has(id) || out.has(id)) continue;
    const sections: ContentSection[] = [];
    for (const s of p.sections.slice(0, 7)) {
      const heading = cleanText(s.heading, 80, hosts);
      if (!heading || INVENTED_FACT.test(heading)) continue;
      const subsections = s.subsections.slice(0, 5).flatMap((sub) => {
        const h = cleanText(sub.heading, 80, hosts);
        const c = cleanText(sub.content, 260, hosts);
        return h && c && !INVENTED_FACT.test(h) && !INVENTED_FACT.test(c) ? [{ heading: h, content: c }] : [];
      });
      const purpose = cleanText(s.purpose, 180, hosts);
      sections.push({ heading, purpose: purpose && !INVENTED_FACT.test(purpose) ? purpose : '', subsections });
    }
    if (sections.length > 0) out.set(id, sections);
  }
  return out;
}

/** Used when a page's content could not be written or verified: an honest skeleton, flagged `outline_only`. */
export function outlineFor(page: { title: string; purpose: string; primaryCta: string }): ContentSection[] {
  return [
    { heading: 'Overview', purpose: page.purpose, subsections: [] },
    { heading: 'What to include', purpose: `Content for ${page.title.toLowerCase()} will be outlined with the Webmaxxers team.`, subsections: [] },
    { heading: 'Next step', purpose: page.primaryCta, subsections: [] },
  ];
}
