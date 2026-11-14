// What the agent depends on in the price catalog, and the guidance chunker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CatalogItem } from '../../types/index.js';
import { requiredSkus, validateCatalog } from './catalogRules.js';
import { readdirSync } from 'node:fs';
import { MAX_CHUNKS, chunkGuidance } from './chunker.js';
import { numbersIn } from './pricingVerify.js';

const seed = JSON.parse(readFileSync(new URL('../../../kb/demo-pricing.json', import.meta.url), 'utf8'));
const catalog: CatalogItem[] = seed.items.map((i: any) => ({
  sku: i.sku, kind: i.kind, name: i.name, description: '', price: i.price ?? 0, setup: i.setup ?? 0, monthly: i.monthly ?? 0,
  includedPages: i.included_pages ?? null, unit: 'each', version: 'v', metadata: {},
}));
const without = (...skus: string[]) => catalog.filter((c) => !skus.includes(c.sku));

test('the shipped catalog satisfies everything the agent depends on (so the rule list matches reality)', () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test('required items include the ones named in code and in the blueprint rules', () => {
  const req = requiredSkus();
  for (const sku of ['site-starter', 'page-standard', 'page-service', 'content-hub', 'content-article', 'addon-managed-forms']) assert.ok(req.includes(sku), sku);
  for (const sku of ['addon-crm', 'addon-ai-chat', 'addon-quote-system']) assert.ok(req.includes(sku), `${sku} comes from kb/blueprint-rules.json`);
});

test('removing a required item is reported by name', () => {
  const problems = validateCatalog(without('page-service', 'addon-crm'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /page-service/);
  assert.match(problems[0], /addon-crm/);
});

test('a website type needs included pages and a base price; kinds must match the code prefix; amounts must be valid', () => {
  const broken = catalog.map((c) => (c.sku === 'site-starter' ? { ...c, includedPages: null, price: 0 } : c));
  const problems = validateCatalog(broken);
  assert.ok(problems.some((p) => p.includes('included pages')));
  assert.ok(problems.some((p) => p.includes('base price')));
  assert.ok(validateCatalog(catalog.map((c) => (c.sku === 'page-legal' ? { ...c, kind: 'addon' as const } : c))).some((p) => p.includes('page-legal must be a page')));
  assert.ok(validateCatalog(catalog.map((c) => (c.sku === 'page-legal' ? { ...c, price: -1 } : c))).some((p) => p.includes('invalid price')));
  assert.ok(validateCatalog([]).some((p) => p.includes('at least one website type')));
});

// ---- one source of truth for figures ---------------------------------------

test('the shipped guidance files carry no dollar amounts, so a price update can never leave them out of date', () => {
  const dir = new URL('../../../kb/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 3);
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /\$\s?\d/, `${f} contains a dollar amount`);
});

test('no catalog description repeats one of its own figures (they would contradict the next price update)', () => {
  for (const item of catalog) {
    const own = [item.price, item.setup, item.monthly, item.includedPages].filter((v): v is number => typeof v === 'number' && v > 0);
    const described = numbersIn(seed.items.find((i: any) => i.sku === item.sku).description ?? '');
    assert.deepEqual(described.filter((n) => own.includes(n)), [], `${item.sku}: description repeats a figure`);
  }
});

// ---- chunker --------------------------------------------------------------

test('guidance is split by headings, each chunk labelled with its file and section', () => {
  const text = '# Pricing notes\n\nIntro words.\n\n## Local plumbers\n\nPlumbers need a service area page.\n\n## Lawyers\n\nLawyers need practice area pages.';
  const chunks = chunkGuidance(text, 'sales_guidance-2026.md', 'abc');
  assert.deepEqual(chunks.map((c) => c.heading), ['sales guidance 2026 > Pricing notes', 'sales guidance 2026 > Local plumbers', 'sales guidance 2026 > Lawyers']);
  assert.ok(chunks.every((c) => c.source === 'upload:abc' && c.metadata.upload === 'abc'));
  assert.equal(chunks[1].content, 'Plumbers need a service area page.');
});

test('text with no headings is packed by paragraph into readable pieces', () => {
  const para = 'This is a sentence about how to describe a page. '.repeat(8).trim();
  const text = Array.from({ length: 10 }, () => para).join('\n\n');
  const chunks = chunkGuidance(text, 'notes.txt', 'u');
  assert.ok(chunks.length > 1 && chunks.length < 10);
  assert.ok(chunks.every((c) => c.content.length <= 1500 && c.heading.startsWith('notes > Part ')));
});

test('one enormous paragraph is cut at sentence ends, never mid-word and never above the limit', () => {
  const chunks = chunkGuidance('Short sentence here. '.repeat(400), 'wall.txt', 'u');
  assert.ok(chunks.length >= 4);
  assert.ok(chunks.every((c) => c.content.length <= 1500 && /\.$/.test(c.content)));
});

test('the number of chunks is capped', () => {
  const text = Array.from({ length: 200 }, (_, i) => `## Section ${i}\n\nBody ${i}`).join('\n\n');
  assert.equal(chunkGuidance(text, 'many.md', 'u').length, MAX_CHUNKS);
});
