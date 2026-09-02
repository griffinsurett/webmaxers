// src/components/SpaceGame/SpaceGameSurface.tsx
/**
 * The /game route's play surface. Mounts the Phaser game as soon as it renders
 * and fills the viewport.
 *
 * ── Autostart, and why it is still not on the critical path ────────────────
 * There is no PLAY button: /game is a destination the visitor chose from the
 * nav, so making them press a second button to reach the thing they asked for
 * is a step for nothing. The game's own TitleScene is the real start screen —
 * it already says "PRESS SPACE TO LAUNCH" and holds until the player acts, so
 * nothing begins without input.
 *
 * The engine is STILL lazily loaded. The `import()` below runs in an effect on
 * this route only, and `vite.chunks.js` pins phaser to its own chunk, so no
 * other page on the site pays for it. That is the promise PORTING.md §4.2
 * makes — "nothing before the click" was one way to keep it; "nothing outside
 * this route" is the same guarantee now that the route IS the game.
 *
 * NOTE: do not add a manualChunks rule for this directory. It captures Vite's
 * shared preload helper and drags phaser onto every page. See vite.chunks.js.
 *
 * ── The boundary ───────────────────────────────────────────────────────────
 * This file imports exactly one thing from the game — `mountGame` — plus the
 * types beside it. If anything here ever needs a deeper import, the boundary
 * has leaked; fix the boundary instead (HANDOFF §1).
 */
import { useEffect, useRef, useState } from "react";
// Types come from a standalone module, NOT from "./game" — that module imports
// Phaser and CSS, and pulling it into the SSR graph breaks this route's
// prerender. See types.ts.
import type { GameHandle, GameResult } from "./types";

type Status = "loading" | "playing" | "error";

export default function SpaceGameSurface() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    // Guards against React 18 StrictMode's double-invoked effects in dev, which
    // would otherwise mount two Phaser instances and stack two canvases.
    let cancelled = false;

    (async () => {
      const el = mountRef.current;
      if (!el) return;
      try {
        const { mountGame } = await import("./game");
        if (cancelled) return;
        const handle = await mountGame(el, {
          onWin: (r) => setResult(r),
        });
        // The import may have resolved after unmount; tear down immediately
        // rather than leaking a canvas and an AudioContext.
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        setStatus("playing");
      } catch (err) {
        console.error("[space-game] failed to start", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      // Releases the WebGL context and the AudioContext. Browsers cap how many
      // a page may hold, so skipping this leaks both on every navigation away.
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return (
    <>
      {/* The mount point. mountGame() adds `.space-game` here and appends the
          canvas; game.css sizes it, and the route overrides those caps to fill
          the viewport. */}
      <div ref={mountRef} className="h-dvh w-full" />

      {status === "loading" && (
        <p
          className="pointer-events-none fixed inset-0 grid place-items-center text-text/70"
          role="status"
        >
          Loading…
        </p>
      )}

      {status === "error" && (
        <div className="fixed inset-0 grid place-items-center p-6 text-center">
          <div>
            <p className="text-heading text-xl font-bold" role="alert">
              The game failed to load.
            </p>
            <p className="text-text/70 mt-2">Please refresh and try again.</p>
          </div>
        </div>
      )}

      {/* Placeholder for the discount claim. The reward mechanic attaches here
          and nowhere else — the game itself must never learn about the form
          (PORTING.md §6.1). Note onWin fires once per WINNING RUN, so this must
          become idempotent before it issues anything real. */}
      {result && (
        <div
          className="fixed bottom-6 left-1/2 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-accent/40 bg-bg2 p-6 text-center"
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
    </>
  );
}
