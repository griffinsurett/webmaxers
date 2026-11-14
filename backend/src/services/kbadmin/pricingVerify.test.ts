// The safety layer between "a model read a pricing document" and "customers are quoted from it".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CatalogItem } from '../../types/index.js';
import { numbersIn, quoteIsInDocument, verifyProposal, type ProposedItem } from './pricingVerify.js';

const seed = JSON.parse(readFileSync(new URL('../../../kb/demo-pricing.json', import.meta.url), 'utf8'));
const catalog: CatalogItem[] = seed.items.map((i: any) => ({
  sku: i.sku, kind: i.kind, name: i.name, description: i.description ?? '', price: i.price ?? 0, setup: i.setup ?? 0,
  monthly: i.monthly ?? 0, includedPages: i.included_pages ?? null, unit: i.unit ?? 'each', version: seed.version, metadata: {},
}));

const DOC = `Webmaxxers pricing, January
Starter Website: $1,400 (up to 5 pages)
Each additional standard page is $275.
AI Chat add-on: $500 one-time setup, then $89 per month.
Booking calendar: free to add, $0/month.
Priority support: $120 per month.`;

const item = (over: Partial<ProposedItem>): ProposedItem => ({
  sku: 'site-starter', kind: 'website_type', name: null, description: null, price: null, setup: null, monthly: null,
  includedPages: null, unit: null, sourceQuote: 'Starter Website: $1,400 (up to 5 pages)', ...over,
});

const one = (p: ProposedItem, doc = DOC) => verifyProposal([p], catalog, doc)[0];

test('a price change backed by the document is accepted, with before and after', () => {
  const r = one(item({ price: 1400, includedPages: 5 }));
  assert.equal(r.status, 'changed');
  assert.equal(r.before?.price, 1250);
  assert.equal(r.after?.price, 1400);
  assert.deepEqual(r.reasons, []);
});

test('fields the document does not mention keep their current value', () => {
  const r = one(item({ price: 1400 }));
  assert.equal(r.after?.includedPages, 5);
  assert.equal(r.after?.name, 'Starter Website');
  assert.equal(r.after?.description, catalog.find((c) => c.sku === 'site-starter')!.description);
});

test('restating the current price is "unchanged", not a change', () => {
  const doc = 'Starter Website: $1,250 (up to 5 pages)';
  assert.equal(one(item({ price: 1250, includedPages: 5, sourceQuote: doc }), doc).status, 'unchanged');
});

test('INVENTED NUMBER: a price that is not in the supporting words is rejected', () => {
  const r = one(item({ price: 999 }));
  assert.equal(r.status, 'rejected');
  assert.ok(r.reasons.some((x) => x.includes('999') && x.includes('does not appear')));
  assert.equal(r.after, null);
});

test('INVENTED LINE: supporting words that are not in the document are rejected', () => {
  const r = one(item({ price: 1200, sourceQuote: 'Starter Website: $1,200 (up to 5 pages)' }));
  assert.equal(r.status, 'rejected');
  assert.ok(r.reasons.some((x) => x.includes('not found in the document')));
});

test('no supporting words at all is rejected', () => {
  assert.equal(one(item({ price: 1400, sourceQuote: '' })).status, 'rejected');
  assert.equal(one(item({ price: 1400, sourceQuote: '$1,400' })).status, 'rejected', 'too short to prove anything');
});

test('quote matching tolerates spacing, line breaks, punctuation and case (PDF text is messy)', () => {
  assert.ok(quoteIsInDocument('starter  website:\n$1,400   (up to 5 pages)', DOC));
  assert.ok(quoteIsInDocument('STARTER WEBSITE $1400 up to 5 pages', DOC));
  assert.ok(!quoteIsInDocument('Starter Website: $1,500 (up to 5 pages)', DOC));
});

test('numbers are read from digits with separators and from small words', () => {
  assert.deepEqual(numbersIn('From $1,250.50 for five pages, $79/mo').sort((a, b) => a - b), [5, 79, 1250.5]);
});

test('a monthly fee and a setup fee must both appear in the words', () => {
  const quote = 'AI Chat add-on: $500 one-time setup, then $89 per month.';
  const ok = one(item({ sku: 'addon-ai-chat', kind: 'addon', setup: 500, monthly: 89, sourceQuote: quote }));
  assert.equal(ok.status, 'changed');
  assert.deepEqual(ok.warnings, []);
  const wrong = one(item({ sku: 'addon-ai-chat', kind: 'addon', setup: 500, monthly: 90, sourceQuote: quote }));
  assert.equal(wrong.status, 'rejected');
});

test('a zero is a real "free / no fee" only when the words say so; otherwise it means "not mentioned" and the current value stays', () => {
  const doc = 'AI Chat add-on: $600 setup, then $89 per month. Online booking: $250 setup, no monthly fee.';
  // Models fill 0 for figures the document never gives. That must not wipe the current price or get the item rejected.
  const unmentioned = one(item({ sku: 'addon-ai-chat', kind: 'addon', price: 0, setup: 600, monthly: 89, sourceQuote: 'AI Chat add-on: $600 setup, then $89 per month.' }), doc);
  assert.equal(unmentioned.status, 'changed');
  assert.equal(unmentioned.after?.setup, 600);
  assert.equal(unmentioned.after?.monthly, 89);
  assert.equal(unmentioned.after?.price, 0, 'add-ons carry no one-time "price", the current 0 is kept');
  // "no monthly fee" is an explicit zero, and dropping an existing fee to zero is flagged for a closer look.
  const nofee = one(item({ sku: 'addon-managed-forms', kind: 'addon', setup: 250, monthly: 0, sourceQuote: 'Online booking: $250 setup, no monthly fee.' }), doc);
  assert.equal(nofee.after?.monthly, 0);
  assert.ok(nofee.warnings.some((w) => w.includes('drops from 25 to 0')));
  for (const cue of ['free to add', 'no charge', 'at $0', 'complimentary']) {
    const q = `Online booking: $250 setup, ${cue}.`;
    assert.equal(one(item({ sku: 'addon-booking', kind: 'addon', setup: 250, monthly: 0, sourceQuote: q }), q).status, 'unchanged', cue);
  }
  // A zero with no wording and nothing else stated changes nothing.
  assert.equal(one(item({ sku: 'addon-booking', kind: 'addon', setup: 0, sourceQuote: 'Priority support: $120 per month.' })).status, 'unchanged');
});

test('an amount in the wrong field: caught when the words lack the cue, otherwise left to the admin review', () => {
  // The words never say "monthly", so calling $500 a monthly fee is flagged.
  const mislabeled = one(item({ sku: 'addon-ai-chat', kind: 'addon', monthly: 500, sourceQuote: 'AI Chat add-on: $500 one-time setup.' }));
  assert.equal(mislabeled.status, 'changed');
  assert.ok(mislabeled.warnings.some((w) => w.includes('monthly')));
  // Number matching alone cannot know WHICH of two real numbers belongs in a field. This case is not flagged:
  // it is the reason the admin always sees the before/after figures next to the quoted words.
  const swapped = one(item({ sku: 'addon-ai-chat', kind: 'addon', setup: 89, sourceQuote: 'AI Chat add-on: $500 one-time setup, then $89 per month.' }));
  assert.equal(swapped.status, 'changed');
  assert.equal(swapped.after?.setup, 89);
});

test('large price jumps and drops to zero are flagged for a closer look', () => {
  const doc = 'Starter Website: $4,500 (up to 5 pages)';
  const jump = one(item({ price: 4500, sourceQuote: doc }), doc);
  assert.equal(jump.status, 'changed');
  assert.ok(jump.warnings.some((w) => w.includes('large change')));
  const zero = one(item({ price: 0, sourceQuote: 'Starter Website: free setup included (up to 5 pages)' }), 'Starter Website: free setup included (up to 5 pages)');
  assert.ok(zero.warnings.some((w) => w.includes('drops')));
});

test('item codes: wrong prefix for the type, bad characters, duplicates and a changed type are rejected', () => {
  assert.ok(one(item({ sku: 'addon-oops', kind: 'page', price: 1400 })).reasons.some((x) => x.includes('must start with "page-"')));
  assert.equal(one(item({ sku: 'Site Starter!', price: 1400 })).status, 'rejected');
  assert.ok(one(item({ sku: 'page-standard', kind: 'addon', price: 275 })).status === 'rejected');
  const dup = verifyProposal([item({ price: 1400 }), item({ price: 1400 })], catalog, DOC);
  assert.deepEqual(dup.map((d) => d.status), ['changed', 'rejected']);
});

test('amounts must be sane: negative, enormous or sub-cent values are rejected', () => {
  for (const price of [-5, 250_000, 12.345]) {
    const doc = `Starter Website: $${price} (up to 5 pages)`;
    assert.equal(one(item({ price, sourceQuote: doc }), doc).status, 'rejected', String(price));
  }
  const pages = 'Starter Website: $1,400 (up to 500 pages)';
  assert.equal(one(item({ price: 1400, includedPages: 500, sourceQuote: pages }), pages).status, 'rejected');
});

test('customer-visible wording cannot carry markup or control characters', () => {
  assert.equal(one(item({ price: 1400, name: '<script>alert(1)</script>' })).status, 'rejected');
  // On an existing item a proposed description is dropped (the catalog wording stays), so it can never reach customers.
  const dropped = one(item({ price: 1400, description: 'a `code` b' }));
  assert.equal(dropped.status, 'changed');
  assert.ok(!dropped.after?.description.includes('`'));
  // On a NEW item the description is used, so unsafe characters reject it.
  const q = 'Priority support: $120 per month.';
  assert.equal(one(item({ sku: 'addon-priority-support', kind: 'addon', name: 'Priority support', monthly: 120, description: 'a `code` b', sourceQuote: q }), q).status, 'rejected');
  assert.equal(one(item({ price: 1400, name: 'x'.repeat(130) })).status, 'rejected');
});

test('a NEW item needs a name, an amount, and (for a website type) its included pages', () => {
  const q = 'Priority support: $120 per month.';
  const fine = one(item({ sku: 'addon-priority-support', kind: 'addon', name: 'Priority support', monthly: 120, sourceQuote: q }));
  assert.equal(fine.status, 'new');
  assert.equal(fine.after?.monthly, 120);
  assert.equal(fine.after?.unit, 'each');
  assert.equal(one(item({ sku: 'addon-priority-support', kind: 'addon', name: null, monthly: 120, sourceQuote: q })).status, 'rejected');
  assert.equal(one(item({ sku: 'addon-priority-support', kind: 'addon', name: 'Priority support', sourceQuote: q })).status, 'rejected');
  const siteDoc = 'Growth Website: $3,000';
  assert.equal(one(item({ sku: 'site-growth', kind: 'website_type', name: 'Growth Website', price: 3000, sourceQuote: siteDoc }), siteDoc).status, 'rejected');
});

test('FIGURES BELONG IN THE FIELDS: a description that still carries the old figure is flagged, a rewritten one is accepted, an invented number is not', () => {
  const stale = catalog.map((c) => (c.sku === 'site-starter' ? { ...c, description: 'Up to 5 pages. The foundation for local businesses.' } : c));
  const run = (p: ProposedItem) => verifyProposal([p], stale, DOC)[0];
  // The page allowance changes to 6 but the description still says 5.
  const flagged = run(item({ price: 1400, includedPages: 6, sourceQuote: 'Starter Website: $1,400 (up to 6 pages)' }));
  assert.equal(flagged.status, 'rejected'); // 6 is not in DOC's words; use a document that says it
  const doc6 = 'Starter Website: $1,400 (up to 6 pages)';
  const q6 = (over: Partial<ProposedItem>) => verifyProposal([item({ price: 1400, includedPages: 6, sourceQuote: doc6, ...over })], stale, doc6)[0];
  const warned = q6({});
  assert.equal(warned.status, 'changed');
  assert.ok(warned.warnings.some((w) => w.includes('description still mentions 5')));
  // The model rewrites the description with the new figure: accepted, and no warning.
  const rewritten = q6({ description: 'Up to 6 pages. The foundation for local businesses.' });
  assert.equal(rewritten.status, 'changed');
  assert.equal(rewritten.after?.description, 'Up to 6 pages. The foundation for local businesses.');
  assert.deepEqual(rewritten.warnings, []);
  // A description may not introduce a number that is in neither the document nor the old description.
  const invented = q6({ description: 'Up to 9 pages. The foundation for local businesses.' });
  assert.equal(invented.status, 'rejected');
  assert.ok(invented.reasons.some((r) => r.includes('description contains a number (9)')));
});

test('an existing description is never replaced by the model unless it repeats a figure that is changing', () => {
  const bare = one(item({ price: 1400, description: 'Starter Website' }));
  assert.equal(bare.status, 'changed');
  assert.equal(bare.after?.description, catalog.find((c) => c.sku === 'site-starter')!.description, 'the catalog wording is kept');
  const doc = 'Priority support: $120 per month.';
  const fresh = one(item({ sku: 'addon-priority-support', kind: 'addon', name: 'Priority support', monthly: 120, description: 'Faster replies for your site.', sourceQuote: doc }), doc);
  assert.equal(fresh.after?.description, 'Faster replies for your site.', 'a NEW item takes its description from the model');
});

test('one bad item does not stop the good ones from being reviewed', () => {
  const out = verifyProposal([item({ price: 1400 }), item({ sku: 'page-standard', kind: 'page', price: 9999, sourceQuote: 'Each additional standard page is $275.' })], catalog, DOC);
  assert.deepEqual(out.map((o) => o.status), ['changed', 'rejected']);
});
