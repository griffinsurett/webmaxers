// src/components/SpaceGame/useRocketLoader.ts
/**
 * Drives the blastoff loader that `game.astro` renders as static markup.
 *
 * ── Why this is a hook over existing DOM, not a component ──────────────────
 * The loader was first written as a React component, and it was wrong: the
 * island that would have rendered it is `client:only`, so React had to arrive
 * before the loader could appear. Measured on a throttled connection, it never
 * appeared at all — the slower the network, the longer the black screen before
 * the thing whose entire job is covering the wait showed up. Exactly backwards.
 *
 * So the markup is prerendered in the page and paints on the first frame, and
 * this hook only takes it away. Removal is the one part that genuinely needs
 * to wait for React, because it is what hands over to the mounted game.
 *
 * ── The race (PORTING.md §4.3) ─────────────────────────────────────────────
 * Two clocks: the rocket's flight (fixed) and the engine download (unknown).
 * The loader lifts only when BOTH have landed — so a fast connection never
 * cuts the animation off mid-climb, and a slow one is not left staring at a
 * finished animation with no explanation.
 */
import { useEffect } from "react";

/** Must match `--rocket-flight` / the animation duration in
 *  rocket-loader.css. If these drift apart the loader either lifts mid-climb
 *  or lingers after the rocket has gone. */
const FLIGHT_MS = 5200;
/** Still waiting this long after the climb ends? Say so. */
const LONG_WAIT_MS = 3000;
/** Matches the fade-out transition in the stylesheet. */
const FADE_MS = 420;

export function useRocketLoader(engineReady: boolean) {
  useEffect(() => {
    const el = document.getElementById("rocket-loader");
    if (!el) return;

    // Under reduced motion there is no flight to wait for — the stylesheet
    // parks the rocket and the attribute was set pre-paint in the page.
    const reduced = el.getAttribute("data-reduced") === "true";
    const flightMs = reduced ? 0 : FLIGHT_MS;

    // How long the loader has already been on screen. The flight starts at
    // first paint, not at hydration, so waiting the full duration from HERE
    // would hold the loader up by however long React took to arrive.
    const elapsed = performance.now();
    const remaining = Math.max(0, flightMs - elapsed);

    let slowTimer: number | undefined;
    let removeTimer: number | undefined;

    const flightTimer = window.setTimeout(() => {
      if (engineReady) {
        el.classList.add("is-leaving");
        removeTimer = window.setTimeout(() => el.remove(), FADE_MS);
      } else {
        // Animation won the race. Park the rocket and explain the wait rather
        // than freezing — a stopped animation with no message reads as a crash.
        el.classList.add("is-waiting");
        slowTimer = window.setTimeout(() => {
          const cap = el.querySelector("[data-rocket-caption]");
          if (cap) cap.textContent = "Still loading — hang tight…";
        }, LONG_WAIT_MS);
      }
    }, remaining);

    return () => {
      window.clearTimeout(flightTimer);
      if (slowTimer) window.clearTimeout(slowTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, [engineReady]);
}
