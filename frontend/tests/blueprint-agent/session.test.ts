import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearSessionId, isSessionId, loadSessionId, saveSessionId } from '../../src/components/BlueprintAgent/session';
import { SID } from './helpers';

const fakeHistory = (state: unknown = null) => {
  const h = { state, replaceState(s: unknown) { h.state = s; } };
  return h;
};
const fakeStorage = (blocked = false) => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { if (blocked) throw new Error('blocked'); m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
};

test('isSessionId accepts UUIDs only', () => {
  assert.ok(isSessionId(SID));
  for (const bad of ['', 'abc', 123, null, undefined, `${SID}x`, '<script>', SID.slice(1)]) assert.equal(isSessionId(bad), false);
});

test('survives a refresh through history.state alone (no storage needed)', () => {
  const h = fakeHistory();
  saveSessionId(SID, null, h);
  assert.equal(loadSessionId(null, h), SID);
});

test('works when storage writes are blocked (cookie-consent engine) because history.state carries it', () => {
  const h = fakeHistory();
  const s = fakeStorage(true);
  saveSessionId(SID, s, h);
  assert.equal(loadSessionId(s, h), SID);
});

test('falls back to sessionStorage when history has nothing', () => {
  const s = fakeStorage();
  s.m.set('webmaxxers.blueprint.session', SID);
  assert.equal(loadSessionId(s, fakeHistory()), SID);
});

test('keeps whatever the page already keeps in history.state, and leaves it when clearing', () => {
  const h = fakeHistory({ index: 4, scrollY: 120 });
  saveSessionId(SID, null, h);
  assert.deepEqual(h.state, { index: 4, scrollY: 120, 'webmaxxers.blueprint.session': SID });
  clearSessionId(null, h);
  assert.deepEqual(h.state, { index: 4, scrollY: 120 });
  assert.equal(loadSessionId(null, h), null);
});

test('clearing removes it from both places', () => {
  const h = fakeHistory();
  const s = fakeStorage();
  saveSessionId(SID, s, h);
  clearSessionId(s, h);
  assert.equal(loadSessionId(s, h), null);
  assert.equal(h.state, null);
});

test('ignores junk in either place', () => {
  const s = fakeStorage();
  s.m.set('webmaxxers.blueprint.session', 'not-a-uuid');
  assert.equal(loadSessionId(s, fakeHistory({ 'webmaxxers.blueprint.session': { evil: 1 } })), null);
  assert.equal(loadSessionId(s, fakeHistory('a string state')), null);
  assert.equal(loadSessionId(s, fakeHistory([1, 2])), null);
  saveSessionId('not-a-uuid', s, fakeHistory());
  assert.equal(s.m.get('webmaxxers.blueprint.session'), 'not-a-uuid', 'untouched: invalid ids are never written');
});

test('never throws when history or storage misbehave', () => {
  const badHistory = { get state(): unknown { throw new Error('no'); }, replaceState() { throw new Error('no'); } };
  const badStorage = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
  assert.doesNotThrow(() => saveSessionId(SID, badStorage, badHistory as never));
  assert.equal(loadSessionId(badStorage, badHistory as never), null);
  assert.doesNotThrow(() => clearSessionId(badStorage, badHistory as never));
  assert.equal(loadSessionId(null, null), null);
});
