import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkBackendHealth, editBlueprint, parseBlueprint, sendChatMessage, startSession, streamBlueprint, streamResearch,
  type ApiResult,
} from '../../src/components/BlueprintAgent/api';
import type { BlueprintProgress, ResearchProgress } from '../../src/components/BlueprintAgent/wire';
import { BASE, SID, blueprint, chatTurn, fakeFetch, instantSleep, json, research, sse, sseBlock } from './helpers';

const opts = (f: typeof fetch, extra: Record<string, unknown> = {}) => ({ baseUrl: BASE, fetchImpl: f, sleep: instantSleep, ...extra });
const errKind = <T,>(r: ApiResult<T>) => (r.ok ? 'ok' : r.error.kind);

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

test('chat: sends only sessionId and message, and parses the turn', async () => {
  const f = fakeFetch([json(chatTurn())]);
  const r = await sendChatMessage(SID, '  Hi there  ', opts(f.fetch));
  assert.ok(r.ok);
  assert.equal(r.ok && r.data.reply, 'Hello!');
  assert.deepEqual(r.ok && r.data.quickReplies, ['A', 'B']);
  assert.equal(r.ok && r.data.blueprint, null);
  assert.equal(f.calls[0].url, `${BASE}/api/chat`);
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { sessionId: SID, message: 'Hi there' });
  const headers = f.calls[0].init.headers as Record<string, string>;
  assert.deepEqual(Object.keys(headers), ['Content-Type']); // the backend's CORS only allows this one
});

test('chat: rejects bad input without touching the network', async () => {
  const f = fakeFetch([json(chatTurn())]);
  assert.equal(errKind(await sendChatMessage(SID, '   ', opts(f.fetch))), 'invalid');
  assert.equal(errKind(await sendChatMessage(SID, 'x'.repeat(1001), opts(f.fetch))), 'invalid');
  assert.equal(errKind(await sendChatMessage('not-a-uuid', 'hi', opts(f.fetch))), 'expired');
  assert.equal(f.calls.length, 0);
});

test('chat: a locked-out turn is data, not an error', async () => {
  const f = fakeFetch([json(chatTurn({ locked: true, reply: 'Locked.', quickReplies: [] }))]);
  const r = await sendChatMessage(SID, 'hi', opts(f.fetch));
  assert.ok(r.ok && r.data.locked);
});

test('chat: refine turn carries a validated blueprint', async () => {
  const f = fakeFetch([json(chatTurn({ stage: 'refine', blueprint: blueprint() }))]);
  const r = await sendChatMessage(SID, 'remove the blog', opts(f.fetch));
  assert.ok(r.ok && r.data.blueprint?.pricing.totals.initialInvestment === 1650);
});

test('chat: maps server error codes to stable kinds', async () => {
  const cases: [number, string | undefined, string][] = [
    [429, 'message_limit', 'limit'], [429, 'ip_limit', 'limit'], [404, 'not_found', 'expired'], [409, 'busy', 'busy'],
    [409, 'not_ready', 'not_ready'], [503, 'unavailable', 'unavailable'], [400, 'invalid', 'invalid'],
    [429, 'rate_limited', 'busy'], [429, undefined, 'limit'], [404, undefined, 'expired'], [500, undefined, 'server'], [502, undefined, 'server'],
  ];
  for (const [status, code, kind] of cases) {
    const f = fakeFetch([json({ error: 'Server words.', code }, status)]);
    const r = await sendChatMessage(SID, 'hi', opts(f.fetch));
    assert.equal(errKind(r), kind, `${status}/${code}`);
  }
});

test('chat: a burst throttle (rate_limited) is retryable and shows the server text, unlike the daily caps', async () => {
  const r = await sendChatMessage(SID, 'hi', opts(fakeFetch([json({ error: 'Too quick. Wait a moment.', code: 'rate_limited' }, 429)]).fetch));
  assert.ok(!r.ok && r.error.kind === 'busy' && r.error.retryable && r.error.message === 'Too quick. Wait a moment.');
});

test('chat: shows the server text only for fixed visitor-facing kinds', async () => {
  const lim = await sendChatMessage(SID, 'hi', opts(fakeFetch([json({ error: 'Length limit reached.', code: 'message_limit' }, 429)]).fetch));
  assert.equal(!lim.ok && lim.error.message, 'Length limit reached.');
  assert.equal(!lim.ok && lim.error.retryable, false);
  // A 5xx body could contain anything (stack traces, proxy text): never surfaced.
  const bad = await sendChatMessage(SID, 'hi', opts(fakeFetch([json({ error: 'TypeError: secret internals at db.ts:1' }, 500)]).fetch));
  assert.ok(!bad.ok && !bad.error.message.includes('secret'));
});

test('chat: non-JSON error pages fall back to the status', async () => {
  const f = fakeFetch([new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })]);
  const r = await sendChatMessage(SID, 'hi', opts(f.fetch));
  assert.ok(!r.ok && r.error.kind === 'server' && !r.error.message.includes('html'));
});

test('chat: malformed replies become bad_response, never a crash', async () => {
  const bads: unknown[] = [
    null, 'text', [], {}, chatTurn({ reply: 5 }), chatTurn({ stage: 'hacked' }), chatTurn({ sessionId: 'nope' }),
    chatTurn({ stage: 'refine', blueprint: { version: 1 } }),
    chatTurn({ stage: 'refine', blueprint: { ...blueprint(), pricing: { totals: {} } } }),
  ];
  for (const b of bads) {
    const r = await sendChatMessage(SID, 'hi', opts(fakeFetch([json(b)]).fetch));
    assert.equal(errKind(r), 'bad_response', JSON.stringify(b)?.slice(0, 60));
  }
  const notJson = await sendChatMessage(SID, 'hi', opts(fakeFetch([new Response('nope', { status: 200 })]).fetch));
  assert.equal(errKind(notJson), 'bad_response');
});

test('chat: tolerates missing optional fields and drops junk list entries', async () => {
  const f = fakeFetch([json({ sessionId: SID, reply: 'ok', stage: 'intake', quickReplies: ['a', 3, null], notices: 'x' })]);
  const r = await sendChatMessage(SID, 'hi', opts(f.fetch));
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.data.quickReplies, ['a']);
  assert.deepEqual(r.ok && r.data.notices, []);
  assert.deepEqual(r.ok && r.data.progress, { required: 0, filled: 0 });
});

test('chat: network failure is offline and retryable', async () => {
  const f = fakeFetch([new TypeError('Failed to fetch')]);
  const r = await sendChatMessage(SID, 'hi', opts(f.fetch));
  assert.ok(!r.ok && r.error.kind === 'offline' && r.error.retryable);
});

test('chat: times out', async () => {
  const f = fakeFetch([(c) => new Promise<Response>((_, reject) => c.init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))]);
  const r = await sendChatMessage(SID, 'hi', opts(f.fetch, { timeouts: { chat: 30 } }));
  assert.equal(errKind(r), 'timeout');
});

test('chat: caller abort wins over everything', async () => {
  const ctl = new AbortController();
  const f = fakeFetch([(c) => new Promise<Response>((_, reject) => c.init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))]);
  const p = sendChatMessage(SID, 'hi', opts(f.fetch, { signal: ctl.signal }));
  setTimeout(() => ctl.abort(), 10);
  assert.equal(errKind(await p), 'aborted');
  assert.equal(errKind(await sendChatMessage(SID, 'hi', opts(f.fetch, { signal: ctl.signal }))), 'aborted');
});

// ---------------------------------------------------------------------------
// Start, health, edit
// ---------------------------------------------------------------------------

test('startSession: returns the greeting turn', async () => {
  const f = fakeFetch([json(chatTurn({ stage: 'greet', reply: 'Welcome' }))]);
  const r = await startSession(opts(f.fetch));
  assert.ok(r.ok && r.data.reply === 'Welcome' && r.data.sessionId === SID);
  assert.equal(f.calls[0].url, `${BASE}/api/chat/start`);
});

test('startSession: IP limit is a non-retryable limit error', async () => {
  const r = await startSession(opts(fakeFetch([json({ error: 'Too many conversations.', code: 'ip_limit' }, 429)]).fetch));
  assert.ok(!r.ok && r.error.kind === 'limit' && !r.error.retryable);
});

test('health: true on 200, false on failure or timeout', async () => {
  assert.equal(await checkBackendHealth(opts(fakeFetch([json({ ok: true })]).fetch)), true);
  assert.equal(await checkBackendHealth(opts(fakeFetch([json({}, 500)]).fetch)), false);
  assert.equal(await checkBackendHealth(opts(fakeFetch([new TypeError('x')]).fetch)), false);
  const hang = fakeFetch([(c) => new Promise<Response>((_, rej) => c.init.signal?.addEventListener('abort', () => rej(new Error('a'))))]);
  assert.equal(await checkBackendHealth(opts(hang.fetch, { timeouts: { health: 20 } })), false);
  const f = fakeFetch([json({})]);
  await checkBackendHealth(opts(f.fetch));
  assert.equal(f.calls[0].init.method, 'GET');
  assert.equal(f.calls[0].init.headers, undefined); // a simple GET: no CORS preflight
});

test('edit: sends normalized ops and parses the repriced blueprint', async () => {
  const f = fakeFetch([json({ blueprint: blueprint(), changes: ['Removed "Blog".'], refused: [], notice: null, estimate: 'Your estimate is $1,650 plus $20 a month.' })]);
  const r = await editBlueprint(SID, [{ op: 'remove_page', id: 'blog' }, { op: 'toggle_addon', sku: 'addon-booking', on: false }, { op: 'toggle_article', id: 'a1', on: true }], opts(f.fetch));
  assert.ok(r.ok && r.data.changes[0] === 'Removed "Blog".' && r.data.notice === null);
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), {
    sessionId: SID,
    ops: [{ op: 'remove_page', id: 'blog' }, { op: 'toggle_addon', sku: 'addon-booking', on: false }, { op: 'toggle_article', id: 'a1', on: true }],
  });
});

test('edit: validates locally, and maps server refusals', async () => {
  const f = fakeFetch([json({ error: 'Your blueprint is not ready yet.', code: 'not_ready' }, 409)]);
  assert.equal(errKind(await editBlueprint(SID, [], opts(f.fetch))), 'invalid');
  assert.equal(errKind(await editBlueprint(SID, Array.from({ length: 21 }, () => ({ op: 'remove_page' as const, id: 'x' })), opts(f.fetch))), 'invalid');
  assert.equal(f.calls.length, 0);
  assert.equal(errKind(await editBlueprint(SID, [{ op: 'remove_page', id: 'x' }], opts(f.fetch))), 'not_ready');
  const bad = await editBlueprint(SID, [{ op: 'remove_page', id: 'x' }], opts(fakeFetch([json({ blueprint: {}, estimate: 'x' })]).fetch));
  assert.equal(errKind(bad), 'bad_response');
});

test('parseBlueprint: rejects structurally wrong blueprints and normalizes optional parts', () => {
  assert.equal(parseBlueprint(null), null);
  assert.equal(parseBlueprint({ ...blueprint(), version: 2 }), null);
  assert.equal(parseBlueprint({ ...blueprint(), pages: 'x' }), null);
  assert.equal(parseBlueprint({ ...blueprint(), pages: [{ id: 1 }] }), null);
  assert.equal(parseBlueprint({ ...blueprint(), pages: Array.from({ length: 101 }, () => blueprint().pages[0]) }), null);
  const loose = parseBlueprint({ ...blueprint(), facts: undefined, notices: ['a', 1], status: 'weird' });
  assert.ok(loose);
  assert.deepEqual(loose.facts, []);
  assert.deepEqual(loose.notices, ['a']);
  assert.equal(loose.status, 'complete');
});

// ---------------------------------------------------------------------------
// Streaming: blueprint and research
// ---------------------------------------------------------------------------

test('blueprint stream: forwards progress in order, then resolves with the blueprint', async () => {
  const seen: BlueprintProgress[] = [];
  const f = fakeFetch([sse([
    sseBlock('step', { type: 'step', step: 'retrieving', message: 'Gathering…' }),
    sseBlock('step', { type: 'step', step: 'writing', message: 'Outlining…' }),
    sseBlock('page', { type: 'page', done: 2, total: 10 }),
    sseBlock('done', blueprint()),
  ])]);
  const r = await streamBlueprint(SID, (e) => seen.push(e), opts(f.fetch));
  assert.ok(r.ok && r.data.pricing.totals.initialInvestment === 1650);
  assert.deepEqual(seen.map((e) => e.type), ['step', 'step', 'page']);
  assert.deepEqual(seen[2], { type: 'page', done: 2, total: 10 });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)), { sessionId: SID });
});

test('blueprint stream: survives arbitrary chunk boundaries (multi-byte characters too)', async () => {
  const text = sseBlock('step', { type: 'step', step: 'pricing', message: 'Café — prix 💰' }) + sseBlock('done', blueprint());
  const bytes = new TextEncoder().encode(text);
  const enc = new TextDecoder();
  void enc;
  const chunks = Array.from({ length: Math.ceil(bytes.length / 7) }, (_, i) => bytes.slice(i * 7, i * 7 + 7));
  const seen: BlueprintProgress[] = [];
  const stream = new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(x)); c.close(); } });
  const f = fakeFetch([new Response(stream, { headers: { 'content-type': 'text/event-stream' } })]);
  const r = await streamBlueprint(SID, (e) => seen.push(e), opts(f.fetch));
  assert.ok(r.ok);
  assert.equal(seen[0]?.type === 'step' && seen[0].message, 'Café — prix 💰');
});

test('blueprint stream: ignores keep-alives, unknown events, garbled and malformed progress', async () => {
  const seen: BlueprintProgress[] = [];
  const f = fakeFetch([sse([
    ': keep-alive\n\n',
    sseBlock('mystery', { x: 1 }),
    'event: step\ndata: {not json\n\n',
    sseBlock('page', { type: 'page', done: 'a', total: 3 }),
    sseBlock('page', { type: 'page', done: 99, total: 3 }), // clamped
    sseBlock('done', blueprint()),
  ])]);
  const r = await streamBlueprint(SID, (e) => seen.push(e), opts(f.fetch));
  assert.ok(r.ok);
  assert.deepEqual(seen, [{ type: 'page', done: 3, total: 3 }]);
});

test('blueprint stream: a throwing progress handler cannot break the stream', async () => {
  const f = fakeFetch([sse([sseBlock('page', { done: 1, total: 2 }), sseBlock('done', blueprint())])]);
  const realError = console.error; console.error = () => {};
  try {
    const r = await streamBlueprint(SID, () => { throw new Error('ui bug'); }, opts(f.fetch));
    assert.ok(r.ok);
  } finally { console.error = realError; }
});

test('blueprint stream: server error event is a retryable server error, with no auto-retry', async () => {
  const f = fakeFetch([sse([sseBlock('error', { message: 'Something went wrong while building your blueprint. Please try again.' })])]);
  const r = await streamBlueprint(SID, undefined, opts(f.fetch));
  assert.ok(!r.ok && r.error.kind === 'server' && r.error.retryable);
  assert.ok(!r.ok && r.error.message.startsWith('Something went wrong'));
  assert.equal(f.calls.length, 1);
});

test('blueprint stream: a malformed done payload is bad_response', async () => {
  const f = fakeFetch([sse([sseBlock('done', { pages: [] })])]);
  assert.equal(errKind(await streamBlueprint(SID, undefined, opts(f.fetch))), 'bad_response');
});

test('blueprint stream: JSON errors before the stream opens are classified', async () => {
  for (const [status, code, kind] of [[404, 'not_found', 'expired'], [409, 'not_ready', 'not_ready'], [503, 'unavailable', 'unavailable']] as const) {
    const f = fakeFetch([json({ error: 'x', code }, status)]);
    const r = await streamBlueprint(SID, undefined, opts(f.fetch));
    // `unavailable` is waitable only after a stream has been seen, so it fails fast here.
    assert.equal(errKind(r), kind);
    assert.equal(f.calls.length, 1);
  }
});

test('blueprint stream: a non-SSE 200 (proxy page) is bad_response', async () => {
  const f = fakeFetch([new Response('<html>hi</html>', { headers: { 'content-type': 'text/html' } })]);
  assert.equal(errKind(await streamBlueprint(SID, undefined, opts(f.fetch))), 'bad_response');
});

test('blueprint stream: first connection refused is offline immediately (no endless retry)', async () => {
  const f = fakeFetch([new TypeError('Failed to fetch')]);
  const r = await streamBlueprint(SID, undefined, opts(f.fetch));
  assert.equal(errKind(r), 'offline');
  assert.equal(f.calls.length, 1);
});

test('blueprint stream: dropped mid-stream, reconnects and receives the replayed result', async () => {
  const seen: BlueprintProgress[] = [];
  const f = fakeFetch([
    sse([sseBlock('page', { done: 1, total: 5 })]), // closes with no terminal event
    json({ error: 'Your blueprint is already being built.', code: 'in_progress' }, 409), // still running
    sse([sseBlock('done', blueprint())]), // finished: replay
  ]);
  const r = await streamBlueprint(SID, (e) => seen.push(e), opts(f.fetch));
  assert.ok(r.ok);
  assert.equal(f.calls.length, 3);
  assert.equal(seen.length, 1);
});

test('blueprint stream: after a drop, a flaky network is waited out', async () => {
  const f = fakeFetch([
    sse([sseBlock('page', { done: 1, total: 5 })]),
    new TypeError('Failed to fetch'),
    json({}, 503),
    sse([sseBlock('done', blueprint())]),
  ]);
  const r = await streamBlueprint(SID, undefined, opts(f.fetch));
  assert.ok(r.ok);
  assert.equal(f.calls.length, 4);
});

test('blueprint stream: reconnect backs off between attempts', async () => {
  const delays: number[] = [];
  const f = fakeFetch([sse([]), sse([]), sse([]), sse([]), sse([sseBlock('done', blueprint())])]);
  const r = await streamBlueprint(SID, undefined, { baseUrl: BASE, fetchImpl: f.fetch, sleep: async (ms) => { delays.push(ms); } });
  assert.ok(r.ok);
  assert.deepEqual(delays, [1500, 3000, 5000, 5000]);
});

test('blueprint stream: a stalled stream (no bytes, no keep-alive) is cut and resumed', async () => {
  const f = fakeFetch([
    (c) => sse([sseBlock('page', { done: 1, total: 5 })], { hold: true, signal: c.init.signal as AbortSignal }),
    sse([sseBlock('done', blueprint())]),
  ]);
  const r = await streamBlueprint(SID, undefined, opts(f.fetch, { timeouts: { streamIdle: 40 } }));
  assert.ok(r.ok);
  assert.equal(f.calls.length, 2);
});

test('blueprint stream: keep-alive comments keep a quiet stream alive', async () => {
  const enc = new TextEncoder();
  let ctl!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(c) { ctl = c; } });
  const f = fakeFetch([new Response(stream, { headers: { 'content-type': 'text/event-stream' } })]);
  const p = streamBlueprint(SID, undefined, opts(f.fetch, { timeouts: { streamIdle: 80 } }));
  for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 40)); ctl.enqueue(enc.encode(': keep-alive\n\n')); }
  ctl.enqueue(enc.encode(sseBlock('done', blueprint()))); ctl.close();
  const r = await p;
  assert.ok(r.ok);
  assert.equal(f.calls.length, 1); // never reconnected: 160ms of quiet > one idle window of 80ms, but pings reset it
});

test('blueprint stream: gives up at the overall deadline with a timeout', async () => {
  const f = fakeFetch([(c) => sse([], { hold: true, signal: c.init.signal as AbortSignal })]);
  const r = await streamBlueprint(SID, undefined, opts(f.fetch, { timeouts: { blueprintTotal: 60, streamIdle: 1000 } }));
  assert.equal(errKind(r), 'timeout');
});

test('blueprint stream: an endless in_progress still ends at the deadline', async () => {
  const f = fakeFetch([() => json({ error: 'x', code: 'in_progress' }, 409)]); // a fresh Response per call
  let sleeps = 0;
  const r = await streamBlueprint(SID, undefined, {
    baseUrl: BASE, fetchImpl: f.fetch, timeouts: { blueprintTotal: 80 },
    sleep: (ms, signal) => { sleeps++; return new Promise((res) => { const t = setTimeout(res, 15); signal?.addEventListener('abort', () => { clearTimeout(t); res(); }); }); },
  });
  assert.equal(errKind(r), 'timeout');
  assert.ok(sleeps >= 2);
});

test('blueprint stream: caller abort cancels cleanly mid-stream', async () => {
  const ctl = new AbortController();
  const f = fakeFetch([(c) => sse([sseBlock('page', { done: 1, total: 5 })], { hold: true, signal: c.init.signal as AbortSignal })]);
  const p = streamBlueprint(SID, undefined, opts(f.fetch, { signal: ctl.signal }));
  setTimeout(() => ctl.abort(), 20);
  assert.equal(errKind(await p), 'aborted');
  assert.equal(f.calls.length, 1);
});

test('blueprint stream: refuses a hostile oversized event instead of buffering it', async () => {
  const big = 'data: ' + 'x'.repeat(1_000_000) + '\n';
  const f = fakeFetch([sse(Array.from({ length: 6 }, () => big))]);
  assert.equal(errKind(await streamBlueprint(SID, undefined, opts(f.fetch))), 'bad_response');
});

test('blueprint stream: rejects an invalid session id before any request', async () => {
  const f = fakeFetch([sse([])]);
  assert.equal(errKind(await streamBlueprint('nope', undefined, opts(f.fetch))), 'expired');
  assert.equal(f.calls.length, 0);
});

test('research stream: forwards typed progress and resolves with the record', async () => {
  const seen: ResearchProgress[] = [];
  const f = fakeFetch([sse([
    sseBlock('step', { type: 'step', step: 'discovering', message: 'Finding local plumbing competitors in Austin…' }),
    sseBlock('competitors', { type: 'competitors', items: [{ name: 'Comp', host: 'comp.com', source: 'discovered', reason: 'Top local result' }, { bad: 1 }] }),
    sseBlock('site', { type: 'site', host: 'comp.com', role: 'competitor', status: 'reading' }),
    sseBlock('site', { type: 'site', host: 'comp.com', role: 'competitor', status: 'done', pages: 4 }),
    sseBlock('done', research()),
  ])]);
  const r = await streamResearch(SID, (e) => seen.push(e), opts(f.fetch));
  assert.ok(r.ok && r.data.sites[0].host === 'comp.com' && r.data.findings?.competitors.length === 0);
  assert.equal(f.calls[0].url, `${BASE}/api/research`);
  assert.deepEqual(seen.map((e) => e.type), ['step', 'competitors', 'site', 'site']);
  const comp = seen[1];
  assert.ok(comp.type === 'competitors' && comp.items.length === 1 && comp.items[0].reason === 'Top local result');
  const done = seen[3];
  assert.ok(done.type === 'site' && done.pages === 4);
});

test('research stream: partial and failed records are still delivered as data', async () => {
  const rec = { ...research(), status: 'partial', findings: null, notices: ["I couldn't read two sites."] };
  const r = await streamResearch(SID, undefined, opts(fakeFetch([sse([sseBlock('done', rec)])]).fetch));
  assert.ok(r.ok && r.data.status === 'partial' && r.data.findings === null && r.data.notices.length === 1);
});

test('research stream: malformed records and unknown statuses are rejected', async () => {
  for (const bad of [{ status: 'weird', sites: [] }, { status: 'complete' }, { status: 'complete', sites: [{ nope: 1 }] }, { ...research(), findings: { competitors: 'x' } }]) {
    const r = await streamResearch(SID, undefined, opts(fakeFetch([sse([sseBlock('done', bad)])]).fetch));
    assert.equal(errKind(r), 'bad_response');
  }
});

test('research stream: reconnect to a busy server waits, then replays', async () => {
  const f = fakeFetch([
    sse([sseBlock('step', { step: 'reading', message: 'Reading…' })]),
    json({ error: 'Busy right now.', code: 'busy' }, 503),
    sse([sseBlock('done', research())]),
  ]);
  const r = await streamResearch(SID, undefined, opts(f.fetch));
  assert.ok(r.ok);
  assert.equal(f.calls.length, 3);
});

test('parseBlueprint: normalizes sections, evidence and optional text so rendering cannot throw', () => {
  const messy = blueprint();
  (messy.pages[0] as unknown as Record<string, unknown>).sections = [
    { heading: 'Hero', purpose: 5, subsections: [{ heading: 'Intro' }, { nope: 1 }, 'x'] },
    { purpose: 'no heading' },
    'junk',
  ];
  (messy.pages[0] as unknown as Record<string, unknown>).evidence = ['c1-F1', 7];
  (messy.addons[0] as unknown as Record<string, unknown>).reason = undefined;
  (messy.pricing as unknown as Record<string, unknown>).extraPages = undefined;
  (messy as unknown as Record<string, unknown>).facts = [{ id: 'c1-F1', text: 'ok' }, { id: 5 }, null];
  const out = parseBlueprint(messy);
  assert.ok(out);
  assert.deepEqual(out.pages[0].sections, [{ heading: 'Hero', purpose: '', subsections: [{ heading: 'Intro', content: '' }] }]);
  assert.deepEqual(out.pages[0].evidence, ['c1-F1']);
  assert.equal(out.addons[0].reason, '');
  assert.deepEqual(out.pricing.extraPages, []);
  assert.deepEqual(out.facts, [{ id: 'c1-F1', text: 'ok' }]);
});

test('parseBlueprint: rejects a missing website type name or page allowance', () => {
  const a = blueprint(); (a.pricing.websiteType as unknown as Record<string, unknown>).name = undefined;
  assert.equal(parseBlueprint(a), null);
  const b = blueprint(); (b.pricing.websiteType as unknown as Record<string, unknown>).includedPages = 'five';
  assert.equal(parseBlueprint(b), null);
});

test('research stream: junk claims are dropped instead of reaching the UI', async () => {
  const rec = research() as Record<string, any>;
  rec.findings.opportunities = [{ point: 'Add booking.', support: 'evidenced' }, { nope: 1 }, 'x', { point: 5 }];
  rec.findings.competitors = [{ key: 'c1', name: 'A', host: 'a.com', whatWorks: [{ point: 'ok' }, 3], gaps: 'x' }, { bad: 1 }];
  const r = await streamResearch(SID, undefined, opts(fakeFetch([sse([sseBlock('done', rec)])]).fetch));
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.data.findings?.opportunities.map((o) => o.point), ['Add booking.']);
  assert.equal(r.ok && r.data.findings?.competitors.length, 1);
  assert.equal(r.ok && r.data.findings?.competitors[0].whatWorks.length, 1);
  assert.deepEqual(r.ok && r.data.findings?.competitors[0].gaps, []);
});
