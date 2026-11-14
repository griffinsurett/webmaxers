import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getAgentApiUrl, checkBackendHealth, startSession } from '../../src/components/BlueprintAgent/api';

// The wiring checker is a plain Node script; load it by path so the site's type-check never has to model it.
const scriptPath = '../../scripts/check-agent-wiring.mjs';
const { checkWiring, sourceAllows, pageCsp } = (await import(scriptPath)) as {
  checkWiring: (i: { url?: string; vercelJson: object }) => { problems: string[]; origin: string | null };
  sourceAllows: (source: string, origin: string) => boolean;
  pageCsp: (v: object) => string | null;
};

const vercelWith = (connect: string) => ({ headers: [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: `default-src 'none'; connect-src ${connect}; frame-ancestors *;` }] }] });
const realVercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

test('wiring: a configured https backend that the CSP allows has no problems', () => {
  const r = checkWiring({ url: 'https://api.webmaxxers.com', vercelJson: vercelWith("'self' https://api.webmaxxers.com https://formspree.io") });
  assert.deepEqual(r, { problems: [], origin: 'https://api.webmaxxers.com' });
});

test('wiring: a trailing slash is fine, a path, query, http or localhost is not', () => {
  const v = vercelWith("'self' https://api.example.com");
  assert.deepEqual(checkWiring({ url: 'https://api.example.com/', vercelJson: v }).problems, []);
  assert.ok(checkWiring({ url: 'https://api.example.com/v1', vercelJson: v }).problems.some((p) => p.includes('origin only')));
  assert.ok(checkWiring({ url: 'https://api.example.com/?x=1', vercelJson: v }).problems.some((p) => p.includes('query string')));
  assert.ok(checkWiring({ url: 'http://api.example.com', vercelJson: v }).problems.some((p) => p.includes('https')));
  assert.ok(checkWiring({ url: 'https://localhost:8000', vercelJson: vercelWith("'self' https://localhost:8000") }).problems.some((p) => p.includes('cannot reach')));
  assert.ok(checkWiring({ url: 'not a url', vercelJson: v }).problems.length > 0);
});

test('wiring: a missing variable is reported, and a CSP that blocks the backend is the specific error', () => {
  assert.ok(checkWiring({ url: '', vercelJson: vercelWith("'self'") }).problems[0].includes('not set'));
  const blocked = checkWiring({ url: 'https://api.example.com', vercelJson: vercelWith("'self' https://formspree.io") });
  assert.equal(blocked.problems.length, 1);
  assert.ok(blocked.problems[0].includes('connect-src') && blocked.problems[0].includes('https://api.example.com'));
});

test('wiring: CSP wildcards match only their own domain and scheme', () => {
  assert.ok(sourceAllows('https://*.example.com', 'https://api.example.com'));
  assert.ok(sourceAllows('*.example.com', 'https://api.example.com'));
  assert.ok(!sourceAllows('https://*.example.com', 'https://example.com'));
  assert.ok(!sourceAllows('https://*.example.com', 'https://api.example.com.evil.io'));
  assert.ok(!sourceAllows('https://*.example.com', 'http://api.example.com'));
  assert.ok(!sourceAllows("'self'", 'https://api.example.com'));
});

test('wiring: reads the real vercel.json page policy (not the partytown sandbox one)', () => {
  const csp = pageCsp(realVercel);
  assert.ok(csp && csp.includes('formspree.io'), 'found the page-wide policy');
});

test('client: a production build with no API address makes no request and behaves as offline', async () => {
  // Under tsx there is no Vite env, so simulate "production, not configured" through the public seams.
  assert.equal(getAgentApiUrl(), 'http://localhost:8000', 'development keeps the localhost fallback');
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; throw new Error('network must not be used'); }) as typeof fetch;
  try {
    assert.equal(await checkBackendHealth({ baseUrl: '' }), false);
    const r = await startSession({ baseUrl: '' });
    assert.ok(!r.ok && r.error.kind === 'offline' && r.error.retryable);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = realFetch; }
});
