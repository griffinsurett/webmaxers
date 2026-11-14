import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBlueprint, parseChatTurn, parseEditResult, parseResearch } from '../../src/components/BlueprintAgent/api';
import { DEMO_SESSION_ID, createDemoApi, priceSample, sampleBlueprint } from '../../src/components/BlueprintAgent/demoApi';
import { toViewBlueprint } from '../../src/components/BlueprintAgent/adapter';

const quick = () => createDemoApi({ stepMs: 0 });
const must = <T,>(r: { ok: boolean; data?: T }): T => { assert.ok(r.ok, 'expected ok'); return r.data as T; };

test('the demo never touches the network', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error('demo mode must not use the network'); }) as never;
  try {
    const api = quick();
    await api.checkBackendHealth();
    await api.startSession();
    for (let i = 0; i < 3; i++) await api.sendChatMessage(DEMO_SESSION_ID, 'x');
    await api.streamResearch(DEMO_SESSION_ID);
    await api.streamBlueprint(DEMO_SESSION_ID);
    await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'toggle_addon', sku: 'addon-crm', on: true }]);
  } finally { globalThis.fetch = realFetch; }
});

test('every demo reply passes the same validators as real server replies', async () => {
  const api = quick();
  const start = must(await api.startSession());
  assert.ok(parseChatTurn(JSON.parse(JSON.stringify(start))), 'start');
  for (let i = 0; i < 3; i++) {
    const t = must(await api.sendChatMessage(DEMO_SESSION_ID, 'hello'));
    assert.ok(parseChatTurn(JSON.parse(JSON.stringify(t))), `turn ${i + 1}`);
  }
  assert.ok(parseResearch(JSON.parse(JSON.stringify(must(await api.streamResearch(DEMO_SESSION_ID))))), 'research');
  const bp = must(await api.streamBlueprint(DEMO_SESSION_ID));
  assert.ok(parseBlueprint(JSON.parse(JSON.stringify(bp))), 'blueprint');
  const edit = must(await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'remove_page', id: 'roof-replacement' }]));
  assert.ok(parseEditResult(JSON.parse(JSON.stringify(edit))), 'edit');
  const refine = must(await api.sendChatMessage(DEMO_SESSION_ID, 'what is the price?'));
  assert.ok(parseChatTurn(JSON.parse(JSON.stringify(refine))), 'refine turn with blueprint');
});

test('the scripted intake ends by moving to research, then the blueprint stage', async () => {
  const api = quick();
  await api.startSession();
  const t1 = must(await api.sendChatMessage(DEMO_SESSION_ID, 'We are Maple Leaf Plumbing'));
  assert.equal(t1.stage, 'intake');
  assert.ok(t1.notices.some((n) => n.startsWith('Demo mode')), 'says plainly it is not reading answers');
  const t2 = must(await api.sendChatMessage(DEMO_SESSION_ID, 'drains'));
  assert.deepEqual(t2.quickReplies.length, 3);
  const t3 = must(await api.sendChatMessage(DEMO_SESSION_ID, 'calls'));
  assert.equal(t3.stage, 'research');
  const held = must(await api.sendChatMessage(DEMO_SESSION_ID, 'hello?'));
  assert.equal(held.stage, 'research', 'a message during research only gets a holding line');
});

test('example prices are internally consistent', () => {
  const bp = sampleBlueprint();
  const t = bp.pricing.totals;
  assert.equal(t.base, 1250);
  assert.equal(t.initialInvestment, t.base + t.extraPages + t.addonSetup);
  assert.equal(t.extraPages, bp.pricing.extraPages.reduce((s, l) => s + l.amount, 0));
  assert.equal(t.monthly, bp.addons.filter((a) => a.included).reduce((s, a) => s + a.monthlyCost, 0));
  assert.equal(bp.pages.filter((p) => p.included).length, bp.pricing.pagesSelected);
  assert.ok(bp.notices[0].startsWith('Demo mode'));
});

test('the sample converts cleanly for the screen: Home and Contact are protected, core pages cost nothing', () => {
  const v = toViewBlueprint(sampleBlueprint());
  assert.deepEqual(v.pages.filter((p) => !p.removable).map((p) => p.id).sort(), ['contact', 'home']);
  assert.ok(v.groups.core.every((p) => p.estimatedCost === 0));
  assert.ok(v.groups.recommended.length >= 3);
  assert.ok(v.pages.find((p) => p.id === 'home')!.sections[0].subsections.length > 0);
});

test('edits: remove and restore a page, toggle an add-on; every number is re-derived', async () => {
  const api = quick();
  const bp = must(await api.streamBlueprint(DEMO_SESSION_ID));
  const start = bp.pricing.totals.initialInvestment;

  const off = must(await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'remove_page', id: 'roof-replacement' }]));
  assert.deepEqual(off.changes, ['Removed "Roof Replacement".']);
  assert.equal(off.blueprint.pricing.totals.initialInvestment, start - 250);
  assert.match(off.estimate, /^Your estimate is \$/);

  const back = must(await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'restore_page', id: 'roof-replacement' }]));
  assert.equal(back.blueprint.pricing.totals.initialInvestment, start);

  const on = must(await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'toggle_addon', sku: 'addon-ai-chat', on: true }]));
  assert.equal(on.blueprint.pricing.totals.initialInvestment, start + 500);
  assert.equal(on.blueprint.pricing.totals.monthly, 49 + 99);
});

test('edits: Home and Contact cannot be removed; unknown ids and repeats are refused without changing the plan', async () => {
  const api = quick();
  const bp = must(await api.streamBlueprint(DEMO_SESSION_ID));
  const r = must(await api.editBlueprint(DEMO_SESSION_ID, [
    { op: 'remove_page', id: 'home' }, { op: 'remove_page', id: 'nope' }, { op: 'restore_page', id: 'about' },
    { op: 'toggle_addon', sku: 'addon-nope', on: true }, { op: 'toggle_addon', sku: 'addon-managed-forms', on: true }, { op: 'toggle_article', id: 'a', on: true },
  ]));
  assert.equal(r.changes.length, 0);
  assert.equal(r.refused.length, 6);
  assert.equal(r.blueprint.pricing.totals.initialInvestment, bp.pricing.totals.initialInvestment);
});

test('edits before a blueprint exists are refused, and restore of a session is always "expired" (nothing is persisted)', async () => {
  const api = quick();
  const r = await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'remove_page', id: 'x' }]);
  assert.ok(!r.ok && r.error.kind === 'not_ready');
  const s = await api.restoreSession(DEMO_SESSION_ID);
  assert.ok(!s.ok && s.error.kind === 'expired');
});

test('after the blueprint, free text gets an honest scripted answer; price questions use the example numbers', async () => {
  const api = quick();
  await api.streamBlueprint(DEMO_SESSION_ID);
  const price = must(await api.sendChatMessage(DEMO_SESSION_ID, 'how much is it?'));
  assert.match(price.reply, /^Your estimate is \$[\d,]+.*Example numbers/);
  assert.ok(price.blueprint);
  const other = must(await api.sendChatMessage(DEMO_SESSION_ID, 'remove the blog please'));
  assert.match(other.reply, /demo mode/i);
});

test('streams emit ordered progress and stop at once when cancelled', async () => {
  const seen: string[] = [];
  const api = quick();
  const r = await api.streamBlueprint(DEMO_SESSION_ID, (e) => seen.push(e.type === 'page' ? `p${e.done}/${e.total}` : e.step));
  assert.ok(r.ok);
  assert.deepEqual(seen.slice(0, 3), ['retrieving', 'structuring', 'writing']);
  assert.equal(seen.at(-1), 'pricing');
  assert.ok(seen.includes('p1/9'));

  const ctl = new AbortController();
  ctl.abort();
  const cancelled = await api.streamResearch(DEMO_SESSION_ID, undefined, { signal: ctl.signal });
  assert.ok(!cancelled.ok && cancelled.error.kind === 'aborted');
  const cancelledBp = await createDemoApi({ stepMs: 0 }).streamBlueprint(DEMO_SESSION_ID, undefined, { signal: ctl.signal });
  assert.ok(!cancelledBp.ok && cancelledBp.error.kind === 'aborted');
});

test('priceSample reacts to which pages and add-ons are included', () => {
  const bp = sampleBlueprint();
  const none = priceSample(bp.pages.map((p) => ({ ...p, included: p.classification === 'core' })), bp.addons.map((a) => ({ ...a, included: false })));
  assert.equal(none.totals.initialInvestment, 1250);
  assert.equal(none.totals.monthly, 0);
});

test('startSession resets the scripted journey and the edited plan', async () => {
  const api = quick();
  await api.startSession();
  for (let i = 0; i < 3; i++) await api.sendChatMessage(DEMO_SESSION_ID, 'x');
  await api.streamBlueprint(DEMO_SESSION_ID);
  await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'remove_page', id: 'roof-replacement' }]);
  await api.startSession();
  const first = must(await api.sendChatMessage(DEMO_SESSION_ID, 'hello again'));
  assert.equal(first.stage, 'intake');
  assert.equal(first.progress.filled, 2);
  const edit = await api.editBlueprint(DEMO_SESSION_ID, [{ op: 'remove_page', id: 'about' }]);
  assert.ok(!edit.ok, 'no plan exists yet in the new conversation');
  const fresh = must(await api.streamBlueprint(DEMO_SESSION_ID));
  assert.equal(fresh.pricing.totals.initialInvestment, 2250);
});
