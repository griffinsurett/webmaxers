// src/game/index.ts
/**
 * THE PUBLIC API. This file is the entire contract between the game and
 * whatever hosts it — the standalone dev page now, the webmaxxers /game route
 * later. Two exports, and nothing else:
 *
 *     mountGame(el, opts) -> GameHandle
 *     GameHandle.destroy()
 *
 * Keep it that way. If the host ever needs to import anything from deeper in
 * `game/`, that is the signal that this boundary has sprung a leak, and porting
 * gets harder in proportion. Nothing under `game/` may import anything
 * host-specific (no Astro, no React, no site utils) for the same reason.
 *
 * Phaser is imported DYNAMICALLY here. It is ~340 KB gzipped (measured, not the
 * ~250 KB commonly quoted) — larger than the
 * host site's entire homepage JS — so it must never be pulled into a static
 * chunk. The host loads the game on an explicit click, and this dynamic import
 * is what keeps that promise honest.
 */
import "@/components/SpaceGame/game.css";

export interface MountOptions {
  /** Called on any phase change, for host-side UI (score display, etc.). */
  onPhase?: (phase: GamePhase) => void;
  /** Called once when the player wins. The reward hook goes here — later. */
  onWin?: (result: GameResult) => void;
  /**
   * Start muted. Default FALSE — the game is an opt-in experience the visitor
   * clicked into, so sound is part of it. The host can still pass `muted: true`
   * if it is ever embedded somewhere that must stay silent.
   */
  muted?: boolean;
}

export type GamePhase = "boot" | "title" | "story" | "playing" | "paused" | "dead" | "won";

export interface GameResult {
  score: number;
  wave: number;
  durationMs: number;
  /**
   * Seconds left on the clock. 0 means the run timed out; anything above means
   * it ended some other way (all lives lost, or a win). Lets the host tell those
   * apart without a second flag.
   */
  timeLeft: number;
}

export interface GameHandle {
  /** Tear down completely: destroys the Phaser instance and all listeners. */
  destroy(): void;
  /** Mute or unmute all sound. */
  setMuted(muted: boolean): void;
  /** Pause/resume from the host (e.g. a modal opened over the game). */
  pause(): void;
  resume(): void;
}

export async function mountGame(
  el: HTMLElement,
  opts: MountOptions = {},
): Promise<GameHandle> {
  el.classList.add("space-game");

  // Dynamic: keeps Phaser out of the host's static graph. See the note above.
  const [
    { default: Phaser },
    { createConfig },
    { isRotated },
    { installRotatedInput },
  ] = await Promise.all([
    import("phaser"),
    import("./config"),
    import("./tuning"),
    import("./rotatedInput"),
  ]);

  const game = new Phaser.Game(createConfig(el, opts));

  // Portrait rotates the canvas in CSS, which pointer input does not follow on
  // its own. Must run before any scene binds input.
  if (isRotated()) installRotatedInput(game);

  // Dev-only handle so the running scene can be measured from a browser
  // session. Never exposed in a production build.
  if (import.meta.env.DEV) {
    (window as unknown as { __game?: Phaser.Game }).__game = game;
  }

  return {
    setMuted(muted: boolean) {
      // The GameAudio instance lives on the registry (see config.ts) so scenes
      // and the host share one context.
      const audio = game.registry.get("audio") as
        | { setMuted(m: boolean): void }
        | undefined;
      audio?.setMuted(muted);
    },
    destroy() {
      // Release the AudioContext before the game goes: browsers cap how many a
      // page may hold, so a mount/unmount cycle would leak them.
      const audio = game.registry.get("audio") as
        | { destroy(): void }
        | undefined;
      audio?.destroy();
      // `true` also removes the canvas from the DOM — without it a remount
      // stacks canvases.
      game.destroy(true);
      el.classList.remove("space-game");
    },
    pause() {
      game.scene.getScenes(true).forEach((s) => s.scene.pause());
    },
    resume() {
      game.scene.getScenes(true).forEach((s) => s.scene.resume());
    },
  };
}
