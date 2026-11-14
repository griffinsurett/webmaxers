// src/components/BlueprintAgent/adapter.ts
// Turns the server's blueprint into what the screen draws. Pure and display-only:
//  - every dollar comes from the server's price breakdown; nothing here calculates a price
//  - everything is derived (grouping, counts, evidence text), never stored back
import type { WireAddon, WireArticle, WireBlueprint, WireContentSection, WirePage, WireResearch } from './wire';

/** Pages the server never lets a visitor remove (backend refine.ts ESSENTIAL). */
const ESSENTIAL_PAGE_IDS = new Set(['home', 'contact']);

export interface ViewPage {
  id: string;
  title: string;
  path: string;
  category: WirePage['category'];
  classification: WirePage['classification'];
  purpose: string;
  why: string;
  cta: string;
  sections: WireContentSection[];
  outlineOnly: boolean;
  /** The research facts this page's recommendation rests on, in plain words. */
  evidence: string[];
  estimatedCost: number;
  included: boolean;
  removable: boolean;
}

export interface ViewAddon {
  sku: string;
  name: string;
  purpose: string;
  setupCost: number;
  monthlyCost: number;
  recommended: boolean;
  reason: string;
  evidence: string[];
  included: boolean;
}

export interface ViewPrice {
  websiteName: string;
  base: number;
  includedPages: number;
  extraPagesCount: number;
  extraPages: number;
  content: number;
  addonSetup: number;
  total: number;
  monthly: number;
}

export interface ViewCostLine { id: string; title: string; amount: number; monthly: number; note?: string }

/** The server's itemised price, for the "Project Cost" tab. Every figure is the server's. */
export interface ViewBreakdown {
  package: { name: string; base: number; includedPages: number };
  covered: ViewCostLine[];
  extraPages: ViewCostLine[];
  content: ViewCostLine[];
  addons: ViewCostLine[];
  cheaper?: { name: string; initialInvestment: number; saves: number };
}

export interface ViewBlueprint {
  summary: WireBlueprint['summary'];
  /** Core pages, recommended pages and "future ideas" (optional pages the visitor can switch on). */
  groups: { core: ViewPage[]; recommended: ViewPage[]; future: ViewPage[] };
  pages: ViewPage[];
  addons: ViewAddon[];
  articles: WireArticle[];
  price: ViewPrice;
  breakdown: ViewBreakdown;
  includedPageCount: number;
  includedAddonCount: number;
  notices: string[];
  /** True when some research could not be completed: the plan leans more on what the visitor said. */
  partial: boolean;
}

const MAX_EVIDENCE = 3;

export function toViewBlueprint(bp: WireBlueprint): ViewBlueprint {
  const facts = new Map(bp.facts.map((f) => [f.id, f.text]));
  const evidenceOf = (ids: string[]) => ids.map((id) => facts.get(id)).filter((t): t is string => !!t).slice(0, MAX_EVIDENCE);

  const pages: ViewPage[] = bp.pages.map((p) => ({
    id: p.id,
    title: p.title,
    path: p.path || (p.slug ? `/${p.slug}` : '/'),
    category: p.category,
    classification: p.classification,
    purpose: p.purpose,
    why: p.whyRecommended,
    cta: p.primaryCta,
    sections: Array.isArray(p.sections) ? p.sections : [],
    outlineOnly: p.contentStatus === 'outline_only',
    evidence: evidenceOf(p.evidence ?? []),
    estimatedCost: p.estimatedCost,
    included: p.included,
    removable: !ESSENTIAL_PAGE_IDS.has(p.id),
  }));

  const addons: ViewAddon[] = bp.addons.map((a: WireAddon) => ({
    sku: a.sku, name: a.name, purpose: a.purpose, setupCost: a.setupCost, monthlyCost: a.monthlyCost,
    recommended: a.recommended, reason: a.reason, evidence: evidenceOf(a.evidence ?? []), included: a.included,
  }));

  const t = bp.pricing.totals;
  return {
    summary: bp.summary,
    groups: {
      core: pages.filter((p) => p.classification === 'core'),
      recommended: pages.filter((p) => p.classification === 'recommended'),
      future: pages.filter((p) => p.classification === 'future'),
    },
    pages,
    addons,
    articles: bp.articles,
    price: {
      websiteName: bp.pricing.websiteType.name,
      base: t.base,
      includedPages: bp.pricing.websiteType.includedPages,
      extraPagesCount: bp.pricing.extraPages.length,
      extraPages: t.extraPages,
      content: t.content,
      addonSetup: t.addonSetup,
      total: t.initialInvestment,
      monthly: t.monthly,
    },
    breakdown: {
      package: { name: bp.pricing.websiteType.name, base: t.base, includedPages: bp.pricing.websiteType.includedPages },
      covered: bp.pricing.pagesCoveredByBase ?? [],
      extraPages: bp.pricing.extraPages ?? [],
      content: bp.pricing.content ?? [],
      addons: bp.pricing.addons ?? [],
      cheaper: bp.pricing.cheaperWebsiteType
        ? { name: bp.pricing.cheaperWebsiteType.name, initialInvestment: bp.pricing.cheaperWebsiteType.initialInvestment, saves: bp.pricing.cheaperWebsiteType.saves }
        : undefined,
    },
    includedPageCount: pages.filter((p) => p.included).length,
    includedAddonCount: addons.filter((a) => a.included).length,
    notices: bp.notices,
    partial: bp.status === 'partial',
  };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export function estimateText(price: Pick<ViewPrice, 'total' | 'monthly'>): string {
  return `${money(price.total)} upfront${price.monthly > 0 ? ` plus ${money(price.monthly)} a month` : ''}`;
}

export function describeBlueprint(v: ViewBlueprint, demo = false): string {
  if (demo) {
    return `Here is the example plan: ${v.includedPageCount} page${v.includedPageCount === 1 ? '' : 's'} and ${v.includedAddonCount} add-on${v.includedAddonCount === 1 ? '' : 's'}. `
      + `The example estimate is ${estimateText(v.price)}. This is a sample business, not a quote for yours. `
      + `Click ✕ on any page, or switch add-ons on and off, to see how the example price changes.`;
  }
  const adds = v.includedAddonCount > 0 ? ` and ${v.includedAddonCount} add-on${v.includedAddonCount === 1 ? '' : 's'}` : '';
  return `Your blueprint is ready: ${v.includedPageCount} page${v.includedPageCount === 1 ? '' : 's'}${adds}. `
    + `Your estimate is ${estimateText(v.price)}. `
    + `Click ✕ on any page, or switch add-ons on and off, and the price updates. You can also just tell me what to change.`;
}

/** A short plain-text recap of the competitor research, written from the server's verified findings. */
export function describeResearch(r: WireResearch, demo = false): string {
  if (demo) {
    return `Here are ${r.sites.length} made-up example competitors (this is not real research): ${r.sites.map((s) => s.host).join(', ')}.\n\nNow I'll show the example plan.`;
  }
  const competitors = r.sites.filter((s) => s.role === 'competitor');
  const readable = competitors.filter((s) => s.status !== 'failed');
  if (competitors.length === 0 || readable.length === 0) {
    return "I couldn't read any competitor websites, so I'll build your plan from what you've told me.";
  }
  const names = readable.map((s) => s.host).join(', ');
  const lines = [`I looked at ${readable.length} competitor website${readable.length === 1 ? '' : 's'}: ${names}.`];
  const notes = (r.findings?.opportunities ?? []).filter((o) => o.support === 'evidenced').slice(0, 2).map((o) => o.point).filter(Boolean);
  if (notes.length > 0) lines.push(`What stood out:\n${notes.map((n) => `• ${n}`).join('\n')}`);
  lines.push("Now I'll build your blueprint.");
  return lines.join('\n\n');
}
