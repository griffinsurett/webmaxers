import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkConfig } from './validate.js';

const good = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://app:S3cure-pass@db.internal:5432/blueprint',
  CORS_ORIGINS: 'https://webmaxxers.com',
  OPENAI_API_KEY: 'sk-test-123456',
  TRUST_PROXY: '1',
  ADMIN_TOKEN: 'a'.repeat(32),
};

test('a complete production environment has no errors and no warnings', () => {
  assert.deepEqual(checkConfig(good), { errors: [], warnings: [] });
});

test('development needs nothing, but typo\'d numbers are still caught (they would silently become NaN)', () => {
  assert.deepEqual(checkConfig({ NODE_ENV: 'development' }), { errors: [], warnings: [] });
  assert.deepEqual(checkConfig({}).errors, []);
  const r = checkConfig({ PORT: '80a', TRUST_PROXY: 'one', MAX_SESSIONS_PER_IP: '-3', RATE_LIMIT_ENABLED: 'nope', LOG_LEVEL: 'loud' });
  assert.equal(r.errors.length, 5);
});

test('DATABASE_SSL must be one of the three known modes', () => {
  for (const ok of ['disable', 'require', 'no-verify', 'REQUIRE']) assert.deepEqual(checkConfig({ DATABASE_SSL: ok }).errors, [], ok);
  assert.equal(checkConfig({ DATABASE_SSL: 'true' }).errors.length, 1);
});

test('Supabase knowledge settings: both or neither, a real https address, a whole-number interval', () => {
  assert.deepEqual(checkConfig({ SUPABASE_URL: 'https://abcdefgh.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors, []);
  assert.deepEqual(checkConfig({ SUPABASE_URL: 'https://abcdefgh.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors, [], 'trailing slash is fine');
  assert.equal(checkConfig({ SUPABASE_URL: 'https://abcdefgh.supabase.co' }).errors.length, 1, 'URL without a key');
  assert.equal(checkConfig({ SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors.length, 1, 'key without a URL');
  assert.ok(checkConfig({ SUPABASE_URL: 'http://abcdefgh.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors.some((e) => e.includes('SUPABASE_URL')), 'plain http to a real host is refused');
  assert.deepEqual(checkConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors, [], 'a local Supabase is plain http');
  assert.ok(checkConfig({ SUPABASE_URL: 'https://x.supabase.co/rest/v1', SUPABASE_SERVICE_ROLE_KEY: 'k' }).errors.some((e) => e.includes('SUPABASE_URL')));
  assert.equal(checkConfig({ KB_POLL_SECONDS: 'often' }).errors.length, 1);
  assert.deepEqual(checkConfig({}).errors, [], 'leaving them all empty simply turns knowledge uploads off');
  const all = JSON.stringify(checkConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJsecretvaluehere.abcdefgh.ijklmnop', KB_POLL_SECONDS: 'x' }));
  assert.ok(!all.includes('eyJsecret'), 'the key is never echoed');
});

test('production refuses to start without a database, an explicit origin list, or with the dev database', () => {
  assert.ok(checkConfig({ ...good, DATABASE_URL: '' }).errors.some((e) => e.includes('DATABASE_URL is required')));
  assert.ok(checkConfig({ ...good, DATABASE_URL: 'postgres://blueprint:blueprint@localhost:54329/blueprint' }).errors.some((e) => e.includes('development database')));
  assert.ok(checkConfig({ ...good, CORS_ORIGINS: '' }).errors.some((e) => e.includes('CORS_ORIGINS is required')));
});

test('production rejects malformed or wildcard origins and flags localhost', () => {
  assert.ok(checkConfig({ ...good, CORS_ORIGINS: 'https://webmaxxers.com/' }).errors.some((e) => e.includes('without a path')));
  assert.ok(checkConfig({ ...good, CORS_ORIGINS: 'webmaxxers.com' }).errors.length > 0);
  assert.ok(checkConfig({ ...good, CORS_ORIGINS: '*' }).errors.length > 0);
  const withLocal = checkConfig({ ...good, CORS_ORIGINS: 'https://webmaxxers.com, http://localhost:4321' });
  assert.deepEqual(withLocal.errors, []);
  assert.ok(withLocal.warnings.some((w) => w.includes('localhost')));
});

test('production warns about a missing key, proxy count, admin token and disabled throttling', () => {
  const w = checkConfig({ NODE_ENV: 'production', DATABASE_URL: good.DATABASE_URL, CORS_ORIGINS: good.CORS_ORIGINS, RATE_LIMIT_ENABLED: 'false' }).warnings.join('\n');
  for (const needle of ['OPENAI_API_KEY', 'TRUST_PROXY', 'ADMIN_TOKEN', 'RATE_LIMIT_ENABLED']) assert.ok(w.includes(needle), needle);
  assert.ok(checkConfig({ ...good, ADMIN_TOKEN: 'short' }).warnings.some((x) => x.includes('short')));
});

test('no message ever contains a secret value', () => {
  const all = JSON.stringify(checkConfig({ ...good, DATABASE_URL: 'postgres://blueprint:blueprint@h/db', ADMIN_TOKEN: 'tiny-secret' }));
  assert.ok(!all.includes('tiny-secret') && !all.includes('sk-test'));
});
