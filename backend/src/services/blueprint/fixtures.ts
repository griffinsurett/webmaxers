// Test fixtures shared by blueprint tests (not imported by production code).
import { readFileSync } from 'node:fs';
import type { CatalogItem } from '../../types/index.js';
import type { PageDraft, StructureOutput } from './types.js';

const seed = JSON.parse(readFileSync(new URL('../../../kb/demo-pricing.json', import.meta.url), 'utf8'));
export const catalog: CatalogItem[] = seed.items.map((i: any) => ({
  sku: i.sku, kind: i.kind, name: i.name, description: i.description ?? '',
  price: i.price ?? 0, setup: i.setup ?? 0, monthly: i.monthly ?? 0,
  includedPages: i.included_pages ?? null, unit: i.unit ?? 'each', version: seed.version, metadata: i.metadata ?? {},
}));

export const page = (id: string, over: Partial<PageDraft> = {}): PageDraft => ({
  id, parentId: 'home', title: id[0].toUpperCase() + id.slice(1).replace(/-/g, ' '), slug: id,
  category: 'service', classification: 'recommended', sku: 'page-service',
  purpose: 'Explains the service.', why: 'Customers search for it separately.', primaryCta: 'Call now',
  evidence: [], basis: 'intake', ...over,
});

export const goodStructure = (): StructureOutput => ({
  websiteTypeSku: 'site-starter',
  audience: 'Homeowners in Austin with urgent plumbing problems.',
  strategy: 'Make calling effortless and prove trust fast.',
  pages: [
    page('home', { parentId: null, slug: '', category: 'core', classification: 'core', sku: 'page-standard' }),
    page('about', { category: 'core', classification: 'core', sku: 'page-standard' }),
    page('services', { category: 'core', classification: 'core', sku: 'page-standard' }),
    page('projects', { category: 'core', classification: 'core', sku: 'page-standard' }),
    page('contact', { category: 'core', classification: 'core', sku: 'page-standard', primaryCta: 'Request a quote' }),
    page('drain-cleaning', { parentId: 'services', evidence: ['c1-F2'], basis: 'evidence' }),
    page('water-heaters', { parentId: 'services' }),
    page('round-rock', { parentId: 'home', category: 'location', sku: 'page-location', slug: 'round-rock' }),
  ],
  articles: [
    { id: 'winter-pipes', title: 'How to stop pipes freezing', customerQuestion: 'How do I stop pipes freezing?', relatedPageId: 'drain-cleaning', conversionPath: 'Links to the drain page.', priority: 'high', why: 'Seasonal demand.' },
  ],
  addons: [
    { sku: 'addon-managed-forms', recommended: true, reason: 'Quote requests are the main goal.', evidence: ['c1-F4'] },
    { sku: 'addon-booking', recommended: false, reason: 'Not needed yet.', evidence: [] },
  ],
});
