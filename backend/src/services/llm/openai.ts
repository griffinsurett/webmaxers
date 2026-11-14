// backend/src/services/llm/openai.ts
// The only place OpenAI clients are created and the only way model calls are made.
//
// Every call gets: a client with sensible per-attempt timeout and retries (the SDK backs off and
// honours Retry-After), a TOTAL deadline across attempts, a circuit breaker per profile, error
// classification into LlmError, and logging/metrics. Callers just describe the call.
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { log } from '../log/logger.js';
import { metrics } from '../log/metrics.js';
import { CircuitBreaker } from './breaker.js';
import { LlmError, classifyLlmError } from './errors.js';

export type LlmProfile = 'turn' | 'refine' | 'structure' | 'content' | 'analysis' | 'search' | 'embedding' | 'extract';

interface ProfileSettings {
  /** Per-attempt socket/response timeout. */
  attemptMs: number;
  /** Extra attempts after the first (transient errors only). */
  retries: number;
  /** Hard ceiling for the whole call, retries and waits included. */
  deadlineMs: number;
}

// Deadlines are chosen to fit the callers' budgets: a chat turn must finish well inside the
// site's 90s chat timeout (a refine turn can make two calls: refine 25s + content 60s), and the
// research (240s) and blueprint (180s) jobs must be able to fit all their calls.
export const PROFILES: Record<LlmProfile, ProfileSettings> = {
  turn: { attemptMs: 20_000, retries: 1, deadlineMs: 25_000 },
  refine: { attemptMs: 20_000, retries: 1, deadlineMs: 25_000 },
  structure: { attemptMs: 70_000, retries: 1, deadlineMs: 100_000 },
  content: { attemptMs: 45_000, retries: 1, deadlineMs: 60_000 },
  analysis: { attemptMs: 50_000, retries: 1, deadlineMs: 80_000 },
  search: { attemptMs: 45_000, retries: 1, deadlineMs: 60_000 },
  embedding: { attemptMs: 15_000, retries: 1, deadlineMs: 25_000 },
  // Admin pricing uploads: a long document read once, in the background (not a visitor request).
  extract: { attemptMs: 70_000, retries: 1, deadlineMs: 100_000 },
};

const clients = new Map<LlmProfile, OpenAI>();
const breakers = new Map<LlmProfile, CircuitBreaker>();

function clientFor(profile: LlmProfile): OpenAI {
  if (!config.openaiApiKey) throw new LlmError('misconfigured', 'OPENAI_API_KEY is not set');
  let client = clients.get(profile);
  if (!client) {
    const p = PROFILES[profile];
    client = new OpenAI({ apiKey: config.openaiApiKey, timeout: p.attemptMs, maxRetries: p.retries });
    clients.set(profile, client);
  }
  return client;
}

export const breakerFor = (profile: LlmProfile): CircuitBreaker => {
  let b = breakers.get(profile);
  if (!b) { b = new CircuitBreaker(); breakers.set(profile, b); }
  return b;
};

/** Test hook: forget breaker state and cached clients. */
export function resetLlmState(): void {
  clients.clear();
  breakers.clear();
}

export interface CallOptions {
  /** The caller's own cancellation (e.g. the job ceiling). */
  signal?: AbortSignal;
  /** Replaces the OpenAI client; used by tests. */
  client?: OpenAI;
}

export async function callLlm<T>(
  profile: LlmProfile,
  fn: (client: OpenAI, requestOptions: { signal: AbortSignal }) => Promise<T>,
  options: CallOptions = {},
): Promise<T> {
  const breaker = breakerFor(profile);
  const gate = breaker.acquire();
  if (!gate.ok) {
    metrics.inc('llm_calls_total', { profile, outcome: 'circuit_open' });
    throw new LlmError('circuit_open', `${profile} calls paused after repeated failures`, undefined, Math.max(1, Math.ceil(gate.retryAfterMs / 1000)));
  }

  const deadline = AbortSignal.timeout(PROFILES[profile].deadlineMs);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const started = Date.now();
  try {
    const result = await fn(options.client ?? clientFor(profile), { signal });
    breaker.success();
    metrics.inc('llm_calls_total', { profile, outcome: 'ok' });
    metrics.observe('llm_call_ms', { profile }, Date.now() - started);
    return result;
  } catch (raw) {
    const cancelled = options.signal?.aborted === true;
    const err = classifyLlmError(raw, { cancelled, deadlineHit: !cancelled && deadline.aborted });
    if (err.countsAgainstHealth) breaker.failure();
    else if (err.kind === 'cancelled') breaker.neutral();
    else breaker.success(); // the provider answered; the content was the problem
    metrics.inc('llm_calls_total', { profile, outcome: err.kind });
    metrics.observe('llm_call_ms', { profile }, Date.now() - started);
    // Billing/key problems need a human; everything else is expected turbulence.
    const level = err.kind === 'quota' || err.kind === 'misconfigured' ? 'error' : err.kind === 'cancelled' ? 'debug' : 'warn';
    log[level]('model call failed', { profile, kind: err.kind, status: err.status, ms: Date.now() - started, err });
    throw err;
  }
}
