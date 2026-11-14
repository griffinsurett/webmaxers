import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApiResult } from '../../src/components/BlueprintAgent/api';
import { apiError } from '../../src/components/BlueprintAgent/api';
import { AgentController, LOCAL_GREETING, type AgentApi, type SessionStore } from '../../src/components/BlueprintAgent/controller';
import type { ChatTurn, EditResult, SessionSnapshot, WireResearch } from '../../src/components/BlueprintAgent/wire';
import { SID, blueprint, chatTurn, research } from './helpers';

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const bad = <T,>(kind: Parameters<typeof apiError>[0], message?: string): ApiResult<T> => ({ ok: false, error: apiError(kind, message) });
const turn = (over: Record<string, unknown> = {}) => chatTurn(over) as unknown as ChatTurn;
const rec = () => research() as unknown as WireResearch;
const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (fn: () => boolean) => { for (let i = 0; i < 200 && !fn(); i++) await tick(); assert.ok(fn(), 'condition not reached'); };

function memoryStore(initial: string | null = null): SessionStore & { value: string | null } {
  const s = { value: initial, load: () => s.value, save: (id: string) => { s.value = id; }, clear: () => { s.value = null; } };
  return s;
}

interface Calls { [k: string]: unknown[][] }
function fakeApi(over: Partial<AgentApi> = {}): { api: AgentApi; calls: Calls } {
  const calls: Calls = {};
  const base: AgentApi = {
    checkBackendHealth: async () => true,
    startSession: async () => ok(turn({ stage: 'greet' })),
    sendChatMessage: async () => ok(turn()),
    restoreSession: async () => bad('expired'),
    streamResearch: async (_id, onP) => { onP?.({ type: 'step', step: 'reading', message: 'x' }); return ok(rec()); },
    streamBlueprint: async (_id, onP) => { onP?.({ type: 'page', done: 1, total: 2 }); return ok(blueprint()); },
    editBlueprint: async () => ok({ blueprint: blueprint(), changes: [], refused: [], notice: null, estimate: 'Your estimate is $1,650 plus $20 a month.' } as EditResult),
  };
  const merged = { ...base, ...over } as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names: Record<string, string> = {
    checkBackendHealth: 'health', startSession: 'start', sendChatMessage: 'send', restoreSession: 'restore',
    streamResearch: 'research', streamBlueprint: 'blueprint', editBlueprint: 'edit',
  };
  const api = Object.fromEntries(Object.entries(merged).map(([k, fn]) => [k, (...a: unknown[]) => { (calls[names[k]] ??= []).push(a); return fn(...a); }]));
  return { api: api as unknown as AgentApi, calls };
}

const snapshot = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  sessionId: SID, stage: 'intake', progress: { required: 5, filled: 2 },
  slots: { businessName: 'Maple', industry: null, services: [], serviceArea: null, primaryGoal: null, ownUrl: null, competitorUrls: [], noWebsite: false },
  locked: false, quickReplies: [], messages: [{ role: 'assistant', content: 'Hi' }, { role: 'user', content: 'We are Maple' }, { role: 'assistant', content: 'Great. What do you do?' }],
  research: null, blueprint: null, ...over,
});

const make = (over: Partial<AgentApi> = {}, store = memoryStore()) => {
  const f = fakeApi(over);
  const c = new AgentController({ api: f.api, store, now: () => 1 });
  return { c, store, ...f };
};

// ---------------------------------------------------------------------------

test('starts with the local greeting and does not create a server session just for viewing', async () => {
  const { c, calls } = make();
  await c.init();
  const s = c.getState();
  assert.equal(s.boot, 'ready');
  assert.equal(s.messages.length, 1);
  assert.equal(s.messages[0].content, LOCAL_GREETING);
  assert.equal(calls.start, undefined);
  assert.equal(calls.restore, undefined);
});

test('backend down at load → offline, nothing else attempted', async () => {
  const { c, calls } = make({ checkBackendHealth: async () => false });
  await c.init();
  assert.equal(c.getState().boot, 'offline');
  assert.equal(calls.restore, undefined);
  await c.send('hi'); // ignored while offline
  assert.equal(c.getState().messages.length, 1);
});

test('first message creates the session lazily, remembers it, and shows the reply with quick replies', async () => {
  const { c, store, calls } = make({ sendChatMessage: async () => ok(turn({ reply: 'Nice. What do you do?', quickReplies: ['Calls', 'Quotes'], notices: ['Heads up'] })) });
  await c.init();
  await c.send('  We are Maple Leaf Plumbing  ');
  const s = c.getState();
  assert.equal(calls.start.length, 1);
  assert.equal(store.value, SID);
  assert.equal(s.sessionId, SID);
  assert.deepEqual(s.messages.map((m) => m.role), ['assistant', 'user', 'assistant']);
  assert.equal(s.messages[1].content, 'We are Maple Leaf Plumbing');
  assert.deepEqual(s.messages[2].quickActions?.map((q) => q.label), ['Calls', 'Quotes']);
  assert.deepEqual(s.messages[2].notices, ['Heads up']);
  assert.equal(s.busy, null);
  assert.equal(s.userMessageCount, 1);
  await c.send('second');
  assert.equal(calls.start.length, 1, 'session is reused');
});

test('quick replies disappear once the visitor answers', async () => {
  const { c } = make({ sendChatMessage: async () => ok(turn({ quickReplies: ['A'] })) });
  await c.init();
  await c.send('one');
  assert.ok(c.getState().messages.at(-1)?.quickActions);
  await c.send('two');
  const withButtons = c.getState().messages.filter((m) => m.quickActions);
  assert.equal(withButtons.length, 1, 'only the latest message keeps buttons');
});

test('ignores empty messages, oversized messages (with a message), and sends while busy', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { c, calls } = make({ sendChatMessage: async () => { await gate; return ok(turn()); } });
  await c.init();
  await c.send('   ');
  assert.equal(c.getState().messages.length, 1);
  await c.send('x'.repeat(1001));
  assert.equal(c.getState().messages.length, 1);
  assert.equal(c.getState().error?.error.kind, 'invalid');
  assert.equal(calls.start, undefined);

  const first = c.send('first');
  await until(() => c.getState().busy === 'chat');
  await c.send('second while busy');
  release();
  await first;
  assert.equal(calls.send.length, 1);
  assert.equal(c.getState().messages.filter((m) => m.role === 'user').length, 1);
});

test('a failed send keeps the visitor’s message, offers retry, and retry does not duplicate it', async () => {
  let n = 0;
  const { c, calls } = make({ sendChatMessage: async () => (++n === 1 ? bad('offline') : ok(turn({ reply: 'Got it.' }))) });
  await c.init();
  await c.send('hello');
  let s = c.getState();
  assert.equal(s.error?.action, 'send');
  assert.equal(s.error?.error.kind, 'offline');
  assert.equal(s.busy, null);
  assert.equal(s.messages.filter((m) => m.role === 'user').length, 1);
  c.retry();
  await until(() => c.getState().messages.at(-1)?.content === 'Got it.');
  s = c.getState();
  assert.equal(s.error, null);
  assert.equal(s.messages.filter((m) => m.role === 'user').length, 1, 'no duplicate bubble');
  assert.equal(calls.send.length, 2);
  assert.equal(calls.start.length, 1, 'session not recreated');
});

test('failed session start can be retried', async () => {
  let n = 0;
  const { c } = make({ startSession: async () => (++n === 1 ? bad('timeout') : ok(turn({ stage: 'greet' }))) });
  await c.init();
  await c.send('hello');
  assert.equal(c.getState().error?.action, 'send');
  assert.equal(c.getState().sessionId, null);
  c.retry();
  await until(() => c.getState().sessionId === SID && c.getState().busy === null);
  assert.equal(c.getState().messages.filter((m) => m.role === 'user').length, 1);
});

test('limits and lock-outs block further input permanently', async () => {
  const a = make({ sendChatMessage: async () => bad('limit', 'Conversation limit reached.') });
  await a.c.init(); await a.c.send('hi');
  assert.equal(a.c.getState().blockedMessage, 'Conversation limit reached.');
  assert.equal(a.c.getState().error, null);
  await a.c.send('again');
  assert.equal(a.calls.send.length, 1);

  const b = make({ sendChatMessage: async () => ok(turn({ locked: true, reply: 'Chat closed.', quickReplies: ['x'] })) });
  await b.c.init(); await b.c.send('<script>');
  assert.equal(b.c.getState().blockedMessage, 'Chat closed.');
  assert.equal(b.c.getState().messages.at(-1)?.quickActions, undefined);

  const ip = make({ startSession: async () => bad('limit', 'Too many conversations today.') });
  await ip.c.init(); await ip.c.send('hi');
  assert.equal(ip.c.getState().blockedMessage, 'Too many conversations today.');
});

test('an expired conversation reports it; reset starts clean and forgets the id', async () => {
  const store = memoryStore(SID);
  const { c } = make({ sendChatMessage: async () => bad('expired'), restoreSession: async () => ok(snapshot()) }, store);
  await c.init();
  await c.send('hello');
  assert.equal(c.getState().error?.error.kind, 'expired');
  assert.equal(c.getState().error?.action, 'none');
  c.reset();
  const s = c.getState();
  assert.equal(store.value, null);
  assert.equal(s.sessionId, null);
  assert.equal(s.error, null);
  assert.equal(s.messages.length, 1);
  assert.equal(s.stage, 'new');
});

test('reaching the research stage runs research then the blueprint automatically', async () => {
  const { c, calls } = make({ sendChatMessage: async () => ok(turn({ stage: 'research', reply: "Great, I'll look at the competition." })) });
  await c.init();
  await c.send('No competitors please, find some');
  await until(() => c.getState().blueprint !== null);
  const s = c.getState();
  assert.equal(calls.research.length, 1);
  assert.equal(calls.blueprint.length, 1);
  assert.equal(s.stage, 'refine');
  assert.equal(s.job, null);
  assert.equal(s.busy, null);
  const texts = s.messages.map((m) => m.content);
  assert.ok(texts.some((t) => t.startsWith('I looked at 1 competitor website: comp.com')));
  assert.ok(texts.at(-1)?.startsWith('Your blueprint is ready: 1 page and 1 add-on.'));
  assert.ok(texts.at(-1)?.includes('$1,650 upfront plus $20 a month'));
});

test('job progress is visible while it runs and the visitor cannot type meanwhile', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const states: string[] = [];
  const { c, calls } = make({
    sendChatMessage: async () => ok(turn({ stage: 'research' })),
    streamResearch: async (_id, onP) => { onP?.({ type: 'step', step: 'reading', message: 'x' }); onP?.({ type: 'site', host: 'a.com', role: 'competitor', status: 'done' }); await gate; return ok(rec()); },
  });
  c.subscribe(() => { const j = c.getState().job; if (j) states.push(`${j.kind}:${j.steps.find((s) => s.status === 'active')?.key}`); });
  await c.init();
  await c.send('go');
  await until(() => c.getState().job?.sites['a.com'] === 'done');
  assert.equal(c.getState().job?.kind, 'research');
  await c.send('typing during the job');
  assert.equal(calls.send.length, 1, 'input is ignored while a job runs');
  release();
  await until(() => c.getState().blueprint !== null);
  assert.ok(states.includes('research:reading'));
  assert.ok(states.some((s) => s.startsWith('blueprint:')));
});

test('research failure offers retry, which re-runs from research', async () => {
  let n = 0;
  const { c, calls } = make({
    sendChatMessage: async () => ok(turn({ stage: 'research' })),
    streamResearch: async () => (++n === 1 ? bad('server', 'Something went wrong while researching. Please try again.') : ok(rec())),
  });
  await c.init();
  await c.send('go');
  await until(() => c.getState().error !== null);
  assert.equal(c.getState().error?.action, 'job');
  assert.equal(c.getState().job, null);
  c.retry();
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research.length, 2);
  assert.equal(c.getState().error, null);
});

test('blueprint failure retries only the blueprint (research is not repeated)', async () => {
  let n = 0;
  const { c, calls } = make({
    sendChatMessage: async () => ok(turn({ stage: 'research' })),
    streamBlueprint: async () => (++n === 1 ? bad('timeout') : ok(blueprint())),
  });
  await c.init();
  await c.send('go');
  await until(() => c.getState().error !== null);
  assert.equal(c.getState().stage, 'blueprint');
  c.retry();
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research.length, 1);
  assert.equal(calls.blueprint.length, 2);
});

test('a job is never started twice, even if triggered repeatedly', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { c, calls } = make({
    sendChatMessage: async () => ok(turn({ stage: 'research' })),
    streamResearch: async () => { await gate; return ok(rec()); },
  });
  await c.init();
  await c.send('go');
  await until(() => c.getState().job !== null);
  c.retry(); // nothing to retry
  release();
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research.length, 1);
});

// ---------------------------------------------------------------------------
// Refresh / restore
// ---------------------------------------------------------------------------

test('refresh mid-intake: the chat comes back exactly, with quick replies on the last message', async () => {
  const store = memoryStore(SID);
  const { c, calls } = make({ restoreSession: async () => ok(snapshot({ quickReplies: ['Calls', 'Quotes'] })) }, store);
  await c.init();
  const s = c.getState();
  assert.equal(s.boot, 'ready');
  assert.equal(s.sessionId, SID);
  assert.deepEqual(s.messages.map((m) => m.content), ['Hi', 'We are Maple', 'Great. What do you do?']);
  assert.deepEqual(s.messages.at(-1)?.quickActions?.map((q) => q.label), ['Calls', 'Quotes']);
  assert.equal(s.userMessageCount, 1);
  assert.equal(s.stage, 'intake');
  assert.equal(calls.research, undefined);
  await c.send('We do plumbing');
  assert.equal(calls.start, undefined, 'continues the SAME session');
  assert.equal(calls.send[0][0], SID);
});

test('refresh with a finished blueprint: it is shown straight away and nothing is regenerated', async () => {
  const bp = blueprint();
  const { c, calls } = make({ restoreSession: async () => ok(snapshot({ stage: 'refine', blueprint: bp })) }, memoryStore(SID));
  await c.init();
  await tick();
  assert.deepEqual(c.getState().blueprint, bp);
  assert.equal(c.getState().stage, 'refine');
  assert.equal(calls.research, undefined);
  assert.equal(calls.blueprint, undefined);
});

test('refresh while research is running: reconnects to it and carries on to the blueprint', async () => {
  const { c, calls } = make({ restoreSession: async () => ok(snapshot({ stage: 'research' })) }, memoryStore(SID));
  await c.init();
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research.length, 1);
  assert.equal(calls.blueprint.length, 1);
});

test('refresh while the blueprint is being built: reconnects to just the blueprint', async () => {
  const { c, calls } = make({ restoreSession: async () => ok(snapshot({ stage: 'blueprint', research: rec() })) }, memoryStore(SID));
  await c.init();
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research, undefined);
  assert.equal(calls.blueprint.length, 1);
});

test('refresh of a locked-out conversation stays locked', async () => {
  const { c } = make({ restoreSession: async () => ok(snapshot({ locked: true, messages: [{ role: 'assistant', content: 'Chat closed.' }] })) }, memoryStore(SID));
  await c.init();
  assert.equal(c.getState().blockedMessage, 'Chat closed.');
});

test('a stored id the server no longer knows is dropped quietly and a fresh chat starts', async () => {
  const store = memoryStore(SID);
  const { c } = make({ restoreSession: async () => bad('expired') }, store);
  await c.init();
  assert.equal(store.value, null);
  assert.equal(c.getState().boot, 'ready');
  assert.equal(c.getState().error, null);
  assert.equal(c.getState().messages.length, 1);
});

test('a temporary restore failure keeps the stored id and offers retry', async () => {
  const store = memoryStore(SID);
  let n = 0;
  const { c } = make({ restoreSession: async () => (++n === 1 ? bad('offline') : ok(snapshot())) }, store);
  await c.init();
  assert.equal(store.value, SID, 'not forgotten');
  assert.equal(c.getState().error?.action, 'init');
  c.retry();
  await until(() => c.getState().sessionId === SID);
  assert.equal(c.getState().messages.length, 3);
});

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

const withBlueprint = (over: Partial<AgentApi> = {}) => make({ restoreSession: async () => ok(snapshot({ stage: 'refine', blueprint: blueprint() })), ...over }, memoryStore(SID));

test('edit: applies the server’s repriced blueprint and reports the server’s wording and estimate', async () => {
  const next = blueprint(); next.pricing.totals.initialInvestment = 1250; next.pricing.totals.monthly = 0;
  const { c, calls } = withBlueprint({ editBlueprint: async () => ok({ blueprint: next, changes: ['Removed "Booking".'], refused: [], notice: 'Price adjusted.', estimate: 'x' }) });
  await c.init();
  await c.edit([{ op: 'toggle_addon', sku: 'addon-booking', on: false }]);
  const s = c.getState();
  assert.equal(s.blueprint?.pricing.totals.initialInvestment, 1250);
  assert.equal(s.busy, null);
  const last = s.messages.at(-1)!;
  assert.equal(last.content, 'Removed "Booking". Your estimate is now $1,250 upfront.');
  assert.deepEqual(last.notices, ['Price adjusted.']);
  assert.equal(calls.edit.length, 1);
});

test('edit: a refused change leaves the blueprint alone and says why', async () => {
  const { c } = withBlueprint({ editBlueprint: async () => ok({ blueprint: blueprint(), changes: [], refused: ["I've kept Home: every website needs a Home and a Contact page."], notice: null, estimate: 'Your estimate is $1,650 plus $20 a month.' }) });
  await c.init();
  await c.edit([{ op: 'remove_page', id: 'home' }]);
  assert.equal(c.getState().messages.at(-1)?.content, "I've kept Home: every website needs a Home and a Contact page. Your estimate is $1,650 plus $20 a month.");
});

test('edit: failures surface as an error without retry loops, and the blueprint stays as it was', async () => {
  const { c } = withBlueprint({ editBlueprint: async () => bad('timeout') });
  await c.init();
  const before = c.getState().blueprint;
  await c.edit([{ op: 'remove_page', id: 'x' }]);
  assert.equal(c.getState().error?.error.kind, 'timeout');
  assert.equal(c.getState().error?.action, 'none');
  assert.equal(c.getState().blueprint, before);
  assert.equal(c.getState().busy, null);
});

test('edit: only one at a time, and none without a blueprint or during a job', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const w = withBlueprint({ editBlueprint: async () => { await gate; return ok({ blueprint: blueprint(), changes: ['Done.'], refused: [], notice: null, estimate: 'x' }); } });
  await w.c.init();
  const first = w.c.edit([{ op: 'remove_page', id: 'a' }]);
  await until(() => w.c.getState().busy === 'edit');
  await w.c.edit([{ op: 'remove_page', id: 'b' }]);
  await w.c.send('chat while editing');
  release();
  await first;
  assert.equal(w.calls.edit.length, 1);
  assert.equal(w.calls.send, undefined);

  const none = make();
  await none.c.init();
  await none.c.edit([{ op: 'remove_page', id: 'a' }]);
  assert.equal(none.calls.edit, undefined);
});

test('refine chat: a message that changes the plan updates the blueprint', async () => {
  const next = blueprint(); next.pricing.totals.initialInvestment = 999;
  const { c } = withBlueprint({ sendChatMessage: async () => ok(turn({ stage: 'refine', reply: 'Removed the blog.', blueprint: next })) });
  await c.init();
  await c.send('remove the blog');
  assert.equal(c.getState().blueprint?.pricing.totals.initialInvestment, 999);
  assert.equal(c.getState().messages.at(-1)?.content, 'Removed the blog.');
});

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

test('reset during a reply: the late reply from the old conversation is discarded', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { c } = make({ sendChatMessage: async () => { await gate; return ok(turn({ reply: 'OLD CONVERSATION' })); } });
  await c.init();
  const p = c.send('hello');
  await until(() => c.getState().busy === 'chat');
  c.reset();
  release();
  await p;
  const s = c.getState();
  assert.equal(s.messages.length, 1);
  assert.ok(!s.messages.some((m) => m.content === 'OLD CONVERSATION'));
  assert.equal(s.busy, null);
  assert.equal(s.sessionId, null);
});

test('reset during a job: a late blueprint cannot reappear', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { c } = make({ sendChatMessage: async () => ok(turn({ stage: 'research' })), streamResearch: async () => { await gate; return ok(rec()); } });
  await c.init();
  await c.send('go');
  await until(() => c.getState().job !== null);
  c.reset();
  assert.equal(c.getState().job, null);
  release();
  await tick(); await tick();
  assert.equal(c.getState().blueprint, null);
  assert.equal(c.getState().job, null);
  // and the next conversation can run its own job
  await c.send('again');
  await until(() => c.getState().blueprint !== null);
});

test('dispose cancels in-flight work and stops notifying', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { c } = make({ sendChatMessage: async () => { await gate; return ok(turn()); } });
  let notified = 0;
  c.subscribe(() => notified++);
  await c.init();
  const p = c.send('hi');
  await until(() => c.getState().busy === 'chat');
  const before = notified;
  c.dispose();
  release();
  await p;
  assert.equal(notified, before);
});

test('a disposed controller can be revived by init (StrictMode remount)', async () => {
  const { c } = make();
  await c.init();
  c.dispose();
  await c.init();
  assert.equal(c.getState().boot, 'ready');
  await c.send('hello');
  assert.equal(c.getState().messages.at(-1)?.role, 'assistant');
});

// ---------------------------------------------------------------------------
// Regressions from the phase-6 review
// ---------------------------------------------------------------------------

test('a failed blueprint job is never a dead end: typing again (even after dismissing) restarts it', async () => {
  let n = 0;
  const { c, calls } = make({
    sendChatMessage: async (_id, m) => ok(turn(m === 'go' ? { stage: 'research' } : { stage: 'blueprint', reply: 'Your research is done. Your blueprint is the next step.' })),
    streamBlueprint: async () => (++n === 1 ? bad('timeout') : ok(blueprint())),
  });
  await c.init();
  await c.send('go');
  await until(() => c.getState().error !== null);
  c.dismissError();
  assert.equal(c.getState().error, null);
  assert.equal(c.getState().stage, 'blueprint');
  assert.equal(c.getState().job, null);
  await c.send('hello?');
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.blueprint.length, 2);
  assert.equal(calls.research.length, 1, 'research is not repeated');
});

test('a malformed blueprint cannot leave the page stuck working', async () => {
  const broken = { ...blueprint(), pricing: undefined } as never;
  const { c } = make({ sendChatMessage: async () => ok(turn({ stage: 'research' })), streamBlueprint: async () => ok(broken) });
  const realError = console.error; console.error = () => {};
  try {
    await c.init();
    await c.send('go');
    await until(() => c.getState().error !== null);
  } finally { console.error = realError; }
  const s = c.getState();
  assert.equal(s.job, null);
  assert.equal(s.blueprint, null);
  assert.equal(s.error?.error.kind, 'bad_response');
  assert.equal(s.busy, null);
});

test('a controller disposed during a job can run jobs again after a remount', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let first = true;
  const { c, calls } = make({
    restoreSession: async () => ok(snapshot({ stage: 'research' })),
    streamResearch: async () => { if (first) { first = false; await gate; } return ok(rec()); },
  }, memoryStore(SID));
  await c.init();
  await until(() => c.getState().job !== null);
  c.dispose();
  release();
  await c.init(); // remount: must be able to resume the job
  await until(() => c.getState().blueprint !== null);
  assert.equal(calls.research.length, 2);
});

// ---------------------------------------------------------------------------
// Demo mode through the real controller
// ---------------------------------------------------------------------------

import { createDemoApi } from '../../src/components/BlueprintAgent/demoApi';

test('demo: the whole journey runs through the real controller, labelled as a demo, and nothing is saved', async () => {
  const store = memoryStore();
  const c = new AgentController({ api: createDemoApi({ stepMs: 0 }), store, demo: true, now: () => 1 });
  assert.equal(c.getState().demo, true);
  await c.init();
  assert.equal(c.getState().boot, 'ready');
  await c.send('We are Maple Leaf Plumbing');
  await c.send('drain cleaning in Austin');
  await c.send('More phone calls');
  await until(() => c.getState().blueprint !== null);
  const s = c.getState();
  assert.equal(s.demo, true);
  assert.equal(s.stage, 'refine');
  assert.equal(s.job, null);
  assert.equal(store.value, null, 'a demo is never remembered');
  assert.ok(s.messages.some((m) => m.notices?.some((n) => n.startsWith('Demo mode'))));
  assert.equal(s.blueprint?.pricing.totals.initialInvestment, 2250);

  await c.edit([{ op: 'remove_page', id: 'roof-replacement' }]);
  assert.equal(c.getState().blueprint?.pricing.totals.initialInvestment, 2000);
  assert.match(c.getState().messages.at(-1)!.content, /^Removed "Roof Replacement"\. The example estimate is now \$2,000 upfront plus \$49 a month\.$/);
  const texts = c.getState().messages.map((m) => m.content).join('\n');
  assert.match(texts, /made-up example competitors \(this is not real research\)/);
  assert.match(texts, /Here is the example plan: 8 pages and 1 add-on\. The example estimate is \$2,250.*not a quote for yours/);
  assert.ok(!/Your estimate is/.test(texts), 'no demo message may read like a real quote');

  c.reset();
  assert.equal(c.getState().demo, true, 'reset keeps the demo label');
  assert.equal(c.getState().blueprint, null);
});

test('demo: a live controller is never labelled demo', () => {
  assert.equal(new AgentController({ api: fakeApi().api, store: memoryStore() }).getState().demo, false);
});

test('demo: a second journey after "start a new conversation" runs the full intake again', async () => {
  const c = new AgentController({ api: createDemoApi({ stepMs: 0 }), demo: true, now: () => 1 });
  await c.init();
  await c.send('first'); await c.send('second'); await c.send('third');
  await until(() => c.getState().blueprint !== null);
  c.reset();
  await c.send('We are a different business');
  let s = c.getState();
  assert.equal(s.stage, 'intake', 'the intake starts again, it does not jump to research');
  assert.equal(s.blueprint, null);
  assert.equal(s.progress.filled, 2);
  await c.send('services'); await c.send('More phone calls');
  await until(() => c.getState().blueprint !== null);
  s = c.getState();
  assert.equal(s.blueprint?.pricing.totals.initialInvestment, 2250, 'fresh example plan, not the edited one');
});
