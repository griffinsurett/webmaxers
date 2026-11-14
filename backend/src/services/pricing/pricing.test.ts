// Pricing engine tests against the demo seed (no database needed). Run: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CatalogItem, PricedSelection } from '../../types/index.js';
import { PricingError, pricingService } from './index.js';

const seed = JSON.parse(
  readFileSync(new URL('../../../kb/demo-pricing.json', import.meta.url), 'utf8'),
);
const catalog: CatalogItem[] = seed.items.map((i: any) => ({
  sku: i.sku, kind: i.kind, name: i.name, description: i.description ?? '',
  price: i.price ?? 0, setup: i.setup ?? 0, monthly: i.monthly ?? 0,
  includedPages: i.included_pages ?? null, unit: i.unit ?? 'each',
  version: seed.version, metadata: i.metadata ?? {},
}));

const core = (id: string, sku = 'page-standard'): PricedSelection =>
  ({ id, sku, included: true, classification: 'core' });
const rec = (id: string, sku = 'page-service', included = true): PricedSelection =>
  ({ id, sku, included, classification: 'recommended' });
const fiveCore = ['home', 'about', 'services', 'projects', 'contact'].map((id) => core(id));

test('five core pages cost exactly the starter base price', () => {
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages: fiveCore }, catalog);
  assert.equal(r.totals.initialInvestment, 1250);
  assert.equal(r.pagesCoveredByBase.length, 5);
  assert.equal(r.extraPages.length, 0);
  assert.equal(r.cheaperWebsiteType, undefined);
});

test('spec example: 5 core + 3 service pages = $2,000', () => {
  const pages = [...fiveCore, rec('replacement'), rec('repair'), rec('commercial')];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages }, catalog);
  assert.equal(r.totals.extraPages, 750);
  assert.equal(r.totals.initialInvestment, 2000);
});

test('removed (included=false) pages are not charged', () => {
  const pages = [...fiveCore, rec('replacement'), rec('repair', 'page-service', false)];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages }, catalog);
  assert.equal(r.totals.initialInvestment, 1500);
});

test('core pages fill the allowance first even if listed after recommended pages', () => {
  const pages = [rec('adv', 'page-advanced'), ...fiveCore];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages }, catalog);
  assert.deepEqual(r.extraPages.map((l) => l.id), ['adv']);
  assert.equal(r.totals.extraPages, 450);
});

test('articles auto-add the resource hub once', () => {
  const content = [1, 2, 3].map((n) => ({ id: `a${n}`, sku: 'content-article', included: true }));
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages: fiveCore, content }, catalog);
  assert.equal(r.content[0].sku, 'content-hub');
  assert.equal(r.totals.content, 300 + 3 * 150);
});

test('add-ons split setup (initial) from monthly (ongoing)', () => {
  const addons = [
    { id: 'forms', sku: 'addon-managed-forms', included: true },
    { id: 'chat', sku: 'addon-ai-chat', included: true },
    { id: 'pay', sku: 'addon-payments', included: false },
  ];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages: fiveCore, addons }, catalog);
  assert.equal(r.totals.addonSetup, 650);
  assert.equal(r.totals.monthly, 104);
  assert.equal(r.totals.initialInvestment, 1900);
});

test('suggests the business tier when it covers the pages for less', () => {
  const pages = [...fiveCore, ...[1, 2, 3, 4, 5].map((n) => rec(`svc${n}`))];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages }, catalog);
  assert.equal(r.totals.initialInvestment, 2500);
  assert.deepEqual(r.cheaperWebsiteType, {
    sku: 'site-business', name: 'Lead-Gen Business Website', initialInvestment: 2250, saves: 250,
  });
});

test('never suggests switching to e-commerce from a brochure site', () => {
  const pages = [...fiveCore, ...Array.from({ length: 12 }, (_, n) => rec(`svc${n}`))];
  const r = pricingService.calculate({ websiteTypeSku: 'site-starter', pages }, catalog);
  assert.equal(r.cheaperWebsiteType?.sku, 'site-business');
});

test('rejects unknown or wrong-kind SKUs', () => {
  assert.throws(
    () => pricingService.calculate({ websiteTypeSku: 'site-starter', pages: [core('x', 'page-made-up')] }, catalog),
    PricingError,
  );
  assert.throws(
    () => pricingService.calculate({ websiteTypeSku: 'site-starter', pages: [core('x', 'addon-crm')] }, catalog),
    PricingError,
  );
  assert.throws(() => pricingService.calculate({ websiteTypeSku: 'page-service', pages: [] }, catalog), PricingError);
});
