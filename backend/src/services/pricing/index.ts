// backend/src/services/pricing/index.ts
// Deterministic pricing engine. The LLM selects SKUs; every dollar comes from the
// catalog (backend/kb/demo-pricing.json → pricing_catalog). Rules (kb/pricing-rules.md):
// - The website type's base price covers `includedPages` pages.
// - Included pages fill that allowance core-first, then in sitemap order; the rest are
//   charged at their page SKU price.
// - Content and add-ons never count toward the allowance. Articles require the
//   resource hub once (added automatically if missing).
// - Monthly fees are reported separately from the initial investment.
// - If another website type of the same family covers the selection for less, say so.

import type {
  CatalogItem,
  PriceBreakdown,
  PriceLine,
  PriceRequest,
  PricedSelection,
} from '../../types/index.js';

export class PricingError extends Error {}

const HUB_SKU = 'content-hub';
const ARTICLE_SKU = 'content-article';

function familyOf(item: CatalogItem): string {
  return typeof item.metadata?.family === 'string' ? item.metadata.family : item.sku;
}

function sum(lines: PriceLine[], key: 'amount' | 'monthly'): number {
  return lines.reduce((total, l) => total + l[key], 0);
}

function priceOnce(req: PriceRequest, bySku: Map<string, CatalogItem>): PriceBreakdown {
  const lookup = (sel: PricedSelection, kinds: CatalogItem['kind'][]): CatalogItem => {
    const item = bySku.get(sel.sku);
    if (!item) throw new PricingError(`Unknown SKU "${sel.sku}" (item "${sel.id}")`);
    if (!kinds.includes(item.kind)) {
      throw new PricingError(`SKU "${sel.sku}" is a ${item.kind}, expected ${kinds.join('/')}`);
    }
    return item;
  };

  const site = bySku.get(req.websiteTypeSku);
  if (!site || site.kind !== 'website_type') {
    throw new PricingError(`Unknown website type "${req.websiteTypeSku}"`);
  }
  const allowance = site.includedPages ?? 0;

  // Pages: core first, then sitemap order (stable sort keeps the given order).
  const pages = req.pages
    .filter((p) => p.included)
    .map((p, order) => ({ sel: p, item: lookup(p, ['page']), order }))
    .sort((a, b) => {
      const ac = a.sel.classification === 'core' ? 0 : 1;
      const bc = b.sel.classification === 'core' ? 0 : 1;
      return ac - bc || a.order - b.order;
    });

  const pagesCoveredByBase: PriceLine[] = [];
  const extraPages: PriceLine[] = [];
  for (const [i, { sel, item }] of pages.entries()) {
    const title = sel.title ?? item.name;
    if (i < allowance) {
      pagesCoveredByBase.push({ id: sel.id, sku: item.sku, title, amount: 0, monthly: 0, note: `Included in ${site.name}` });
    } else {
      extraPages.push({ id: sel.id, sku: item.sku, title, amount: item.price, monthly: 0, note: item.name });
    }
  }

  const content: PriceLine[] = (req.content ?? [])
    .filter((c) => c.included)
    .map((c) => {
      const item = lookup(c, ['content']);
      return { id: c.id, sku: item.sku, title: c.title ?? item.name, amount: item.price, monthly: 0 };
    });
  const hasArticles = content.some((c) => c.sku === ARTICLE_SKU);
  const hasHub = content.some((c) => c.sku === HUB_SKU);
  const hub = bySku.get(HUB_SKU);
  if (hasArticles && !hasHub && hub) {
    content.unshift({
      id: 'auto-content-hub', sku: hub.sku, title: hub.name, amount: hub.price, monthly: 0,
      note: 'Required once before articles are published',
    });
  }

  const addons: PriceLine[] = (req.addons ?? [])
    .filter((a) => a.included)
    .map((a) => {
      const item = lookup(a, ['addon']);
      return { id: a.id, sku: item.sku, title: a.title ?? item.name, amount: item.setup, monthly: item.monthly };
    });

  const totals = {
    base: site.price,
    extraPages: sum(extraPages, 'amount'),
    content: sum(content, 'amount'),
    addonSetup: sum(addons, 'amount'),
    initialInvestment: 0,
    monthly: sum(addons, 'monthly'),
  };
  totals.initialInvestment = totals.base + totals.extraPages + totals.content + totals.addonSetup;

  return {
    catalogVersion: site.version,
    websiteType: { sku: site.sku, name: site.name, basePrice: site.price, includedPages: allowance },
    pagesSelected: pages.length,
    pagesCoveredByBase,
    extraPages,
    content,
    addons,
    totals,
  };
}

export class PricingService {
  calculate(req: PriceRequest, catalog: CatalogItem[]): PriceBreakdown {
    const bySku = new Map(catalog.map((c) => [c.sku, c]));
    const result = priceOnce(req, bySku);

    const current = bySku.get(req.websiteTypeSku)!;
    let best: PriceBreakdown | undefined;
    for (const alt of catalog) {
      if (alt.kind !== 'website_type' || alt.sku === current.sku) continue;
      if (familyOf(alt) !== familyOf(current)) continue;
      const altResult = priceOnce({ ...req, websiteTypeSku: alt.sku }, bySku);
      if (altResult.totals.initialInvestment < (best ?? result).totals.initialInvestment) {
        best = altResult;
      }
    }
    if (best) {
      result.cheaperWebsiteType = {
        sku: best.websiteType.sku,
        name: best.websiteType.name,
        initialInvestment: best.totals.initialInvestment,
        saves: result.totals.initialInvestment - best.totals.initialInvestment,
      };
    }
    return result;
  }
}

export const pricingService = new PricingService();
