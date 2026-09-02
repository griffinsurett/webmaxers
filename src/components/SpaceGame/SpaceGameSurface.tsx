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
import { useRocketLoader } from "./useRocketLoader";
import DiscountClaim, { DiscountTerms } from "./DiscountClaim";
import { DISCOUNT_LABEL } from "./discount";
import "./discount-claim.css";
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

  // The blastoff loader is static markup in game.astro so it paints on the
  // first frame; this only takes it away once the engine is up. It owns the
  // race between the flight and the download (PORTING.md §4.3).
  const [engineReady, setEngineReady] = useState(false);
  useRocketLoader(engineReady);

  /**
   * True once the visitor has claimed. `onWin` fires per winning run, so
   * without this a second win would offer a second discount — which the terms
   * explicitly say does not happen. Session-scoped only: this is a marketing
   * toy, and the real guard is that a person reviews the lead before honouring
   * anything (PORTING.md §6.2).
   */
  const [claimedOnce, setClaimedOnce] = useState(false);

  /**
   * While the reward overlay is up, pin the page. It is a fixed full-viewport
   * layer, so a page scrolled down to the terms showed those terms drifting
   * behind the panel — two copies of the same list on screen at once. Locking
   * scroll and returning to the top puts the overlay against the game's own
   * starfield, which is what it is designed to sit on.
   */
  const rewardOpen = Boolean(result) && !claimedOnce;

  useEffect(() => {
    if (!rewardOpen) return;
    const { body } = document;
    const prev = body.style.overflow;
    window.scrollTo({ top: 0, behavior: "auto" });
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [rewardOpen]);


  /**
   * Dismiss the reward and hand control back to the game, which is already
   * sitting on its own GameOver screen waiting for a keypress. Deliberately NOT
   * a page reload: that would re-download the engine and replay the rocket.
   *
   * `claimed` distinguishes the two ways this is reached. The button only
   * exists on the thank-you screen, so it is always true today — but passing it
   * explicitly means someone who dismisses the overlay WITHOUT submitting is
   * not silently marked as having claimed, which would lock them out of a
   * discount they never received.
   */
  const playAgain = (claimed: boolean) => {
    if (claimed) setClaimedOnce(true);
    setResult(null);
  };

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
          // Tells the game's title screen what the player is competing for. It
          // still knows nothing about discounts, terms or forms.
          rewardLabel: DISCOUNT_LABEL,
          onWin: (r) => setResult(r),
        });
        // The import may have resolved after unmount; tear down immediately
        // rather than leaking a canvas and an AudioContext.
        if (cancelled) {
          handle.destroy();
          return;
        }
        handleRef.current = handle;
        setEngineReady(true);
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

      {/* No loader markup here on purpose — see useRocketLoader. It sits over
          the canvas rather than replacing it, so Phaser always has a real,
          correctly-sized element to measure: the world's height is derived
          from that box (config.ts), and booting into a hidden or zero-size div
          would hand it the wrong shape. */}

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

      {/* What the prize actually is, readable BEFORE playing rather than only
          after winning. Sits below the canvas — the game owns the first
          screenful, this is one scroll down.

          Hidden while the reward overlay is open. The overlay is translucent so
          the starfield shows through it, which also meant these terms showed
          through — the same four bullets twice on one screen. Scroll-locking
          alone did not fix that: the section is still painted below the fold
          behind a fixed layer. */}
      {!rewardOpen && <DiscountTerms />}

      {/* The win reward. Arrives only through `onWin`, the single hook the
          game boundary exposes — nothing under game/ knows this exists
          (PORTING.md §6.1).

          onWin fires once per WINNING RUN, not once per session, so a player
          who wins three times fires it three times. `claimedOnce` is what
          makes that idempotent: after the first claim the reward does not
          reappear, which is also what the terms promise. */}
      {rewardOpen && result && (
        <DiscountClaim result={result} onPlayAgain={playAgain} />
      )}

    </>
  );
}
