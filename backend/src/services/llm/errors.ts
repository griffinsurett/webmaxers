// backend/src/services/llm/errors.ts
// One vocabulary for "the model call failed", so every route reacts the same way and visitors
// get a clear message instead of a generic one (or, worse, a raw provider error).
import OpenAI from 'openai';

export type LlmFailureKind =
  | 'rate_limited'   // provider 429 (too many requests / tokens)
  | 'timeout'        // our deadline, or the provider, took too long
  | 'upstream'       // provider 5xx
  | 'unreachable'    // could not connect
  | 'quota'          // billing / quota exhausted: not fixed by waiting
  | 'misconfigured'  // missing, wrong or unauthorised API key or model
  | 'bad_output'     // the model answered, but not in a usable shape
  | 'circuit_open'   // we are deliberately not calling while the provider is failing
  | 'cancelled'      // the caller gave up (job aborted)
  | 'unknown';

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmFailureKind,
    detail: string,
    public readonly status?: number,
    /** Seconds the caller should wait before trying again, when known. */
    public readonly retryAfter?: number,
  ) {
    super(detail);
    this.name = 'LlmError';
  }

  /** Whether this failure says something about the provider's health (feeds the circuit breaker). */
  get countsAgainstHealth(): boolean {
    return ['rate_limited', 'timeout', 'upstream', 'unreachable', 'quota', 'misconfigured'].includes(this.kind);
  }
}

export const badOutput = (detail: string) => new LlmError('bad_output', detail);

/** Turns whatever the SDK (or our own code inside the call) threw into an LlmError. */
export function classifyLlmError(err: unknown, options: { cancelled?: boolean; deadlineHit?: boolean } = {}): LlmError {
  if (err instanceof LlmError) return err;
  if (options.cancelled) return new LlmError('cancelled', 'cancelled by caller');
  const detail = err instanceof Error ? err.message : String(err);

  if (err instanceof OpenAI.APIConnectionTimeoutError || options.deadlineHit) return new LlmError('timeout', detail);
  if (err instanceof OpenAI.APIUserAbortError) return new LlmError('cancelled', detail);
  if (err instanceof OpenAI.APIConnectionError) return new LlmError('unreachable', detail);

  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    if (status === 429) {
      // OpenAI reports an empty billing balance as a 429 too, but waiting will not fix it.
      const code = `${err.code ?? ''} ${(err.error as { code?: string } | undefined)?.code ?? ''}`;
      if (/insufficient_quota|billing/i.test(code)) return new LlmError('quota', detail, status);
      const retryAfter = Number(err.headers?.get?.('retry-after'));
      return new LlmError('rate_limited', detail, status, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined);
    }
    if (status === 401 || status === 403 || status === 404) return new LlmError('misconfigured', detail, status);
    if (status !== undefined && status >= 500) return new LlmError('upstream', detail, status);
    if (status === 400 || status === 422) return new LlmError('bad_output', detail, status);
  }

  // The SDK's structured-output parsing and our own schema checks.
  const name = err instanceof Error ? err.name : '';
  if (name === 'ZodError' || /FinishReasonError|SyntaxError/.test(name) || /structured output|failed to parse|refus/i.test(detail)) {
    return new LlmError('bad_output', detail);
  }
  return new LlmError('unknown', detail);
}

/** What a visitor may be told, and how the HTTP response should look. */
export interface VisitorFailure {
  status: number;
  code: 'busy' | 'unavailable';
  error: string;
  retryAfter?: number;
}

export function visitorFailure(err: unknown): VisitorFailure {
  const e = err instanceof LlmError ? err : classifyLlmError(err);
  if (e.kind === 'rate_limited' || e.kind === 'circuit_open') {
    return { status: 503, code: 'busy', error: 'The assistant is very busy right now. Please try again in a moment.', retryAfter: e.retryAfter ?? 10 };
  }
  return { status: 503, code: 'unavailable', error: 'The assistant is temporarily unavailable. Please try again.' };
}
