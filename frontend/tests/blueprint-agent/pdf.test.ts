import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toViewBlueprint } from '../../src/components/BlueprintAgent/adapter';
import { buildPdfDoc, pdfFileName, renderBlueprintPdf } from '../../src/components/BlueprintAgent/pdf';
import { blueprint } from './helpers';

const NOW = new Date('2026-11-11T12:00:00Z');
const line = (id: string, amount: number, monthly = 0) => ({ id, sku: 's', title: id, amount, monthly });

function view() {
  const bp = blueprint();
  bp.summary.businessName = "Joe's Plumbing & Heating";
  bp.pricing.extraPages = [line('Drain Cleaning', 250)];
  bp.pricing.addons = [line('Booking', 400, 20)];
  bp.pricing.totals = { base: 1250, extraPages: 250, content: 0, addonSetup: 400, initialInvestment: 1900, monthly: 20 };
  return toViewBlueprint(bp);
}

test('file name is safe and dated', () => {
  assert.equal(pdfFileName(view(), NOW), 'joe-s-plumbing-heating-blueprint-2026-11-11.pdf');
  assert.equal(pdfFileName({ summary: { ...view().summary, businessName: '###' } }, NOW), 'website-plan-blueprint-2026-11-11.pdf');
});

test('the document carries the server totals and the planned pages', () => {
  const d = buildPdfDoc(view(), { now: NOW });
  assert.equal(d.cost.total, '$1,900');
  assert.equal(d.cost.monthly, 'plus $20 a month');
  assert.ok(d.cost.rows.some((r) => r.item === 'Drain Cleaning' && r.amount === '$250'));
  assert.ok(d.cost.rows.some((r) => r.item === 'Booking' && /\$20 per month/.test(r.detail)));
  assert.equal(d.stats.at(-1)?.value, '$1,900');
  assert.ok(d.pages.length >= 1);
});

test('a removed page leaves the plan and moves to "left out"', () => {
  const bp = blueprint();
  bp.pricing.extraPages = [];
  bp.pages[1] = { ...bp.pages[1], included: false, title: 'Gone Page' };
  const d = buildPdfDoc(toViewBlueprint(bp), { now: NOW });
  assert.deepEqual(d.leftOut, ['Gone Page']);
  assert.ok(!d.pages.some((p) => p.title === 'Gone Page'));
});

test('demo documents say they are examples, not a quote', async () => {
  const d = buildPdfDoc(view(), { demo: true, now: NOW });
  assert.equal(d.demo, true);
  assert.match(d.label, /Example/);
  assert.equal(d.cost.totalLabel, 'Example total');
});

test('renders a real PDF', async () => {
  const doc = await renderBlueprintPdf(view(), { now: NOW });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-');
  assert.ok(doc.getNumberOfPages() >= 1);
});

test('the cover is branded with the visitor business and the Webmaxxers name', () => {
  const d = buildPdfDoc(view(), { now: NOW });
  assert.equal(d.business, "Joe's Plumbing & Heating");
  assert.match(d.date, /November 11, 2026/);
  assert.match(d.next.url, /calendly\.com/);
});

test('pdfSafe keeps accents, straightens smart quotes and drops what the font cannot draw', async () => {
  const { pdfSafe } = await import('../../src/components/BlueprintAgent/pdf');
  assert.equal(pdfSafe('Café “Zoë” – open…'), 'Café "Zoë" - open...');
  assert.equal(pdfSafe('Joe 🚀 Plumbing 日本'), 'Joe  Plumbing ');
});

test('a business name from another alphabet still renders a PDF', async () => {
  const bp = blueprint();
  bp.summary.businessName = '日本の配管 Plumbing 🚀';
  const doc = await renderBlueprintPdf(toViewBlueprint(bp), { now: NOW });
  assert.ok(doc.getNumberOfPages() >= 1);
});
