// src/components/SpaceGame/SpaceGameSurface.tsx
/**
 * The /game route's play surface: a poster with a PLAY button that mounts the
 * Phaser game on click.
 *
 * ── Why the game is not mounted on load ────────────────────────────────────
 * Phaser is ~340 KB gzipped — larger than this site's entire homepage JS. The
 * `import()` below is the ONLY thing that pulls it, and it lives inside the
 * click handler, so a visitor who lands on /game and never presses PLAY pays
 * nothing for the engine. `vite.chunks.js` pins phaser to its own chunk so the
 * bundler cannot merge it into anything on the critical path.
 *
 * See applications/space-game/PORTING.md §4.2 — and verify it against a
 * PRODUCTION build, because Vite's dev server eagerly resolves dynamic imports.
 *
 * ── The boundary ───────────────────────────────────────────────────────────
 * This file imports exactly one thing from the game — `mountGame` — and the
 * types beside it. Nothing else, ever. If something here ever needs a deeper
 * import, the boundary has leaked; fix the boundary instead (HANDOFF §1).
 */
import { useCallback, useEffect, useRef, useState } from "react";
// Types come from a standalone module, NOT from "./game" — that module
// imports Phaser and CSS, and pulling it into the SSR graph breaks the
// prerender of this route. See types.ts.
import type { GameHandle, GameResult } from "./types";

type Status = "idle" | "loading" | "playing" | "error";

export default function SpaceGameSurface() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GameResult | null>(null);

  // Tear the game down on unmount. `destroy()` releases the WebGL context and
  // the AudioContext — browsers cap how many a page may hold, so skipping this
  // leaks both on every navigation away.
  useEffect(() => {
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  const play = useCallback(async () => {
    if (status === "loading" || status === "playing") return;
    const el = mountRef.current;
    if (!el) return;

    setStatus("loading");
    try {
      // The dynamic import that pulls Phaser. Nothing above this line does.
      const { mountGame } = await import("./game");
      handleRef.current = await mountGame(el, {
        onWin: (r) => setResult(r),
      });
      setStatus("playing");
    } catch (err) {
      console.error("[space-game] failed to start", err);
      setStatus("error");
    }
  }, [status]);

  return (
    <div className="w-full">
      {/* The mount point. mountGame() adds `.space-game` to this element and
          appends the canvas; the game's own CSS sizes it from there. */}
      <div
        ref={mountRef}
        className="w-full grid place-items-center"
        aria-live="polite"
      >
        {status !== "playing" && (
          <div className="grid place-items-center gap-6 py-16 text-center">
            <div className="grid gap-3">
              <h1 className="text-heading text-4xl sm:text-5xl font-bold">
                Saucer Defender
              </h1>
              <p className="text-text/80 max-w-prose">
                A green armada is jamming the website. Score 10,000 points in 90
                seconds and the discount is yours.
              </p>
            </div>

            <button
              type="button"
              onClick={play}
              disabled={status === "loading"}
              className="rounded-full bg-accent px-10 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {status === "loading" ? "Launching…" : "Play"}
            </button>

            {status === "error" && (
              <p className="text-sm text-red-400" role="alert">
                The game failed to load. Please refresh and try again.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Placeholder for the discount claim. The reward mechanic attaches here
          and nowhere else — the game itself must never learn about the form
          (PORTING.md §6.1). */}
      {result && (
        <div
          className="mx-auto mt-8 max-w-md rounded-2xl border border-accent/40 bg-bg2 p-6 text-center"
          role="status"
        >
          <h2 className="text-heading text-2xl font-bold">You won!</h2>
          <p className="text-text/80 mt-2">
            Final score {result.score.toLocaleString()} with{" "}
            {result.timeLeft.toFixed(1)}s to spare.
          </p>
          <p className="text-text/60 mt-4 text-sm">
            Discount claim form coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
