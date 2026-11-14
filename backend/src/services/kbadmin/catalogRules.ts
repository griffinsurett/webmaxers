// backend/src/services/kbadmin/catalogRules.ts
// What the rest of the backend already assumes about the price catalog. Publishing an upload must
// never leave the catalog in a state that breaks quoting, so the result is checked against this
// before anything is written.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogKind } from '../../types/index.js';

/** Items named directly in the pricing engine, page verification, refinement and the offline blueprint. */
const CODE_REQUIRED = [
  'site-starter', 'site-ecommerce',
  'page-standard', 'page-service', 'page-location', 'page-advanced', 'page-legal',
  'content-article', 'content-hub',
  'addon-managed-forms', 'addon-booking', 'addon-payments',
];

const RULES_PATH = fileURLToPath(new URL('../../../kb/blueprint-rules.json', import.meta.url));
const SKU_LIKE = /^(site|page|content|addon)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function collectSkus(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') { if (SKU_LIKE.test(value)) out.add(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectSkus(v, out); return; }
  if (value && typeof value === 'object') for (const v of Object.values(value)) collectSkus(v, out);
}

let cached: string[] | null = null;

/** Every item the code or the blueprint rules refer to by name. They must always exist. */
export function requiredSkus(): string[] {
  if (cached) return cached;
  const all = new Set(CODE_REQUIRED);
  try {
    collectSkus(JSON.parse(readFileSync(RULES_PATH, 'utf8')), all);
  } catch {
    // Rules unreadable: the code-required set still protects the engine.
  }
  return (cached = [...all].sort());
}

const KIND_OF_PREFIX: Record<string, CatalogKind> = { site: 'website_type', page: 'page', content: 'content', addon: 'addon' };

/** Problems that would stop the backend quoting correctly with this catalog. Empty means fine. */
export function validateCatalog(catalog: CatalogItem[], required: string[] = requiredSkus()): string[] {
  const problems: string[] = [];
  const bySku = new Map(catalog.map((c) => [c.sku, c]));

  const missing = required.filter((sku) => !bySku.has(sku));
  if (missing.length) problems.push(`These items are required by the agent and are missing: ${missing.join(', ')}.`);

  for (const item of catalog) {
    const expected = KIND_OF_PREFIX[item.sku.split('-')[0]];
    if (expected && item.kind !== expected) problems.push(`${item.sku} must be a ${expected.replace('_', ' ')}.`);
    for (const f of ['price', 'setup', 'monthly'] as const) {
      if (!Number.isFinite(item[f]) || item[f] < 0) problems.push(`${item.sku} has an invalid ${f}.`);
    }
    if (item.kind === 'website_type') {
      if (item.includedPages === null || !Number.isInteger(item.includedPages) || item.includedPages < 0) problems.push(`${item.sku} needs a whole number of included pages.`);
      if (!(item.price > 0)) problems.push(`${item.sku} needs a base price above zero.`);
    }
  }
  if (!catalog.some((c) => c.kind === 'website_type')) problems.push('There must be at least one website type.');
  return problems;
}
