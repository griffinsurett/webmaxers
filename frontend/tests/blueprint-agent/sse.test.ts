import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSseParser, MAX_EVENT_CHARS, SseOverflowError, type SseMessage } from '../../src/components/BlueprintAgent/sse';

function parse(chunks: string[]): SseMessage[] {
  const out: SseMessage[] = [];
  const p = createSseParser((m) => out.push(m));
  for (const c of chunks) p.push(c);
  p.end();
  return out;
}

test('parses a simple event', () => {
  assert.deepEqual(parse(['event: step\ndata: {"a":1}\n\n']), [{ event: 'step', data: '{"a":1}' }]);
});

test('defaults the event name to "message"', () => {
  assert.deepEqual(parse(['data: hi\n\n']), [{ event: 'message', data: 'hi' }]);
});

test('joins multiple data lines with newlines', () => {
  assert.deepEqual(parse(['data: a\ndata: b\n\n']), [{ event: 'message', data: 'a\nb' }]);
});

test('ignores comments and keep-alives', () => {
  assert.deepEqual(parse([': keep-alive\n\n: another\nevent: x\ndata: 1\n\n']), [{ event: 'x', data: '1' }]);
});

test('handles chunks split at every possible byte position', () => {
  const full = 'event: step\ndata: {"m":"héllo"}\n\n: keep-alive\n\nevent: done\ndata: {"ok":true}\n\n';
  const expected = parse([full]);
  assert.equal(expected.length, 2);
  for (let i = 1; i < full.length; i++) assert.deepEqual(parse([full.slice(0, i), full.slice(i)]), expected, `split at ${i}`);
  assert.deepEqual(parse(full.split('')), expected);
});

test('accepts \\r\\n and \\r line endings, including a split between \\r and \\n', () => {
  const expected = [{ event: 'a', data: '1' }];
  assert.deepEqual(parse(['event: a\r\ndata: 1\r\n\r\n']), expected);
  assert.deepEqual(parse(['event: a\rdata: 1\r\r']), expected);
  assert.deepEqual(parse(['event: a\r', '\ndata: 1\r', '\n\r', '\n']), expected);
});

test('an unterminated trailing event is discarded', () => {
  assert.deepEqual(parse(['event: a\ndata: 1\n\nevent: b\ndata: 2']), [{ event: 'a', data: '1' }]);
});

test('a blank line with no data dispatches nothing', () => {
  assert.deepEqual(parse(['\n\n\nevent: x\n\n']), []);
});

test('strips only one leading space from values', () => {
  assert.deepEqual(parse(['data:  two\n\n']), [{ event: 'message', data: ' two' }]);
  assert.deepEqual(parse(['data:none\n\n']), [{ event: 'message', data: 'none' }]);
});

test('unknown fields (id, retry) are ignored', () => {
  assert.deepEqual(parse(['id: 5\nretry: 10\nevent: a\ndata: 1\n\n']), [{ event: 'a', data: '1' }]);
});

test('refuses an unbounded event rather than buffering forever', () => {
  const p = createSseParser(() => {});
  assert.throws(() => p.push('data: ' + 'x'.repeat(MAX_EVENT_CHARS + 10)), SseOverflowError);
  const q = createSseParser(() => {});
  assert.throws(() => { for (let i = 0; i < 50; i++) q.push('data: ' + 'x'.repeat(100_000) + '\n'); }, SseOverflowError);
});
