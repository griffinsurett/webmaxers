// backend/src/services/ratelimit/limiter.ts
// Burst throttling: a per-client request limit over short windows (seconds / minutes), on top of
// the existing daily caps. Counters live in Postgres (table rate_limits), so limits are shared by
// every backend instance and survive restarts. Each hit is one atomic upsert, so parallel
// requests cannot slip past a limit.
import { isIPv4, isIPv6 } from 'node:net';
import type { RequestHandler } from 'express';
import { config } from '../../config/index.js';
import { pool } from '../../db/index.js';
import { log } from '../log/logger.js';
import { metrics } from '../log/metrics.js';

export interface Rule {
  windowSeconds: number;
  limit: number;
}

export interface Policy {
  name: string;
  rules: readonly Rule[];
}

/** Two windows per policy: the short one stops bursts, the long one stops steady hammering. */
export const POLICIES = {
  /** Every /api request. Generous: only meant to stop scripts. */
  general: { name: 'general', rules: [{ windowSeconds: 10, limit: 30 }, { windowSeconds: 60, limit: 120 }] },
  /** POST /api/chat: a person types, reads, then replies. */
  chat: { name: 'chat', rules: [{ windowSeconds: 10, limit: 6 }, { windowSeconds: 60, limit: 20 }] },
  /** POST /api/chat/start (daily cap of conversations per network also applies). */
  chatStart: { name: 'chat-start', rules: [{ windowSeconds: 60, limit: 6 }] },
  /** POST /api/research (reconnects to a running job count too). */
  research: { name: 'research', rules: [{ windowSeconds: 60, limit: 10 }] },
  /** POST /api/blueprint (reconnects to a running job count too). */
  blueprint: { name: 'blueprint', rules: [{ windowSeconds: 60, limit: 10 }] },
  /** POST /api/blueprint/edit: manual toggles can be clicked quickly. */
  blueprintEdit: { name: 'blueprint-edit', rules: [{ windowSeconds: 10, limit: 15 }, { windowSeconds: 60, limit: 60 }] },
  /** Admin routes and page: a review session makes several quick calls, but only one person uses it. */
  admin: { name: 'admin', rules: [{ windowSeconds: 10, limit: 15 }, { windowSeconds: 60, limit: 60 }] },
} as const satisfies Record<string, Policy>;

const bucketOf = (policy: Policy, rule: Rule) => `${policy.name}:${rule.windowSeconds}s`;

// ---------------------------------------------------------------------------
// Client key
// ---------------------------------------------------------------------------

function expandIPv6(address: string): string[] {
  let s = address;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number);
    s = `${s.slice(0, -v4[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const hasGap = s.includes('::');
  const [head, tail = ''] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = hasGap && tail ? tail.split(':') : [];
  const fill = hasGap ? new Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0') : [];
  return [...h, ...fill, ...t].map((x) => x.replace(/^0+(?=.)/, ''));
}

/**
 * The identity limits are counted against. IPv4-mapped IPv6 collapses to IPv4, and IPv6 is
 * reduced to its /64 so a visitor cannot dodge a limit by rotating addresses inside their own
 * allocation.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  let a = ip.trim().toLowerCase();
  const zone = a.indexOf('%');
  if (zone >= 0) a = a.slice(0, zone);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1];
  if (isIPv4(a)) return a;
  if (isIPv6(a)) return `${expandIPv6(a).slice(0, 4).join(':')}::/64`;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface HitResult {
  bucket: string;
  count: number;
  /** Seconds until this window ends. */
  retryAfter: number;
}

export interface RateLimitStore {
  /** Counts one request against every rule and returns the resulting counts. */
  hit(policy: Policy, key: string, at?: Date): Promise<HitResult[]>;
  /** Deletes counters whose window ended a while ago. Returns how many were removed. */
  purge(): Promise<number>;
}

export const postgresStore: RateLimitStore = {
  async hit(policy, key, at) {
    const buckets = policy.rules.map((r) => bucketOf(policy, r));
    const windows = policy.rules.map((r) => r.windowSeconds);
    // `at` only exists so tests can move time; production uses the database clock, which is
    // shared by every instance.
    const { rows } = await pool.query(
      `with now_t as (select coalesce($4::timestamptz, now()) as t),
            r as (select * from unnest($1::text[], $2::int[]) as x(bucket, win)),
            w as (
              select r.bucket,
                     to_timestamp(floor(extract(epoch from n.t) / r.win) * r.win) as start,
                     r.win
              from r, now_t n
            )
       insert into rate_limits (bucket, key, window_start, window_end, count)
       select w.bucket, $3, w.start, w.start + w.win * interval '1 second', 1
       from w order by w.bucket
       on conflict (bucket, key, window_start)
       do update set count = rate_limits.count + 1
       returning bucket, count,
                 extract(epoch from (window_end - (select t from now_t)))::float8 as retry_after`,
      [buckets, windows, key, at ?? null],
    );
    return rows.map((row) => ({ bucket: row.bucket, count: row.count, retryAfter: row.retry_after }));
  },

  async purge() {
    const { rowCount } = await pool.query(`delete from rate_limits where window_end < now() - interval '1 minute'`);
    return rowCount ?? 0;
  },
};

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/** The longest wait among the rules that were exceeded, or null when the request may proceed. */
export function evaluate(policy: Policy, results: readonly HitResult[]): { retryAfter: number } | null {
  let wait: number | null = null;
  for (const rule of policy.rules) {
    const bucket = bucketOf(policy, rule);
    const hit = results.find((r) => r.bucket === bucket);
    if (hit && hit.count > rule.limit) {
      wait = Math.max(wait ?? 0, Math.ceil(hit.retryAfter));
    }
  }
  return wait === null ? null : { retryAfter: Math.max(1, wait) };
}

export interface LimiterDeps {
  store?: RateLimitStore;
  enabled?: boolean;
  onError?: (err: unknown) => void;
}

export const RATE_LIMITED_MESSAGE = 'You are sending requests too quickly. Please wait a moment and try again.';

/**
 * Express middleware enforcing a policy. If the store itself fails the request is allowed: the
 * routes that matter also need the database, so they fail on their own, while cheap routes (price
 * lookups) are not taken down by a counter problem.
 */
export function rateLimit(policy: Policy, deps: LimiterDeps = {}): RequestHandler {
  const store = deps.store ?? postgresStore;
  const onError = deps.onError ?? ((err) => { metrics.inc('rate_limit_store_errors_total'); log.error('rate limiter store failed', { err }); });
  return async (req, res, next) => {
    if (!(deps.enabled ?? config.rateLimitEnabled)) return next();
    try {
      const verdict = evaluate(policy, await store.hit(policy, clientKey(req.ip)));
      if (verdict) {
        metrics.inc('rate_limited_total', { policy: policy.name });
        res.setHeader('Retry-After', String(verdict.retryAfter));
        return void res.status(429).json({ error: RATE_LIMITED_MESSAGE, code: 'rate_limited' });
      }
    } catch (err) {
      onError(err);
    }
    next();
  };
}

/** Periodically removes expired counters. The timer never keeps the process alive. */
export function startRateLimitCleanup(store: RateLimitStore = postgresStore, everyMs = 5 * 60_000): () => void {
  const run = () => store.purge().catch((err) => log.error('rate limit cleanup failed', { err }));
  void run();
  const timer = setInterval(run, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
