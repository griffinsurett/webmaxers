// src/game/entities/pool.ts
/**
 * A fixed-size object pool.
 *
 * Bullets and saucers are created and destroyed constantly, and allocating per
 * shot causes GC pauses that read as stutter — so every one is pre-allocated at
 * scene start and reused via an `active` flag (HANDOFF §4).
 *
 * `get()` returns null when the pool is exhausted rather than growing. That is
 * deliberate: a hard cap means the frame cost has a known ceiling, and running
 * out simply drops a shot, which is imperceptible. Silent unbounded growth is
 * how a game starts fine and degrades after two minutes.
 */
export interface Poolable {
  active: boolean;
}

export class Pool<T extends Poolable> {
  readonly items: T[];

  constructor(size: number, make: (i: number) => T) {
    this.items = Array.from({ length: size }, (_, i) => make(i));
  }

  /** First inactive item, or null if all are in use. */
  get(): T | null {
    for (const it of this.items) {
      if (!it.active) return it;
    }
    return null;
  }

  /** Iterate only the live ones. */
  forEachActive(fn: (item: T) => void) {
    for (const it of this.items) {
      if (it.active) fn(it);
    }
  }

  get activeCount(): number {
    let n = 0;
    for (const it of this.items) if (it.active) n++;
    return n;
  }
}
