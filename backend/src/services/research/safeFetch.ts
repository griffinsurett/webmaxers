// backend/src/services/research/safeFetch.ts
// The ONLY way the research engine touches the network. Everything fetched is untrusted:
// it is read as text and never executed or rendered.
//
// Guarantees, per request and per redirect hop:
//  - the address passes the phase 3 URL checks (public http/https site, no IP/credentials/odd ports)
//  - DNS is resolved once, every record must be public, and the socket is PINNED to that
//    address (defeats DNS rebinding between check and connect)
//  - redirects are re-validated, capped, and must stay on the same site (www and http→https ok)
//  - hard caps on time, response size (also AFTER decompression), and content type
//  - no cookies, no credentials, no custom headers from callers
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';
import { resolvePublic, validateUrlSyntax, type Resolver, type UrlRejection } from '../security/urlGuard.js';

export const BOT_NAME = 'WebmaxxersBot';
export const USER_AGENT = `${BOT_NAME}/1.0 (+https://webmaxxers.com)`;

export type FetchFailure =
  | UrlRejection
  | 'too_many_redirects'
  | 'cross_domain_redirect'
  | 'timeout'
  | 'too_large'
  | 'bad_content_type'
  | 'http_error'
  | 'network'
  | 'robots_disallowed'
  | 'budget_exceeded'
  | 'too_complex';

export type FetchResult =
  | { ok: true; url: string; status: number; contentType: string; body: string; redirects: number }
  | { ok: false; reason: FetchFailure; status?: number };

export type ContentKind = 'html' | 'text';

const CONTENT_TYPES: Record<ContentKind, RegExp> = {
  html: /^(?:text\/html|application\/xhtml\+xml)\b/i,
  text: /^(?:text\/plain|text\/xml|application\/xml|application\/[a-z.+-]*\+xml)\b/i,
};

export interface FetchLimits {
  maxBytes: number;
  /** Socket idle timeout: no bytes for this long. */
  requestTimeoutMs: number;
  /** Absolute cap for ONE request from start to last byte, so a slow drip cannot hold a slot. */
  requestTotalMs: number;
  totalTimeoutMs: number;
  maxRedirects: number;
}
export const DEFAULT_LIMITS: FetchLimits = {
  maxBytes: 1_500_000,
  requestTimeoutMs: 5_000,
  requestTotalMs: 10_000,
  totalTimeoutMs: 12_000,
  maxRedirects: 3,
};

export interface RawResponse {
  status: number;
  contentType: string;
  location?: string;
  body: Buffer;
}
export type RawRequest = (
  url: URL,
  address: string,
  kind: ContentKind,
  limits: FetchLimits,
) => Promise<RawResponse>;

class FetchAbort extends Error {
  constructor(public readonly reason: FetchFailure) {
    super(reason);
  }
}

/**
 * One GET to a pre-validated, pinned address. No policy lives here beyond the size, time and
 * content-type caps; address and URL validation is done by `safeFetch`. Exported for tests.
 */
export const pinnedRequest: RawRequest = (url, address, kind, limits) =>
  new Promise((resolveRaw, rejectRaw) => {
    // Settle exactly once and always stop the absolute timer.
    let settled = false;
    let killer: NodeJS.Timeout | undefined;
    const resolve = (v: RawResponse) => { if (!settled) { settled = true; clearTimeout(killer); resolveRaw(v); } };
    const reject = (e: unknown) => { if (!settled) { settled = true; clearTimeout(killer); rejectRaw(e); } };
    const transport = url.protocol === 'https:' ? https : http;
    const family = address.includes(':') ? 6 : 4;
    const req = transport.request(
      {
        host: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent: false,
        timeout: limits.requestTimeoutMs,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: kind === 'html' ? 'text/html,application/xhtml+xml;q=0.9' : 'text/plain,application/xml;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.8',
          Connection: 'close',
        },
        // Connect only to the address we validated, whatever DNS says now.
        lookup: (_host, options, cb) => {
          if ((options as { all?: boolean }).all) cb(null, [{ address, family }] as never, undefined as never);
          else cb(null, address, family);
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        const location = typeof res.headers.location === 'string' ? res.headers.location : undefined;

        if (status >= 300 && status < 400) {
          res.destroy();
          return resolve({ status, contentType, location, body: Buffer.alloc(0) });
        }
        if (status >= 400) {
          res.destroy();
          return resolve({ status, contentType, body: Buffer.alloc(0) });
        }
        if (!CONTENT_TYPES[kind].test(contentType)) {
          res.destroy();
          return reject(new FetchAbort('bad_content_type'));
        }
        const declared = Number(res.headers['content-length']);
        if (Number.isFinite(declared) && declared > limits.maxBytes) {
          res.destroy();
          return reject(new FetchAbort('too_large'));
        }

        let stream: Readable = res;
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding && encoding !== 'identity') {
          res.destroy();
          return reject(new FetchAbort('bad_content_type'));
        }

        const chunks: Buffer[] = [];
        let total = 0; // counted AFTER decompression, so a zip bomb hits the cap
        stream.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > limits.maxBytes) {
            res.destroy();
            stream.destroy();
            reject(new FetchAbort('too_large'));
          } else chunks.push(chunk);
        });
        stream.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks) }));
        stream.on('error', () => reject(new FetchAbort('network')));
        res.on('error', () => reject(new FetchAbort('network')));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new FetchAbort('timeout'));
    });
    killer = setTimeout(() => {
      req.destroy();
      reject(new FetchAbort('timeout'));
    }, limits.requestTotalMs);
    req.on('error', () => reject(new FetchAbort('network')));
    req.end();
  });

export interface FetchDeps {
  resolver?: Resolver;
  request?: RawRequest;
  limits?: Partial<FetchLimits>;
  /**
   * Called before EVERY hop (the start URL and each redirect target) with the validated URL.
   * Return a failure to stop; used for robots.txt and fetch budgets.
   */
  guard?: (url: string) => Promise<FetchFailure | null>;
}

const bareHost = (host: string) => host.replace(/^www\./, '');

export async function safeFetch(startUrl: string, kind: ContentKind, deps: FetchDeps = {}): Promise<FetchResult> {
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const request = deps.request ?? pinnedRequest;
  const deadline = Date.now() + limits.totalTimeoutMs;

  const first = validateUrlSyntax(startUrl);
  if (!first.ok) return { ok: false, reason: first.reason };
  const origin = bareHost(first.host);
  let current = first.url;

  for (let hop = 0; hop <= limits.maxRedirects; hop++) {
    if (Date.now() > deadline) return { ok: false, reason: 'timeout' };

    const checked = validateUrlSyntax(current);
    if (!checked.ok) return { ok: false, reason: checked.reason };
    if (bareHost(checked.host) !== origin) return { ok: false, reason: 'cross_domain_redirect' };

    const dns = await resolvePublic(checked.host, deps.resolver);
    if (!dns.ok) return { ok: false, reason: dns.reason };
    if (deps.guard) {
      const refused = await deps.guard(checked.url);
      if (refused) return { ok: false, reason: refused };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ok: false, reason: 'timeout' };

    let res: RawResponse;
    try {
      const address = dns.addresses.find((a) => !a.includes(':')) ?? dns.addresses[0]; // prefer IPv4
      res = await request(new URL(checked.url), address, kind, { ...limits, requestTotalMs: Math.min(limits.requestTotalMs, remaining) });
    } catch (err) {
      return { ok: false, reason: err instanceof FetchAbort ? err.reason : 'network' };
    }

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) return { ok: false, reason: 'http_error', status: res.status };
      let next: URL;
      try {
        next = new URL(res.location, checked.url);
      } catch {
        return { ok: false, reason: 'bad_format' };
      }
      current = next.href;
      continue;
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, reason: 'http_error', status: res.status };

    return {
      ok: true,
      url: checked.url,
      status: res.status,
      contentType: res.contentType,
      body: new TextDecoder('utf-8', { fatal: false }).decode(res.body),
      redirects: hop,
    };
  }
  return { ok: false, reason: 'too_many_redirects' };
}
