// backend/src/services/llm/breaker.ts
// Circuit breaker. When a provider keeps failing, every visitor would otherwise wait out the full
// timeout (and retries) before seeing an error, and a research run would burn its whole time
// budget. After N failures in a row the circuit opens: calls fail immediately for a cool-down,
// then one probe is let through; success closes the circuit, failure re-opens it.

export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerOptions {
  /** Consecutive health failures before opening. */
  threshold?: number;
  /** How long to stay open before allowing a probe. */
  openMs?: number;
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private probing = false;
  private readonly threshold: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor(options: BreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.openMs = options.openMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  get state(): BreakerState {
    if (this.openedAt === null) return 'closed';
    return this.now() - this.openedAt >= this.openMs ? 'half_open' : 'open';
  }

  /** Asks permission for one call. When refused, `retryAfterMs` says when to come back. */
  acquire(): { ok: true; probe: boolean } | { ok: false; retryAfterMs: number } {
    const state = this.state;
    if (state === 'closed') return { ok: true, probe: false };
    if (state === 'open') return { ok: false, retryAfterMs: this.openMs - (this.now() - this.openedAt!) };
    if (this.probing) return { ok: false, retryAfterMs: 1000 }; // someone is already testing the provider
    this.probing = true;
    return { ok: true, probe: true };
  }

  /** The provider answered (even with unusable content): it is healthy. */
  success(): void {
    this.failures = 0;
    this.openedAt = null;
    this.probing = false;
  }

  failure(): void {
    this.probing = false;
    this.failures++;
    if (this.openedAt !== null || this.failures >= this.threshold) this.openedAt = this.now();
  }

  /** The call ended without telling us anything about health (cancelled). */
  neutral(): void {
    this.probing = false;
  }
}
