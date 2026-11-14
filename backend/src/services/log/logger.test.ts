// Logging: structure, redaction (secrets, visitor text, session ids) and request correlation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { Metrics } from './metrics.js';
import { createLogger, runWithRequestId, scrubString, serializeError, type LogLevel } from './logger.js';

function capture(level = 'debug') {
  const lines: { level: LogLevel; rec: Record<string, any>; raw: string }[] = [];
  const log = createLogger({
    level: () => level,
    sink: (l, raw) => lines.push({ level: l, rec: JSON.parse(raw), raw }),
    now: () => new Date('2030-01-01T00:00:00.000Z'),
  });
  return { log, lines };
}

const SESSION = '3f6038ba-8872-478b-bb20-9f88f10c32d4';

test('each line is one JSON object with time, level and message', () => {
  const { log, lines } = capture();
  log.info('hello', { jobs: 2 });
  assert.deepEqual(lines[0].rec, { jobs: 2, ts: '2030-01-01T00:00:00.000Z', level: 'info', msg: 'hello' });
});

test('visitor text, prompts, replies, history and secrets are replaced by field name', () => {
  const { log, lines } = capture();
  log.info('turn', {
    message: 'my phone is 555-0100 and I run Acme Plumbing', content: 'secret', text: 'x', prompt: 'p', reply: 'r',
    history: [{ role: 'user', content: 'hi' }], messages: ['a'], query: 'q', input: 'i', body: { a: 1 },
    authorization: 'Bearer abc', cookie: 'c=1', apiKey: 'sk-live-123456789', token: 't', password: 'p', secret: 's',
    sessionId: SESSION, headers: { a: 'b' }, stage: 'research', count: 3,
  });
  const { rec, raw } = lines[0];
  for (const k of ['message', 'content', 'text', 'prompt', 'reply', 'history', 'messages', 'query', 'input', 'body', 'authorization', 'cookie', 'apiKey', 'token', 'password', 'secret', 'sessionId', 'headers']) {
    assert.equal(rec[k], '[redacted]', k);
  }
  assert.equal(rec.stage, 'research');
  assert.equal(rec.count, 3);
  assert.ok(!raw.includes('Acme') && !raw.includes('555-0100') && !raw.includes('sk-live'));
});

test('redaction also applies inside nested objects and arrays', () => {
  const { log, lines } = capture();
  log.info('nested', { job: { name: 'research', input: { text: 'visitor words' }, steps: [{ message: 'hi', ok: true }] } });
  assert.deepEqual(lines[0].rec.job, { name: 'research', input: '[redacted]', steps: [{ message: '[redacted]', ok: true }] });
});

test('strings are scrubbed for keys, bearer tokens, session ids and emails even under harmless field names', () => {
  assert.equal(scrubString(`Incorrect API key provided: sk-proj-abcDEF123456. Bearer eyJhbGciOi.abc.def and ${SESSION} for me@example.com`),
    'Incorrect API key provided: [key]. Bearer [token] and [id] for [email]');
  const { log, lines } = capture();
  log.error('failed', { detail: `session ${SESSION} said hi from jo@x.io` });
  assert.equal(lines[0].rec.detail, 'session [id] said hi from [email]');
});

test('Supabase keys (JWTs) are scrubbed from any string, wherever they turn up', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlLXZhbHVl';
  assert.equal(scrubString(`request to storage failed with key ${jwt} at 10:00`), 'request to storage failed with key [jwt] at 10:00');
  const { log, lines } = capture();
  log.error('failed', { detail: `Authorization header was ${jwt}`, apikey: jwt });
  assert.ok(!lines[0].raw.includes('eyJ'));
});

test('the message and fixed keys cannot be overwritten or leaked through fields', () => {
  const { log, lines } = capture();
  log.warn(`bad key sk-abcdefgh1234 for ${SESSION}`, { level: 'debug', ts: 'x', msg: 'spoof', requestId: 'spoof' });
  assert.equal(lines[0].rec.level, 'warn');
  assert.equal(lines[0].rec.ts, '2030-01-01T00:00:00.000Z');
  assert.equal(lines[0].rec.msg, 'bad key [key] for [id]');
  assert.equal(lines[0].rec.requestId, undefined);
});

test('errors keep their type, status and a scrubbed description, never the stack', () => {
  const err = Object.assign(new Error(`401 Incorrect API key sk-test-1234567890 for ${SESSION}`), { status: 401, code: 'invalid_api_key' });
  const out = serializeError(err);
  assert.deepEqual(out, { name: 'Error', detail: '401 Incorrect API key [key] for [id]', status: 401, code: 'invalid_api_key' });
  const { log, lines } = capture();
  log.error('x', { err });
  assert.ok(!lines[0].raw.includes('at ') && !lines[0].raw.includes('stack'));
});

test('validation errors list failing fields but never the visitor-supplied values', () => {
  const r = z.object({ name: z.string().max(3), age: z.number() }).safeParse({ name: 'Mr Secret Visitor', age: 'many' });
  assert.ok(!r.success);
  const { log, lines } = capture();
  log.warn('bad output', { err: r.error });
  const { raw, rec } = lines[0];
  assert.ok(!raw.includes('Secret Visitor'));
  assert.deepEqual(rec.err.issues.map((i: any) => i.path).sort(), ['age', 'name']);
});

test('a bare array of zod issues (as thrown by some paths) is logged as paths and codes only', () => {
  const out = serializeError([{ code: 'invalid_type', path: ['competitors'], message: 'Invalid input: received "Mr Secret"' }]);
  assert.deepEqual(out, { name: 'ValidationIssues', issues: [{ path: 'competitors', code: 'invalid_type' }] });
});

test('request id is attached to every line written inside the request, including async continuations', async () => {
  const { log, lines } = capture();
  log.info('outside');
  await runWithRequestId('abc12345', async () => {
    log.info('inside');
    await new Promise((r) => setTimeout(r, 5));
    log.info('later');
  });
  assert.deepEqual(lines.map((l) => l.rec.requestId), [undefined, 'abc12345', 'abc12345']);
});

test('levels filter output, and silent writes nothing', () => {
  const warnOnly = capture('warn');
  warnOnly.log.debug('d'); warnOnly.log.info('i'); warnOnly.log.warn('w'); warnOnly.log.error('e');
  assert.deepEqual(warnOnly.lines.map((l) => l.rec.msg), ['w', 'e']);
  const silent = capture('silent');
  silent.log.error('e');
  assert.equal(silent.lines.length, 0);
});

test('huge, circular and odd values never throw and are bounded', () => {
  const { log, lines } = capture();
  const loop: Record<string, unknown> = { a: 1 };
  loop.self = loop;
  log.info('odd', { long: 'x'.repeat(5000), loop, fn: () => 1, big: 10n, list: Array.from({ length: 100 }, (_, i) => i) });
  const rec = lines[0].rec;
  assert.ok(rec.long.length <= 502);
  assert.equal(rec.list.length, 20);
  assert.equal(rec.big, '10');
  assert.ok(lines[0].raw.length < 4000);
});

test('metrics: counters and timings aggregate by label and carry no free text', () => {
  const m = new Metrics();
  m.inc('jobs_total', { job: 'research', outcome: 'complete' });
  m.inc('jobs_total', { outcome: 'complete', job: 'research' }); // label order does not matter
  m.inc('jobs_total', { job: 'research', outcome: 'degraded' });
  m.observe('job_duration_ms', { job: 'research' }, 1000);
  m.observe('job_duration_ms', { job: 'research' }, 3000);
  const s = m.snapshot();
  assert.deepEqual(s.counters.map((c) => [c.labels.outcome, c.value]).sort(), [['complete', 2], ['degraded', 1]]);
  assert.deepEqual(s.timings[0], { name: 'job_duration_ms', labels: { job: 'research' }, count: 2, avgMs: 2000, maxMs: 3000 });
  m.reset();
  assert.equal(m.snapshot().counters.length, 0);
});
