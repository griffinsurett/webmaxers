import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeBlueprint, describeResearch, estimateText, money, toViewBlueprint } from '../../src/components/BlueprintAgent/adapter';
import {
  applyBlueprintEvent, applyResearchEvent, finishProgress, startBlueprintProgress, startResearchProgress,
} from '../../src/components/BlueprintAgent/progress';
import { parseSnapshot } from '../../src/components/BlueprintAgent/api';
import type { WirePage, WireResearch } from '../../src/components/BlueprintAgent/wire';
import { SID, blueprint, chatTurn, research } from './helpers';

const page = (over: Partial<WirePage>): WirePage => ({ ...blueprint().pages[0], ...over });

test('money and estimate wording', () => {
  assert.equal(money(3650), '$3,650');
  assert.equal(money(1249.6), '$1,250');
  assert.equal(estimateText({ total: 3650, monthly: 55 }), '$3,650 upfront plus $55 a month');
  assert.equal(estimateText({ total: 1250, monthly: 0 }), '$1,250 upfront');
});

test('toViewBlueprint: every price comes straight from the server breakdown', () => {
  const bp = blueprint();
  bp.pricing.totals = { base: 1250, extraPages: 500, content: 100, addonSetup: 650, initialInvestment: 2500, monthly: 55 };
  bp.pricing.extraPages = [{ id: 'a', sku: 's', title: 'A', amount: 250, monthly: 0 }, { id: 'b', sku: 's', title: 'B', amount: 250, monthly: 0 }];
  const v = toViewBlueprint(bp);
  assert.deepEqual(v.price, {
    websiteName: 'Standard', base: 1250, includedPages: 5, extraPagesCount: 2, extraPages: 500, content: 100, addonSetup: 650, total: 2500, monthly: 55,
  });
});

test('toViewBlueprint: groups pages, keeps removed pages in their group, marks Home/Contact unremovable', () => {
  const bp = blueprint({
    pages: [
      page({ id: 'home', classification: 'core' }),
      page({ id: 'contact', classification: 'core', title: 'Contact' }),
      page({ id: 'about', classification: 'core', title: 'About', included: false }),
      page({ id: 'drain', classification: 'recommended', title: 'Drain Cleaning' }),
      page({ id: 'faq', classification: 'future', title: 'FAQ', included: false }),
    ],
  });
  const v = toViewBlueprint(bp);
  assert.deepEqual(v.groups.core.map((p) => p.id), ['home', 'contact', 'about']);
  assert.deepEqual(v.groups.recommended.map((p) => p.id), ['drain']);
  assert.deepEqual(v.groups.future.map((p) => p.id), ['faq']);
  assert.equal(v.includedPageCount, 3);
  assert.deepEqual(v.pages.filter((p) => !p.removable).map((p) => p.id), ['home', 'contact']);
});

test('toViewBlueprint: evidence resolves to real research facts (max 3) and unknown ids are dropped', () => {
  const bp = blueprint({
    facts: [1, 2, 3, 4].map((n) => ({ id: `c1-F${n}`, page: 'site', kind: 'cta', text: `Fact ${n}` })),
    pages: [page({ evidence: ['c1-F1', 'nope', 'c1-F2', 'c1-F3', 'c1-F4'] })],
  });
  assert.deepEqual(toViewBlueprint(bp).pages[0].evidence, ['Fact 1', 'Fact 2', 'Fact 3']);
});

test('toViewBlueprint: tolerates missing path, sections and partial status', () => {
  const bp = blueprint({ pages: [{ ...page({ slug: 'about', path: '' }), sections: undefined as never, evidence: undefined as never }], status: 'partial', notices: ['Limited.'] });
  const v = toViewBlueprint(bp);
  assert.equal(v.pages[0].path, '/about');
  assert.deepEqual(v.pages[0].sections, []);
  assert.equal(v.partial, true);
  assert.deepEqual(v.notices, ['Limited.']);
});

test('describeBlueprint reads the server numbers back, with correct plurals', () => {
  const v = toViewBlueprint(blueprint());
  assert.equal(describeBlueprint(v), 'Your blueprint is ready: 1 page and 1 add-on. Your estimate is $1,650 upfront plus $20 a month. Click ✕ on any page, or switch add-ons on and off, and the price updates. You can also just tell me what to change.');
  const none = toViewBlueprint(blueprint({ addons: [] }));
  assert.ok(describeBlueprint(none).startsWith('Your blueprint is ready: 1 page. '));
});

test('describeResearch: names readable competitors, quotes only evidenced opportunities, handles total failure', () => {
  const r = research() as unknown as WireResearch;
  r.findings!.opportunities = [
    { point: 'Add online booking.', why: '', evidence: [], support: 'evidenced' },
    { point: 'Guess.', why: '', evidence: [], support: 'inferred' },
  ];
  const text = describeResearch(r);
  assert.ok(text.startsWith('I looked at 1 competitor website: comp.com.'));
  assert.ok(text.includes('• Add online booking.'));
  assert.ok(!text.includes('Guess.'));
  r.sites = r.sites.map((s) => ({ ...s, status: 'failed' as const }));
  assert.ok(describeResearch(r).startsWith("I couldn't read any competitor websites"));
});

// ---------------------------------------------------------------------------
// Progress reducers
// ---------------------------------------------------------------------------

test('research progress: steps advance, competitors and per-site status show as detail', () => {
  let p = startResearchProgress();
  assert.deepEqual(p.steps.map((s) => s.status), ['active', 'pending', 'pending']);
  p = applyResearchEvent(p, { type: 'competitors', items: [{ name: 'A', host: 'a.com', source: 'discovered' }, { name: 'B', host: 'b.com', source: 'discovered' }] });
  assert.equal(p.steps[0].detail, 'Found a.com, b.com');
  p = applyResearchEvent(p, { type: 'step', step: 'reading', message: '' });
  p = applyResearchEvent(p, { type: 'site', host: 'a.com', role: 'competitor', status: 'done' });
  p = applyResearchEvent(p, { type: 'site', host: 'b.com', role: 'competitor', status: 'failed' });
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'active', 'pending']);
  assert.equal(p.steps[1].detail, "a.com ✓  ·  b.com (couldn't read)");
  p = applyResearchEvent(p, { type: 'step', step: 'analyzing', message: '' });
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'done', 'active']);
  assert.deepEqual(finishProgress(p).steps.map((s) => s.status), ['done', 'done', 'done']);
});

test('progress never moves backwards on late or repeated events', () => {
  let p = startResearchProgress();
  p = applyResearchEvent(p, { type: 'step', step: 'analyzing', message: '' });
  p = applyResearchEvent(p, { type: 'step', step: 'reading', message: '' });
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'done', 'active']);
  const before = JSON.stringify(p);
  p = applyResearchEvent(p, { type: 'step', step: 'nonexistent' as never, message: '' });
  assert.equal(JSON.stringify(p), before);
});

test('blueprint progress: page counter shows under "Outlining each page"', () => {
  let p = startBlueprintProgress();
  p = applyBlueprintEvent(p, { type: 'step', step: 'structuring', message: '' });
  p = applyBlueprintEvent(p, { type: 'page', done: 3, total: 11 });
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'done', 'active', 'pending']);
  assert.equal(p.steps[2].detail, '3 of 11 pages');
  p = applyBlueprintEvent(p, { type: 'step', step: 'pricing', message: '' });
  assert.deepEqual(p.steps.map((s) => s.status), ['done', 'done', 'done', 'active']);
});

// ---------------------------------------------------------------------------
// Snapshot parsing (refresh restore)
// ---------------------------------------------------------------------------

test('parseSnapshot: accepts a full snapshot and normalizes it', () => {
  const snap = parseSnapshot({
    ...chatTurn({ stage: 'refine', blueprint: blueprint(), reply: undefined }), quickReplies: ['a'],
    messages: [{ role: 'assistant', content: 'Hi' }, { role: 'user', content: 'Yo' }, { role: 'system', content: 'junk' }, { role: 'user' }],
    research: research(),
  });
  assert.ok(snap);
  assert.equal(snap.sessionId, SID);
  assert.equal(snap.stage, 'refine');
  assert.equal(snap.messages.length, 2, 'unknown roles and malformed entries dropped');
  assert.equal(snap.research?.sites.length, 1);
  assert.ok(snap.blueprint);
});

test('parseSnapshot: rejects malformed snapshots', () => {
  const good = { ...chatTurn(), messages: [] };
  assert.ok(parseSnapshot(good));
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot({ ...good, messages: 'x' }), null);
  assert.equal(parseSnapshot({ ...good, stage: 'weird' }), null);
  assert.equal(parseSnapshot({ ...good, sessionId: 'nope' }), null);
  assert.equal(parseSnapshot({ ...good, research: { status: 'weird', sites: [] } }), null);
  assert.equal(parseSnapshot({ ...good, blueprint: { version: 1 } }), null);
});

test('toViewBlueprint: the cost breakdown lists the server lines and follows an added or removed page', () => {
  const line = (id: string, amount: number, monthly = 0) => ({ id, sku: 's', title: id, amount, monthly });
  const bp = blueprint();
  bp.pricing.extraPages = [line('Drain Cleaning', 250), line('Water Heaters', 250)];
  bp.pricing.addons = [line('Booking', 400, 20)];
  const before = toViewBlueprint(bp).breakdown;
  assert.deepEqual(before.extraPages.map((l) => l.title), ['Drain Cleaning', 'Water Heaters']);
  assert.equal(before.addons[0].monthly, 20);

  // The server re-prices after a removal; the view shows exactly what it sends.
  bp.pricing.extraPages = [line('Drain Cleaning', 250)];
  const after = toViewBlueprint(bp).breakdown;
  assert.deepEqual(after.extraPages.map((l) => l.title), ['Drain Cleaning']);

  assert.equal(toViewBlueprint(blueprint()).breakdown.cheaper, undefined);
});
