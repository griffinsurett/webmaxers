// src/components/SpaceGame/types.ts
/**
 * Host-side type-only mirror of the game's public surface.
 *
 * Why this file exists rather than importing the types from `./game`:
 * `game/index.ts` has a side-effect import (`game.css`) and, through the
 * scenes, a static import of Phaser — which touches `window` at module scope.
 * Astro prerenders /game on the server, and even an `import type` from a
 * module with side effects was enough to drag Phaser into the SSR graph and
 * fail the build with "window is not defined".
 *
 * Keeping the types in their own module with NO imports means the host can
 * describe the boundary without loading any part of it. These must stay in
 * sync with `game/index.ts` — they are the same two interfaces, and the
 * boundary is deliberately small enough that this is cheap (HANDOFF §1).
 */

export type GamePhase =
  | "boot"
  | "title"
  | "story"
  | "playing"
  | "paused"
  | "dead"
  | "won";

export interface GameResult {
  score: number;
  wave: number;
  durationMs: number;
  /** Seconds left on the clock; 0 means the run timed out. */
  timeLeft: number;
}

export interface GameHandle {
  destroy(): void;
  setMuted(muted: boolean): void;
  pause(): void;
  resume(): void;
}
