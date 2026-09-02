// src/game/waves.ts
/**
 * Continuous escalation, not discrete waves.
 *
 * The original design had six labelled waves with breaks between them. That was
 * dropped: the game reads better as one unbroken assault where every saucer is
 * hunting the player, so there is never a lull and never a moment where nothing
 * is shooting.
 *
 * Difficulty is therefore a FUNCTION OF TIME rather than a table of stages.
 * Everything below is derived from `elapsed` seconds, which means the curve is
 * smooth, has no seams, and is tuned by editing four numbers.
 */
import type { SaucerKind } from "./tuning";

export const ESCALATION = {
  /**
   * Seconds to reach full intensity.
   *
   * Tuned against SCORING.timeLimit (90s), not against the score target.
   *
   * Ramping over 55s puts peak pressure in the final third — the player has
   * learned the patterns by then, and the last 35s are the ones that decide the
   * run. A 70s ramp (the previous value) left only 20s at full intensity, so the
   * hardest part arrived at the buzzer and a good run never really got tested.
   */
  rampSeconds: 55,

  /** Seconds between spawns: starts slow, tightens toward `intervalMin`. */
  intervalStart: 1.15,
  intervalMin: 0.34,

  /** Enemy fire-rate multiplier over the ramp. */
  fireScaleStart: 0.55,
  fireScaleMax: 1.5,

  /** Max saucers alive at once, so the screen never becomes unreadable. */
  maxAliveStart: 5,
  maxAliveEnd: 12,
} as const;

/** 0 → 1 across the ramp, then held at 1. */
export function intensity(elapsed: number): number {
  return Math.min(elapsed / ESCALATION.rampSeconds, 1);
}

export function spawnInterval(elapsed: number): number {
  const t = intensity(elapsed);
  return (
    ESCALATION.intervalStart +
    (ESCALATION.intervalMin - ESCALATION.intervalStart) * t
  );
}

export function fireScale(elapsed: number): number {
  const t = intensity(elapsed);
  return (
    ESCALATION.fireScaleStart +
    (ESCALATION.fireScaleMax - ESCALATION.fireScaleStart) * t
  );
}

export function maxAlive(elapsed: number): number {
  const t = intensity(elapsed);
  return Math.round(
    ESCALATION.maxAliveStart +
      (ESCALATION.maxAliveEnd - ESCALATION.maxAliveStart) * t,
  );
}

/**
 * Which kinds can appear, and how likely each is, at a given time.
 *
 * Scouts thin out as divers and weavers take over — so the mix gets more
 * dangerous without the total count being the only lever. Every kind that can
 * appear here shoots (see tuning.ts): there are no harmless enemies.
 */
export function pickKind(elapsed: number): SaucerKind {
  const t = intensity(elapsed);
  const r = Math.random();

  // Weights slide from scout-heavy to diver-heavy across the ramp.
  const scout = 0.55 - 0.4 * t;   // 0.55 → 0.15
  const weaver = 0.30 + 0.05 * t; // 0.30 → 0.35

  if (r < scout) return "scout";
  if (r < scout + weaver) return "weaver";
  return "diver";
}
