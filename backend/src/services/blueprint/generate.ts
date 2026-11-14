// backend/src/services/blueprint/generate.ts (5c, 5d, 5f)
// Orchestrates blueprint generation:
//   retrieve knowledge → structure pass → verify/repair → content pass (batched) → verify →
//   price with the deterministic engine → Blueprint.
// Failure policy: the model failing never means "no blueprint". Pass 1 falls back to a
// deterministic baseline from the visitor's answers; pass 2 falls back to honest outlines.
import { pricingService } from '../pricing/index.js';
import type { CatalogItem, PriceBreakdown, PriceRequest, PricedSelection } from '../../types/index.js';
import { baselineStructure } from './baseline.js';
import { buildPlan, enforcePlan } from './plan.js';
import { buildContentPrompt, buildStructurePrompt, evidenceFacts, type BlueprintInput } from './prompts.js';
import { gatherKnowledge, type KbSearch } from './retrieval.js';
import {
  structureSchema, contentSchema,
  type Blueprint, type BlueprintAddon, type BlueprintArticle, type BlueprintLlm, type BlueprintPage, type ContentSection,
} from './types.js';
import { outlineFor, pathsOf, verifyContent, verifyStructure, type PageNode, type VerifiedStructure } from './verify.js';
import { log } from '../log/logger.js';

export const CONTENT_BATCH_SIZE = 4;
const CONTENT_CONCURRENCY = 3;
export const MIN_USABLE_PAGES = 4;
/** Articles selected by default: always this many (fewer only if fewer were proposed), best-ranked first. */
export const DEFAULT_ARTICLES = 3;

export type BlueprintEvent =
  | { type: 'step'; step: 'retrieving' | 'structuring' | 'writing' | 'pricing'; message: string }
  | { type: 'page'; done: number; total: number };

export interface GenerateDeps { llm: BlueprintLlm; search: KbSearch }

const GOAL_LABEL: Record<string, string> = {
  calls: 'More phone calls', quotes: 'More quote requests', bookings: 'More bookings',
  sales: 'More online sales', leads: 'More leads', other: 'Grow the business',
};

async function pool<T, R>(items: T[], size: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

/** Marks the stored website-type notice so it is replaced, never left stale, when pricing changes. */
export const TYPE_NOTICE_PREFIX = 'I switched your website type';

export interface PricedSelectionInput {
  websiteTypeSku: string;
  pages: { id: string; sku: string; title: string; classification: BlueprintPage['classification']; included: boolean }[];
  articles: { id: string; title: string; included: boolean }[];
  addons: { sku: string; included: boolean }[];
}

/** Prices a selection with the engine, adopting a cheaper website type of the same family when one covers it. */
export function priceSelection(sel: PricedSelectionInput, catalog: CatalogItem[]): { pricing: PriceBreakdown; websiteTypeSku: string; notice?: string } {
  const request = (websiteTypeSku: string): PriceRequest => ({
    websiteTypeSku,
    pages: sel.pages.map((p): PricedSelection => ({ id: p.id, sku: p.sku, title: p.title, included: p.included, classification: p.classification })),
    content: sel.articles.map((a): PricedSelection => ({ id: a.id, sku: 'content-article', title: a.title, included: a.included })),
    addons: sel.addons.map((a): PricedSelection => ({ id: a.sku, sku: a.sku, included: a.included })),
  });
  let pricing = pricingService.calculate(request(sel.websiteTypeSku), catalog);
  let notice: string | undefined;
  let websiteTypeSku = sel.websiteTypeSku;
  if (pricing.cheaperWebsiteType) {
    const better = pricing.cheaperWebsiteType;
    notice = `${TYPE_NOTICE_PREFIX} to ${better.name}: it covers your pages for ${dollars(better.saves)} less.`;
    websiteTypeSku = better.sku;
    pricing = pricingService.calculate(request(websiteTypeSku), catalog);
  }
  return { pricing, websiteTypeSku, notice };
}

/**
 * Re-derives pricing and every per-item estimated cost from the blueprint's CURRENT selection.
 * The single pricing routine used by generation, refinement and manual toggles, so they can
 * never disagree. A cheaper website type of the same family is adopted and explained.
 */
export function repriceBlueprint(bp: Blueprint, catalog: CatalogItem[]): { blueprint: Blueprint; notice?: string } {
  const bySku = new Map(catalog.map((c) => [c.sku, c]));
  const priced = priceSelection({
    websiteTypeSku: bp.websiteTypeSku,
    pages: bp.pages.map((p) => ({ id: p.id, sku: p.sku, title: p.title, classification: p.classification, included: p.included })),
    articles: bp.articles.map((a) => ({ id: a.id, title: a.title, included: a.included })),
    addons: bp.addons.map((a) => ({ sku: a.sku, included: a.included })),
  }, catalog);

  // Page and article costs are keyed separately: an article and a page may never share a cost slot.
  const pageCost = new Map<string, number>();
  for (const l of [...priced.pricing.extraPages, ...priced.pricing.pagesCoveredByBase]) pageCost.set(l.id, l.amount);
  const articlePrice = bySku.get('content-article')?.price ?? 0;
  // The website-type notice describes the CURRENT pricing, so a previous one is replaced.
  const notices = bp.notices.filter((n) => !n.startsWith(TYPE_NOTICE_PREFIX));
  if (priced.notice) notices.push(priced.notice);
  return {
    notice: priced.notice,
    blueprint: {
      ...bp,
      notices,
      websiteTypeSku: priced.websiteTypeSku,
      pricing: priced.pricing,
      pages: bp.pages.map((p) => ({ ...p, estimatedCost: p.included ? (pageCost.get(p.id) ?? 0) : (bySku.get(p.sku)?.price ?? 0) })),
      articles: bp.articles.map((a) => ({ ...a, estimatedCost: articlePrice })),
      addons: bp.addons.map((a) => {
        const item = bySku.get(a.sku);
        return item ? { ...a, setupCost: item.setup, monthlyCost: item.monthly } : a;
      }),
    },
  };
}

export async function generateBlueprint(
  input: BlueprintInput, deps: GenerateDeps, emit: (e: BlueprintEvent) => void = () => {}, signal?: AbortSignal,
): Promise<Blueprint> {
  const { slots, catalog } = input;
  const notices: string[] = [];
  let status: Blueprint['status'] = 'complete';
  const facts = evidenceFacts(input.research);
  const factMap = new Map(facts.map((f) => [f.id, f]));
  const hosts = input.research?.sites.map((s) => s.host) ?? [];

  // 5b. Knowledge.
  signal?.throwIfAborted();
  emit({ type: 'step', step: 'retrieving', message: 'Gathering what I know about sites like yours…' });
  const knowledge = await gatherKnowledge(slots, deps.search).catch(() => []);

  // 5c. Structure, with a deterministic fallback.
  signal?.throwIfAborted();
  emit({ type: 'step', step: 'structuring', message: 'Planning your sitemap…' });
  const plan = buildPlan(slots, input.research, catalog);
  const structurePrompt = buildStructurePrompt(input, knowledge, plan);
  const ctx = {
    catalog, factIds: structurePrompt.shownFactIds, serviceArea: slots.serviceArea, services: slots.services, primaryGoal: slots.primaryGoal, hosts,
  };
  let draft: VerifiedStructure | null = null;
  try {
    const raw = structureSchema.parse(await deps.llm.structure(structurePrompt, signal));
    const verified = verifyStructure(raw, ctx);
    if (verified.pages.length >= MIN_USABLE_PAGES) draft = verified;
  } catch (err) {
    if (signal?.aborted) throw err; // a cancelled run must not quietly turn into a baseline
    log.warn('structure pass failed', { err });
  }
  if (!draft) {
    draft = verifyStructure(baselineStructure(slots), ctx);
    status = 'partial';
    notices.push("I couldn't finish the detailed plan, so this blueprint is built from your answers. We'll refine it on your strategy call.");
  }

  // Rules decide what they can (core pages, service and area pages, add-ons); the model's wording is kept where it agrees.
  draft = enforcePlan(draft, plan, slots);

  // 5d. Content, batched.
  emit({ type: 'step', step: 'writing', message: 'Outlining each page…' });
  const batches: PageNode[][] = [];
  for (let i = 0; i < draft.pages.length; i += CONTENT_BATCH_SIZE) batches.push(draft.pages.slice(i, i + CONTENT_BATCH_SIZE));
  const written = new Map<string, ContentSection[]>();
  let done = 0;
  emit({ type: 'page', done, total: draft.pages.length });
  await pool(batches, CONTENT_CONCURRENCY, async (batch) => {
    signal?.throwIfAborted();
    try {
      const raw = contentSchema.parse(await deps.llm.content(buildContentPrompt(input, batch, draft!.audience, draft!.strategy, factMap), signal));
      for (const [id, sections] of verifyContent(raw, batch.map((p) => p.id), hosts)) written.set(id, sections);
    } catch (err) {
      if (signal?.aborted) throw err;
      log.warn('content pass failed', { err });
    }
    done += batch.length;
    emit({ type: 'page', done, total: draft!.pages.length });
  });
  if (draft.pages.some((p) => !written.has(p.id))) {
    status = 'partial';
    notices.push('Some pages only have a short outline for now; the Webmaxxers team will fill in the detail.');
  }

  // 5f. Price.
  signal?.throwIfAborted();
  emit({ type: 'step', step: 'pricing', message: 'Working out your price…' });
  const paths = pathsOf(draft.pages);
  const bySku = new Map(catalog.map((c) => [c.sku, c]));
  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  // A fixed count, ranked by the model's priority label then its order: the number of selected articles (and so the price)
  // cannot swing with how many articles the model happened to label "high".
  const defaultArticles = new Set(
    draft.articles.map((a, i) => ({ a, i })).sort((x, y) => priorityRank[x.a.priority] - priorityRank[y.a.priority] || x.i - y.i).slice(0, DEFAULT_ARTICLES).map(({ a }) => a.id),
  );

  const typeSku = plan.websiteTypeSku; // decided by rules; the pricing engine adopts a cheaper type of the same family

  const pages: BlueprintPage[] = draft.pages.map((p) => {
    const sections = written.get(p.id);
    return {
      id: p.id, parentId: p.parentId, title: p.title, slug: p.slug, path: paths.get(p.id) ?? '/',
      category: p.category, classification: p.classification, sku: p.sku,
      purpose: p.purpose, whyRecommended: p.why, primaryCta: p.primaryCta,
      sections: sections ?? outlineFor(p), contentStatus: sections ? 'written' : 'outline_only',
      evidence: p.evidence, basis: p.basis, included: p.classification !== 'future', estimatedCost: 0,
    };
  });
  const articles: BlueprintArticle[] = draft.articles.map((a) => ({ ...a, included: defaultArticles.has(a.id), estimatedCost: 0 }));
  const addons: BlueprintAddon[] = draft.addons.flatMap((a) => {
    const item = bySku.get(a.sku);
    return item ? [{
      sku: a.sku, name: item.name, category: String(item.metadata?.category ?? 'forms'), purpose: item.description,
      setupCost: item.setup, monthlyCost: item.monthly, recommended: a.recommended, reason: a.reason,
      evidence: a.evidence, included: a.recommended,
    }] : [];
  });

  const cited = new Set([...pages.flatMap((p) => p.evidence), ...addons.flatMap((a) => a.evidence)]);
  const competitor = input.research?.sites.find((s) => s.role === 'competitor' && s.status !== 'failed');
  const assembled: Blueprint = {
    version: 1,
    summary: {
      businessName: slots.businessName ?? 'Your business',
      industry: slots.industry ?? '',
      serviceArea: slots.serviceArea ?? '',
      existingUrl: slots.ownUrl,
      competitorUrl: competitor?.url,
      primaryGoal: GOAL_LABEL[slots.primaryGoal ?? 'other'] ?? 'Grow the business',
      primaryAudience: draft.audience,
      recommendedStrategy: draft.strategy,
    },
    websiteTypeSku: typeSku,
    pages, articles, addons,
    pricing: undefined as never, // filled in by repriceBlueprint below
    facts: [...cited].flatMap((id) => (factMap.has(id) ? [factMap.get(id)!] : [])),
    notices, status, generatedAt: new Date().toISOString(),
  };
  return repriceBlueprint(assembled, catalog).blueprint; // also records the website-type notice, if any
}
