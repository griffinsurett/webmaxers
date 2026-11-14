// The Supabase Storage client, against a fake server that follows Supabase's API shape.
// (Nothing here touches the real Supabase; see DEPLOY.md for the one-time live check.)
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { UploadError } from './extractText.js';
import { createSupabaseStorage, extractionFailureMessage, guidanceProposal } from './knowledgeSync.js';
import { LlmError } from '../llm/errors.js';

const KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlLXZhbHVl';

interface Seen { method: string; url: string; headers: IncomingMessage['headers']; body: any }

async function fakeSupabase(handler: (seen: Seen, res: import('node:http').ServerResponse) => void) {
  const requests: Seen[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
      const seen = { method: req.method!, url: req.url!, headers: req.headers, body };
      requests.push(seen);
      handler(seen, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, requests, close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

test('list: asks the pricing and guidance folders, authenticates with the service key, skips folders and placeholders', async () => {
  const s = await fakeSupabase((seen, res) => {
    if (seen.body.prefix === 'pricing') {
      json(res, 200, [
        { name: 'sub-folder', id: null, updated_at: null, metadata: null },
        { name: '.emptyFolderPlaceholder', id: 'p1', updated_at: '2026-11-01T00:00:00Z', metadata: { size: 0 } },
        { name: 'Price List 2027.pdf', id: 'a1', updated_at: '2026-11-01T00:00:00Z', metadata: { eTag: '"abc123"', size: 1385 } },
        { name: 'no-etag.txt', id: 'a2', updated_at: '2026-11-02T00:00:00Z', metadata: { size: 50 } },
      ]);
    } else json(res, 200, [{ name: 'tips.md', id: 'g1', updated_at: '2026-11-03T00:00:00Z', metadata: { etag: 'e-9', size: 800 } }]);
  });
  try {
    const files = await createSupabaseStorage({ url: s.url, serviceKey: KEY, bucket: 'knowledge' }).list();
    assert.deepEqual(files, [
      { path: 'pricing/Price List 2027.pdf', etag: '"abc123"', size: 1385 },
      { path: 'pricing/no-etag.txt', etag: '2026-11-02T00:00:00Z', size: 50 }, // falls back to the modified time
      { path: 'guidance/tips.md', etag: 'e-9', size: 800 },
    ]);
    assert.deepEqual(s.requests.map((r) => r.body.prefix), ['pricing', 'guidance']);
    for (const r of s.requests) {
      assert.equal(r.method, 'POST');
      assert.equal(r.url, '/storage/v1/object/list/knowledge');
      assert.equal(r.headers.authorization, `Bearer ${KEY}`);
      assert.equal(r.headers.apikey, KEY);
    }
  } finally { await s.close(); }
});

test('list: keeps asking for more while a folder has more than one page of files', async () => {
  const s = await fakeSupabase((seen, res) => {
    if (seen.body.prefix !== 'pricing') return json(res, 200, []);
    const total = 103;
    const names = Array.from({ length: total }, (_, i) => `f${String(i).padStart(3, '0')}.txt`).slice(seen.body.offset, seen.body.offset + seen.body.limit);
    json(res, 200, names.map((name) => ({ name, id: name, updated_at: '2026-11-01T00:00:00Z', metadata: { eTag: name, size: 10 } })));
  });
  try {
    const files = await createSupabaseStorage({ url: s.url, serviceKey: KEY, bucket: 'knowledge' }).list();
    assert.equal(files.length, 103);
    assert.deepEqual(s.requests.filter((r) => r.body.prefix === 'pricing').map((r) => r.body.offset), [0, 100]);
  } finally { await s.close(); }
});

test('download: encodes the path, sends the key, returns the bytes', async () => {
  const s = await fakeSupabase((seen, res) => { res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(Buffer.from('%PDF-fake-bytes')); });
  try {
    const buf = await createSupabaseStorage({ url: `${s.url}/`, serviceKey: KEY, bucket: 'knowledge' }).download('pricing/My Price List #1.pdf', 1024);
    assert.equal(buf.toString(), '%PDF-fake-bytes');
    assert.equal(s.requests[0].url, '/storage/v1/object/knowledge/pricing/My%20Price%20List%20%231.pdf');
    assert.equal(s.requests[0].headers.authorization, `Bearer ${KEY}`);
  } finally { await s.close(); }
});

test('download: refuses a file bigger than the limit, from the header or from the bytes', async () => {
  const s = await fakeSupabase((seen, res) => { res.writeHead(200); res.end(Buffer.alloc(5000, 65)); });
  try {
    await assert.rejects(createSupabaseStorage({ url: s.url, serviceKey: KEY, bucket: 'knowledge' }).download('pricing/big.txt', 1000), (e: unknown) => e instanceof UploadError && e.code === 'too_large');
  } finally { await s.close(); }
});

test('errors name the failure and its status, and NEVER carry the key or the response body', async () => {
  const s = await fakeSupabase((seen, res) => json(res, 401, { message: `bad key ${KEY}`, hint: 'secret hint' }));
  try {
    const storage = createSupabaseStorage({ url: s.url, serviceKey: KEY, bucket: 'knowledge' });
    for (const call of [() => storage.list(), () => storage.download('pricing/a.txt', 1000)]) {
      await assert.rejects(call(), (e: Error) => /status 401/.test(e.message) && !e.message.includes(KEY) && !e.message.includes('secret hint') && !e.message.includes('eyJ'));
    }
  } finally { await s.close(); }
});

test('a storage server that is down is an error to retry later, not a crash', async () => {
  const storage = createSupabaseStorage({ url: 'http://127.0.0.1:9', serviceKey: KEY, bucket: 'knowledge' });
  await assert.rejects(storage.list());
});

test('guidance drafts warn about dollar amounts and refuse empty text', () => {
  assert.equal(guidanceProposal('Roofers do best with a storm damage page.', 'g.txt')?.warnings?.length, 0);
  assert.match(guidanceProposal('Our starter package is $1,400.', 'g.txt')!.warnings![0], /pricing folder/);
  assert.equal(guidanceProposal('   \n\n  ', 'g.txt'), null);
});

test('the message the admin sees for a model failure never carries provider text', () => {
  const m = extractionFailureMessage(new LlmError('quota', 'org-1 sk-secret-1234567 exceeded quota', 429));
  assert.match(m, /OpenAI key and billing/);
  assert.ok(!/org-1|sk-/.test(m));
  assert.match(extractionFailureMessage(new LlmError('bad_output', 'x')), /clearer or shorter/);
  assert.match(extractionFailureMessage(new Error('boom')), /Re-upload/);
});
