// backend/src/services/kbadmin/pricingVerify.ts
// The safety layer between "a model read the pricing document" and "customers are quoted from it".
//
// The model proposes catalog changes, each with the exact words it relied on. Code then checks the
// proposal against the document and the current catalog, and nothing is applied until an admin
// approves it:
//   - the quoted words must really appear in the document (so no invented lines),
//   - every non-zero number in the proposal must appear in those words (so no invented prices),
//   - SKUs, kinds and amounts must be well-formed and within sane bounds,
//   - an existing item can never change kind, and big jumps are flagged for a closer look.
// A change the checks cannot back up is shown to the admin as rejected, with the reason.
import type { CatalogItem, CatalogKind } from '../../types/index.js';

export interface ProposedItem {
  sku: string;
  kind: CatalogKind;
  name: string | null;
  description: string | null;
  price: number | null;
  setup: number | null;
  monthly: number | null;
  includedPages: number | null;
  unit: string | null;
  /** The words in the document this item was taken from, copied exactly. */
  sourceQuote: string;
}

export interface ItemFields {
  kind: CatalogKind;
  name: string;
  description: string;
  price: number;
  setup: number;
  monthly: number;
  includedPages: number | null;
  unit: string;
}

export type ReviewStatus = 'changed' | 'new' | 'unchanged' | 'rejected';

export interface ReviewItem {
  sku: string;
  status: ReviewStatus;
  before: ItemFields | null;
  after: ItemFields | null;
  quote: string;
  /** Why an item was rejected. */
  reasons: string[];
  /** Things the admin should look at before approving. */
  warnings: string[];
}

const SKU_PREFIX: Record<CatalogKind, string> = { website_type: 'site-', page: 'page-', content: 'content-', addon: 'addon-' };
const SKU_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_AMOUNT = 100_000;
const UNSAFE_TEXT = /[<>`\u0000-\u001F]/;

export const fieldsOf = (item: CatalogItem): ItemFields => ({
  kind: item.kind, name: item.name, description: item.description, price: item.price,
  setup: item.setup, monthly: item.monthly, includedPages: item.includedPages, unit: item.unit,
});

// ---------------------------------------------------------------------------
// Matching text
// ---------------------------------------------------------------------------

/** Lower-case letters and digits only, so spacing, punctuation and PDF line breaks do not matter. */
const squash = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9]+/g, '');

export function quoteIsInDocument(quote: string, document: string): boolean {
  const q = squash(quote);
  return q.length >= 10 && squash(document).includes(q);
}

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
};

/** Every number written in the text, as digits (with thousands separators) or as a small word. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) if (w in WORD_NUMBERS) out.push(WORD_NUMBERS[w]);
  return out;
}

const hasNumber = (quote: string, n: number) => numbersIn(quote).some((x) => Math.abs(x - n) < 0.005);
/** Words that make a zero a real statement ("no monthly fee", "free", "$0") rather than "not mentioned". */
const ZERO_CUE = /\b(free|complimentary|waived|none|included)\b|\bno\s+(?:\w+\s+){0,2}(?:fee|fees|charge|charges|cost|costs)\b|\$\s?0(?:\.00)?(?![\d,])|\bat no\b/i;

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function amountProblem(label: string, value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value < 0) return `${label} must be zero or more`;
  if (value > MAX_AMOUNT) return `${label} of ${value.toLocaleString('en-US')} is above the ${MAX_AMOUNT.toLocaleString('en-US')} limit`;
  if (Math.round(value * 100) !== value * 100) return `${label} has more than two decimal places`;
  return null;
}

export function verifyProposal(items: ProposedItem[], current: CatalogItem[], documentText: string): ReviewItem[] {
  const bySku = new Map(current.map((c) => [c.sku, c]));
  const seen = new Set<string>();
  const review: ReviewItem[] = [];

  for (const raw of items) {
    const existing = bySku.get(raw.sku);
    const before = existing ? fieldsOf(existing) : null;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const quote = (raw.sourceQuote ?? '').trim();

    // Models fill 0 for a figure the document never gives. A zero only counts as stated when the words
    // say so (free, no fee, $0); otherwise it means "not mentioned" and the current value is kept.
    // (A NON-zero figure without support in the words is different: that is an invented price, rejected below.)
    const zeroIsStated = ZERO_CUE.test(quote);
    const stated = (v: number | null) => (v === 0 && !zeroIsStated ? null : v);
    const p: ProposedItem = { ...raw, price: stated(raw.price), setup: stated(raw.setup), monthly: stated(raw.monthly), includedPages: stated(raw.includedPages) };

    // The catalog's wording is kept: a price document says what things cost, not how to describe them, and models
    // tend to replace a good description with a bare name. An existing description is only taken from the model
    // when the current one repeats a figure that is changing, so it would otherwise contradict the new figure.
    if (existing && before) {
      const staleFigure = (['price', 'setup', 'monthly', 'includedPages'] as const).some((f) => {
        const oldV = before[f]; const newV = p[f];
        return !!oldV && newV !== null && newV !== oldV && numbersIn(before.description).includes(oldV);
      });
      if (!staleFigure) p.description = null;
    }

    // Identity
    if (!SKU_PATTERN.test(p.sku) || p.sku.length > 60) reasons.push('The item code is not valid (lowercase letters, numbers and dashes only).');
    else if (!p.sku.startsWith(SKU_PREFIX[p.kind])) reasons.push(`A ${p.kind.replace('_', ' ')} item code must start with "${SKU_PREFIX[p.kind]}".`);
    if (seen.has(p.sku)) reasons.push('This item code appears more than once; only the first is used.');
    seen.add(p.sku);
    if (existing && existing.kind !== p.kind) reasons.push(`This code already exists as a ${existing.kind.replace('_', ' ')}; its type cannot change.`);

    // Evidence
    if (!quote) reasons.push('No supporting text was given.');
    else if (!quoteIsInDocument(quote, documentText)) reasons.push('The supporting text was not found in the document.');

    // Amounts
    for (const [label, value] of [['Price', p.price], ['Setup fee', p.setup], ['Monthly fee', p.monthly]] as const) {
      const problem = amountProblem(label, value);
      if (problem) reasons.push(`${problem}.`);
      if (value !== null && quote && !problem) {
        const ok = value === 0 ? ZERO_CUE.test(quote) : hasNumber(quote, value);
        if (!ok) reasons.push(`${label} ${value} does not appear in the supporting text.`);
      }
    }
    if (p.includedPages !== null) {
      if (!Number.isInteger(p.includedPages) || p.includedPages < 0 || p.includedPages > 200) reasons.push('Included pages must be a whole number from 0 to 200.');
      else if (quote && p.includedPages !== 0 && !hasNumber(quote, p.includedPages)) reasons.push(`Included pages ${p.includedPages} does not appear in the supporting text.`);
    }

    // Wording that reaches customers
    for (const [label, value] of [['Name', p.name], ['Description', p.description], ['Unit', p.unit]] as const) {
      if (value && UNSAFE_TEXT.test(value)) reasons.push(`${label} contains characters that are not allowed.`);
    }
    if ((p.name?.length ?? 0) > 120) reasons.push('Name is longer than 120 characters.');
    if ((p.description?.length ?? 0) > 600) reasons.push('Description is longer than 600 characters.');
    if ((p.unit?.length ?? 0) > 30) reasons.push('Unit is longer than 30 characters.');

    // A description may only carry numbers the document or the old description already carried (no invented figures).
    if (p.description) {
      const allowed = [...numbersIn(quote), ...numbersIn(before?.description ?? '')];
      const stray = numbersIn(p.description).filter((n) => !allowed.some((a) => Math.abs(a - n) < 0.005));
      if (stray.length) reasons.push(`The description contains a number (${stray[0]}) that is not in the document.`);
    }

    // A new item needs enough to be quoted
    if (!existing) {
      if (!p.name?.trim()) reasons.push('A new item needs a name.');
      if (p.price === null && p.setup === null && p.monthly === null) reasons.push('A new item needs at least one amount.');
      if (p.kind === 'website_type' && p.includedPages === null) reasons.push('A new website type needs its included pages.');
    }

    // Heuristic: an amount placed in the wrong field is not caught by number matching alone.
    if (quote && p.monthly !== null && p.monthly > 0 && !/month|\/\s?mo\b|per mo|recurring|annual|yearly|\/\s?yr/i.test(quote)) warnings.push('The monthly fee is not described as monthly in the supporting text. Check it.');
    if (quote && p.setup !== null && p.setup > 0 && !/set-?up|one-?time|upfront|install|onboard|start|launch|build|initial/i.test(quote)) warnings.push('The setup fee is not described as a setup or one-time fee in the supporting text. Check it.');

    if (reasons.length > 0) {
      review.push({ sku: p.sku, status: 'rejected', before, after: null, quote, reasons, warnings });
      continue;
    }

    // Merge: a field the document did not mention keeps its current value.
    const after: ItemFields = {
      kind: p.kind,
      name: p.name?.trim() || before?.name || '',
      description: p.description?.trim() ?? before?.description ?? '',
      price: p.price ?? before?.price ?? 0,
      setup: p.setup ?? before?.setup ?? 0,
      monthly: p.monthly ?? before?.monthly ?? 0,
      includedPages: p.includedPages ?? before?.includedPages ?? null,
      unit: p.unit?.trim() || before?.unit || 'each',
    };

    if (before) {
      for (const field of ['price', 'setup', 'monthly'] as const) {
        const a = before[field]; const b = after[field];
        if (a > 0 && b > 0 && (b / a > 3 || b / a < 1 / 3)) warnings.push(`The ${field} changes from ${a} to ${b}, a large change. Check it.`);
        else if (a > 0 && b === 0) warnings.push(`The ${field} drops from ${a} to 0. Check it.`);
      }
    }

    // Figures belong in the structured fields. A description that still carries the OLD figure now contradicts the new one.
    if (before) {
      for (const field of ['price', 'setup', 'monthly', 'includedPages'] as const) {
        const oldV = before[field]; const newV = after[field];
        if (oldV && newV !== oldV) {
          const nums = numbersIn(after.description);
          if (nums.includes(oldV) && !(newV !== null && nums.includes(newV))) {
            warnings.push(`The description still mentions ${oldV}, which no longer matches the new ${field === 'includedPages' ? 'page allowance' : field}. Update the description or keep figures out of it.`);
          }
        }
      }
    }

    const same = before && (Object.keys(after) as (keyof ItemFields)[]).every((k) => after[k] === before[k]);
    review.push({ sku: p.sku, status: !before ? 'new' : same ? 'unchanged' : 'changed', before, after, quote, reasons: [], warnings });
  }
  return review;
}
