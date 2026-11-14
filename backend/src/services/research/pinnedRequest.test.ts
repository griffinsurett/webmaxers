// pinnedRequest against a real local HTTP server (the policy layer is bypassed on purpose:
// this tests size/time/content-type caps and address pinning at the socket level).
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import zlib from 'node:zlib';
import { DEFAULT_LIMITS, pinnedRequest } from './safeFetch.js';

let server: http.Server;
let port: number;
let lastHost = '';
const limits = { ...DEFAULT_LIMITS, maxBytes: 100_000, requestTimeoutMs: 400 };
// The hostname does not resolve anywhere: success proves the socket used the pinned address.
const url = (path: string) => new URL(`http://pinned.invalid:${port}${path}`);

before(async () => {
  server = http.createServer((req, res) => {
    lastHost = String(req.headers.host);
    const p = req.url ?? '/';
    if (p === '/ok') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>hi</h1>');
    if (p === '/json') return void res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    if (p === '/big-header') return void res.writeHead(200, { 'content-type': 'text/html', 'content-length': '999999999' }).end('x');
    if (p === '/big-stream') {
      res.writeHead(200, { 'content-type': 'text/html' });
      const t = setInterval(() => res.write('a'.repeat(20_000)), 1);
      return void res.on('close', () => clearInterval(t));
    }
    if (p === '/bomb') {
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' });
      return void res.end(zlib.gzipSync(Buffer.alloc(20_000_000, 0x61)));
    }
    if (p === '/gzip') return void res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end(zlib.gzipSync('zipped ok'));
    if (p === '/weird-encoding') return void res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'compress' }).end('x');
    if (p === '/redirect') return void res.writeHead(302, { location: 'http://127.0.0.1/admin' }).end();
    if (p === '/slow') return; // never answers
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
after(() => { server.closeAllConnections(); server.close(); });

test('connects to the pinned address regardless of hostname', async () => {
  const r = await pinnedRequest(url('/ok'), '127.0.0.1', 'html', limits);
  assert.equal(r.body.toString(), '<h1>hi</h1>');
  assert.match(lastHost, /^pinned\.invalid/);
});

test('reads gzip but caps the DECOMPRESSED size (zip bomb)', async () => {
  assert.equal((await pinnedRequest(url('/gzip'), '127.0.0.1', 'html', limits)).body.toString(), 'zipped ok');
  await assert.rejects(pinnedRequest(url('/bomb'), '127.0.0.1', 'html', limits), { reason: 'too_large' });
});

test('rejects wrong content types, huge declared sizes, endless streams, odd encodings', async () => {
  await assert.rejects(pinnedRequest(url('/json'), '127.0.0.1', 'html', limits), { reason: 'bad_content_type' });
  await assert.rejects(pinnedRequest(url('/big-header'), '127.0.0.1', 'html', limits), { reason: 'too_large' });
  await assert.rejects(pinnedRequest(url('/big-stream'), '127.0.0.1', 'html', limits), { reason: 'too_large' });
  await assert.rejects(pinnedRequest(url('/weird-encoding'), '127.0.0.1', 'html', limits), { reason: 'bad_content_type' });
});

test('times out on a server that never answers, and never follows redirects itself', async () => {
  await assert.rejects(pinnedRequest(url('/slow'), '127.0.0.1', 'html', limits), { reason: 'timeout' });
  const r = await pinnedRequest(url('/redirect'), '127.0.0.1', 'html', limits);
  assert.equal(r.status, 302);
  assert.equal(r.location, 'http://127.0.0.1/admin');
});

test('a slow drip cannot outlive the absolute per-request timer (headers or body)', async () => {
  const slow = http.createServer((req, res) => {
    if (req.url === '/drip-body') {
      res.writeHead(200, { 'content-type': 'text/html' });
      const t = setInterval(() => res.write('x'), 60); // never idle long enough to trip the idle timeout
      res.on('close', () => clearInterval(t));
    } else {
      const t = setInterval(() => { try { res.write(' '); } catch { /* closed */ } }, 60); // drip before headers
      res.on('close', () => clearInterval(t));
      res.writeHead(200, { 'content-type': 'text/html' });
    }
  });
  await new Promise<void>((r) => slow.listen(0, '127.0.0.1', r));
  const p = (slow.address() as AddressInfo).port;
  const tight = { ...DEFAULT_LIMITS, maxBytes: 10_000_000, requestTimeoutMs: 1000, requestTotalMs: 400 };
  for (const path of ['/drip-body', '/drip-headers']) {
    const t = Date.now();
    await assert.rejects(pinnedRequest(new URL(`http://pinned.invalid:${p}${path}`), '127.0.0.1', 'html', tight), { reason: 'timeout' });
    assert.ok(Date.now() - t < 1200, `${path} took ${Date.now() - t}ms`);
  }
  slow.closeAllConnections(); slow.close();
});
