// src/game/entities/collide.ts
/**
 * Collision tests.
 *
 * Circle-vs-circle, compared as SQUARED distances so there is no sqrt in the
 * hot path. With ~100 possible pairs per frame that is not a bottleneck either
 * way, but it costs nothing to write correctly.
 *
 * Phaser's Arcade Physics could do this via overlap callbacks. It is done by
 * hand because the entities are pooled plain records rather than physics
 * bodies, and hand-rolling ~10 lines is simpler than keeping bodies in sync
 * with a pool.
 */
export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}
