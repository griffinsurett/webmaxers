// Rule-driven planning tests: determinism across very different model outputs. No network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptySlots, type Slots } from '../conversation/slots.js';
import type { ResearchRecord } from '../research/job.js';
import { catalog, goodStructure, page } from './fixtures.js';
import { areaList, buildPlan, decideAddons, deriveSignals, enforceAddonConsistency, enforcePlan, loadRules, pickTemplate, settleAddons } from './plan.js';
import { verifyStructure, type VerifyContext } from './verify.js';
import type { StructureOutput } from './types.js';

const rules = loadRules();
const slots = (over: Partial<Slots> = {}): Slots => ({
  ...emptySlots(), businessName: 'Maple Leaf', industry: 'plumbing', services: ['drain cleaning', 'water heater repair', 'emergency leak repair'],
  serviceArea: 'Austin and Round Rock, Texas', primaryGoal: 'calls', ...over,
});
const research = (kinds: { booking?: boolean; chat?: boolean; reviews?: boolean } = {}): ResearchRecord => {
  const facts = [
    ...(kinds.booking ? [{ id: 'c1-F1', page: 'site', kind: 'booking' as const, text: 'Online booking via Calendly.' }] : []),
    ...(kinds.chat ? [{ id: 'c1-F2', page: 'site', kind: 'chat' as const, text: 'Chat widget: Tawk.to.' }] : []),
    ...(kinds.reviews ? [{ id: 'c1-F3', page: 'site', kind: 'trust' as const, text: 'Trust signal (reviews): "200 reviews".' }] : []),
  ];
  return { version: 1, status: 'complete', completedAt: 'x', notices: [], findings: null, sites: [{ key: 'c1', role: 'competitor', name: 'C', host: 'c.com', url: 'https://c.com', source: 'discovered', status: 'read', pagesRead: 3, facts }] };
};
const ctx = (s: Slots, factIds: string[] = []): VerifyContext => ({ catalog, factIds: new Set(factIds), serviceArea: s.serviceArea, services: s.services, primaryGoal: s.primaryGoal, hosts: [] });
const recommended = (r: ReturnType<typeof decideAddons>) => r.filter((a) => a.recommended).map((a) => a.sku.replace('addon-', '')).sort();

test('the rules file is valid and covers every catalog add-on', () => {
  assert.equal(rules.templates.every((t) => t.core.length === 3), true);
  const ruled = new Set(rules.addons.map((a) => a.sku));
  for (const item of catalog.filter((c) => c.kind === 'addon')) assert.ok(ruled.has(item.sku), `${item.sku} has no rule`);
  assert.ok(rules.templates.some((t) => t.id === 'generic'));
});

test('service areas are parsed into places; states and filler words are dropped', () => {
  assert.deepEqual(areaList('Austin and Round Rock, Texas'), ['Austin', 'Round Rock']);
  assert.deepEqual(areaList('Austin, TX'), ['Austin']);
  assert.deepEqual(areaList('Greater Austin area'), ['Austin']);
  assert.deepEqual(areaList('Austin, Round Rock, and Cedar Park, TX'), ['Austin', 'Round Rock', 'Cedar Park']);
  assert.deepEqual(areaList('Texas'), ['Texas'], 'only a state: keep it rather than nothing');
  assert.deepEqual(areaList(''), []);
  assert.deepEqual(areaList(undefined), []);
  assert.ok(areaList('A, B, C, D, E, F, G, H, I').length <= 6);
});

test('industry picks the template; industry wording wins over service wording', () => {
  const t = (industry: string, services: string[] = []) => pickTemplate(rules, industry, services).id;
  assert.equal(t('plumbing'), 'home-services');
  assert.equal(t('HVAC contractor'), 'home-services');
  assert.equal(t('family dental practice'), 'clinic');
  assert.equal(t('law firm'), 'professional-services');
  assert.equal(t('Italian restaurant'), 'restaurant');
  assert.equal(t('online store'), 'retail');
  assert.equal(t('landscaping', ['shop for sale']), 'home-services');
  assert.equal(t('pottery'), 'generic');
  assert.equal(t('', []), 'generic');
});

test('add-on rules: same inputs always give the same set; goal, industry, evidence and tools drive it', () => {
  const base = { goal: 'calls', templateId: 'home-services', tools: [] as string[], signals: deriveSignals(null) };
  assert.deepEqual(recommended(decideAddons(rules, catalog, base)), ['managed-forms', 'notifications', 'reviews']);
  const withEvidence = { ...base, signals: deriveSignals(research({ booking: true, chat: true, reviews: true })) };
  assert.deepEqual(recommended(decideAddons(rules, catalog, withEvidence)), ['booking', 'live-chat', 'managed-forms', 'notifications', 'reviews']);
  assert.deepEqual(recommended(decideAddons(rules, catalog, { ...withEvidence, tools: ['Calendly'] })), ['live-chat', 'managed-forms', 'notifications', 'reviews'], 'already has booking');
  assert.deepEqual(recommended(decideAddons(rules, catalog, { ...base, goal: 'quotes' })), ['file-uploads', 'managed-forms', 'notifications', 'quote-system', 'reviews']);
  assert.ok(recommended(decideAddons(rules, catalog, { ...base, tools: ['HubSpot CRM'] })).includes('crm'));
  assert.deepEqual(recommended(decideAddons(rules, catalog, { goal: 'sales', templateId: 'retail', tools: [], signals: deriveSignals(null) })), ['ai-chat', 'managed-forms', 'newsletter', 'payments']);
  const evidence = decideAddons(rules, catalog, withEvidence).find((a) => a.sku === 'addon-booking')!;
  assert.deepEqual(evidence.evidence, ['c1-F1']);
  assert.ok(decideAddons(rules, catalog, base).every((a) => a.reason.length > 0));
});

test('dependencies, exclusive groups and the cap are enforced', () => {
  assert.deepEqual([...settleAddons(new Set(['addon-notifications']), rules)], [], 'notifications need a form, quote or booking tool');
  assert.deepEqual([...settleAddons(new Set(['addon-notifications', 'addon-booking']), rules)].sort(), ['addon-booking', 'addon-notifications']);
  assert.deepEqual([...settleAddons(new Set(['addon-ai-lead-qualification']), rules)], [], 'lead qualification needs a chat tool');
  assert.deepEqual([...settleAddons(new Set(['addon-live-chat', 'addon-ai-chat']), rules)], ['addon-ai-chat'], 'one chat tool; the group order decides');
  const all = new Set(rules.addons.map((a) => a.sku));
  const capped = settleAddons(all, rules);
  assert.ok(capped.size <= rules.maxRecommendedAddons);
  assert.ok(capped.has('addon-managed-forms'), 'priority order keeps the essentials');
  // Cascade: capping out a prerequisite also drops what depended on it.
  for (const sku of capped) {
    const need = rules.addons.find((a) => a.sku === sku)?.requires;
    if (need) assert.ok(need.some((r) => capped.has(r)), `${sku} lost its prerequisite`);
  }
});

test('DETERMINISM: wildly different model outputs converge on the same plan', () => {
  const s = slots();
  const signals = research({ booking: true, chat: true, reviews: true });
  const plan = buildPlan(s, signals, catalog, rules);
  const factIds = ['c1-F1', 'c1-F2', 'c1-F3'];

  const minimal: StructureOutput = { ...goodStructure(), pages: [page('home', { parentId: null, slug: '', category: 'core', classification: 'core', sku: 'page-standard' }), page('about', { category: 'core', classification: 'core', sku: 'page-standard' }), page('contact', { category: 'core', classification: 'core', sku: 'page-standard' }), page('reviews', { category: 'core', classification: 'core', sku: 'page-standard' }), page('services', { category: 'core', classification: 'core', sku: 'page-standard' })], addons: [] };
  const sprawling: StructureOutput = {
    ...goodStructure(), websiteTypeSku: 'site-ecommerce',
    pages: [
      page('home', { parentId: null, slug: '', category: 'core', classification: 'core', sku: 'page-standard' }),
      ...['about-us', 'plumbing-services', 'gallery', 'contact-us', 'blog', 'faq', 'pricing', 'careers', 'financing'].map((id) => page(id, { category: 'core', classification: 'core', sku: 'page-standard' })),
      page('drains', { parentId: 'plumbing-services', title: 'Drain Cleaning' }), page('heaters', { parentId: 'plumbing-services', title: 'Water Heater Repair' }),
      page('cedar-park', { category: 'location', sku: 'page-location', title: 'Cedar Park' }), page('sewer', { parentId: 'plumbing-services', title: 'Sewer Lining', classification: 'recommended' }),
    ],
    addons: [{ sku: 'addon-ai-chat', recommended: true, reason: 'Chat is great.', evidence: ['c1-F2'] }, { sku: 'addon-crm', recommended: true, reason: 'CRM.', evidence: [] }, { sku: 'addon-payments', recommended: true, reason: 'Pay.', evidence: [] }],
  };
  const different = goodStructure();
  different.pages[2].title = 'What We Do'; different.addons = [{ sku: 'addon-booking', recommended: false, reason: 'Nope.', evidence: [] }];

  const summarize = (raw: StructureOutput) => {
    const v = enforcePlan(verifyStructure(raw, ctx(s, factIds)), plan, s, rules);
    const included = v.pages.filter((p) => p.classification !== 'future');
    return {
      core: v.pages.filter((p) => p.classification === 'core').length,
      services: included.filter((p) => p.category === 'service').length,
      locations: included.filter((p) => p.category === 'location').map((p) => p.title).sort(),
      addons: v.addons.filter((a) => a.recommended).map((a) => a.sku).sort(),
      has: (id: string) => v.pages.some((p) => p.id === id),
    };
  };
  const a = summarize(minimal);
  const b = summarize(sprawling);
  const c = summarize(different);
  for (const x of [a, b, c]) {
    assert.equal(x.core, 5, 'exactly five core pages');
    assert.equal(x.services, 3, 'one page per stated service');
    assert.equal(x.locations.length, 2, 'one location page per stated area');
    assert.ok(x.has('home') && x.has('contact'));
  }
  assert.deepEqual(a.addons, b.addons);
  assert.deepEqual(a.addons, c.addons);
  // Wording may differ (a model-made page keeps its own title), but the same two areas are covered every time.
  const areasCovered = (titles: string[]) => ['austin', 'round rock'].filter((a) => titles.some((t) => t.toLowerCase().includes(a)));
  for (const x of [a, b, c]) assert.deepEqual(areasCovered(x.locations), ['austin', 'round rock']);
  assert.equal(plan.websiteTypeSku, 'site-starter', 'the model\'s ecommerce pick is ignored for a calls-focused plumber');
});

test('extras: whatever the model adds beyond the rules is offered as a future idea, keeping its evidence', () => {
  const s = slots();
  const plan = buildPlan(s, research({ booking: true }), catalog, rules);
  const raw = goodStructure();
  raw.pages.push(
    page('cedar-park', { category: 'location', sku: 'page-location', title: 'Cedar Park' }),
    page('faq', { category: 'resource', sku: 'page-standard', title: 'FAQ', classification: 'recommended' }),
    page('sewer-lining', { title: 'Sewer Lining', classification: 'recommended', evidence: ['c1-F1'], basis: 'evidence' }),
    ...['e1', 'e2', 'e3'].map((id) => page(id, { category: 'resource', sku: 'page-standard', classification: 'recommended', evidence: ['c1-F1'], basis: 'evidence' })),
  );
  const v = enforcePlan(verifyStructure(raw, ctx(s, ['c1-F1'])), plan, s, rules);
  const get = (id: string) => v.pages.find((p) => p.id === id)!;
  for (const id of ['cedar-park', 'faq', 'sewer-lining', 'e1', 'e2', 'e3']) assert.equal(get(id).classification, 'future', id);
  assert.deepEqual(get('sewer-lining').evidence, ['c1-F1'], 'the evidence stays attached to the idea');
  // The default (non-future) plan is exactly the rule-decided pages.
  const plannedTitles = v.pages.filter((p) => p.classification !== 'future').map((p) => p.category).sort();
  assert.equal(plannedTitles.filter((c) => c === 'core').length, 5);
  assert.equal(plannedTitles.filter((c) => c === 'service').length, 3);
  assert.equal(plannedTitles.filter((c) => c === 'location').length, 2);
  assert.equal(plannedTitles.length, 10);
});

test('add-ons: the model words the reason when it agrees; a contradicting reason is replaced; one evidenced exception is allowed', () => {
  const s = slots();
  const noChat = buildPlan(s, research({ reviews: true }), catalog, rules); // no competitor chat -> chat not recommended
  const raw = goodStructure();
  raw.addons = [
    { sku: 'addon-managed-forms', recommended: true, reason: 'Forms deliver every quote request to your inbox.', evidence: [] },
    { sku: 'addon-booking', recommended: true, reason: 'Booking is great.', evidence: ['c1-F3'] },   // rules say no: model exception (has evidence)
    { sku: 'addon-reviews', recommended: false, reason: 'Reviews are not needed.', evidence: [] },  // rules say yes: model reason contradicts
    { sku: 'addon-crm', recommended: true, reason: 'CRM.', evidence: ['c1-F3'] },                  // second exception: refused
  ];
  const v = enforcePlan(verifyStructure(raw, ctx(s, ['c1-F3'])), noChat, s, rules);
  const get = (sku: string) => v.addons.find((a) => a.sku === sku)!;
  assert.equal(get('addon-managed-forms').reason, 'Forms deliver every quote request to your inbox.');
  assert.equal(get('addon-booking').recommended, true);
  assert.equal(get('addon-reviews').recommended, true);
  assert.equal(get('addon-reviews').reason, rules.addons.find((r) => r.sku === 'addon-reviews')!.whyYes, 'contradicting model text is not shown');
  assert.equal(get('addon-crm').recommended, false, 'only one exception');
  // An exception that breaks an exclusive group is refused.
  const withChat = buildPlan(s, research({ chat: true }), catalog, rules);
  const raw2 = goodStructure();
  raw2.addons = [{ sku: 'addon-ai-chat', recommended: true, reason: 'AI chat.', evidence: ['c1-F2'] }];
  const v2 = enforcePlan(verifyStructure(raw2, ctx(s, ['c1-F2'])), withChat, s, rules);
  assert.equal(v2.addons.find((a) => a.sku === 'addon-ai-chat')!.recommended, false);
  assert.equal(v2.addons.find((a) => a.sku === 'addon-live-chat')!.recommended, true);
});

test('the safety net makes any inconsistent add-on list consistent', () => {
  const draft = verifyStructure(goodStructure(), ctx(slots()));
  const broken = { ...draft, addons: draft.addons.map((a) => ({ ...a, recommended: ['addon-notifications', 'addon-ai-lead-qualification', 'addon-live-chat', 'addon-ai-chat'].includes(a.sku) })) };
  const fixed = enforceAddonConsistency(broken, rules);
  const on = fixed.addons.filter((a) => a.recommended).map((a) => a.sku);
  assert.ok(!on.includes('addon-notifications'), 'notifications had no form, quote or booking tool');
  assert.equal(on.filter((s) => s === 'addon-live-chat' || s === 'addon-ai-chat').length, 1, 'one chat tool');
  assert.ok(on.includes('addon-ai-lead-qualification'), 'lead qualification stays: a chat tool remains');
  assert.ok(fixed.repairs.some((r) => /add-ons made consistent/.test(r)));
  assert.equal(enforceAddonConsistency(fixed, rules), fixed, 'idempotent');
});

test('website type: online sales or retail -> e-commerce, otherwise Starter (the engine adopts cheaper types itself)', () => {
  assert.equal(buildPlan(slots({ primaryGoal: 'sales' }), null, catalog, rules).websiteTypeSku, 'site-ecommerce');
  assert.equal(buildPlan(slots({ industry: 'online store', primaryGoal: 'leads' }), null, catalog, rules).websiteTypeSku, 'site-ecommerce');
  assert.equal(buildPlan(slots(), null, catalog, rules).websiteTypeSku, 'site-starter');
});

test('the structure prompt tells the model what the rules already decided', async () => {
  const { buildStructurePrompt } = await import('./prompts.js');
  const s = slots();
  const plan = buildPlan(s, research({ booking: true }), catalog, rules);
  const p = buildStructurePrompt({ slots: s, research: research({ booking: true }), catalog }, [], plan);
  assert.match(p.user, /<fixed_by_system>/);
  assert.match(p.user, /core pages .*: home, contact, about, services, projects/);
  assert.match(p.user, /"drain cleaning", "water heater repair", "emergency leak repair"/);
  assert.match(p.user, /"Austin", "Round Rock"/);
  assert.match(p.user, /recommended = addon-managed-forms, addon-booking/);
});

test('"competitors lack online booking" is a signal: it needs two readable sites, and unreadable sites do not count as lacking it', () => {
  const site = (key: string, status: 'read' | 'limited' | 'failed', facts: ResearchRecord['sites'][number]['facts']) =>
    ({ key, role: 'competitor' as const, name: key, host: `${key}.com`, url: `https://${key}.com`, source: 'discovered' as const, status, pagesRead: 3, facts });
  const lacks = (key: string) => [{ id: `${key}-F9`, page: 'site', kind: 'absence' as const, text: 'No online booking tool was detected on the pages read.' }];
  const offers = (key: string) => [{ id: `${key}-F1`, page: 'site', kind: 'booking' as const, text: 'Online booking via Calendly.' }];
  const rec = (sites: ResearchRecord['sites']): ResearchRecord => ({ version: 1, status: 'complete', completedAt: 'x', notices: [], findings: null, sites });

  assert.deepEqual(deriveSignals(rec([site('c1', 'read', lacks('c1')), site('c2', 'read', lacks('c2')), site('c3', 'limited', [])])).compNoBooking, ['c1-F9', 'c2-F9']);
  assert.deepEqual(deriveSignals(rec([site('c1', 'read', lacks('c1')), site('c2', 'limited', lacks('c2')), site('c3', 'failed', [])])).compNoBooking, [], 'only one readable site lacks it');
  const mixed = deriveSignals(rec([site('c1', 'read', lacks('c1')), site('c2', 'read', offers('c2')), site('c3', 'read', lacks('c3'))]));
  assert.deepEqual(mixed.compNoBooking, [], 'a competitor offers it, so it is not an untapped gap');
  assert.deepEqual(mixed.compBooking, ['c2-F1']);

  // The rule honours the research finding: nobody offers booking -> recommend it, citing the absence facts.
  const sigs = deriveSignals(rec([site('c1', 'read', lacks('c1')), site('c2', 'read', lacks('c2')), site('c3', 'read', lacks('c3'))]));
  const d = decideAddons(rules, catalog, { goal: 'calls', templateId: 'home-services', tools: [], signals: sigs }).find((a) => a.sku === 'addon-booking')!;
  assert.equal(d.recommended, true);
  assert.deepEqual(d.evidence, ['c1-F9', 'c2-F9', 'c3-F9']);
  const off = decideAddons(rules, catalog, { goal: 'calls', templateId: 'home-services', tools: ['Calendly'], signals: sigs }).find((a) => a.sku === 'addon-booking')!;
  assert.equal(off.recommended, false, 'already has booking');
});
