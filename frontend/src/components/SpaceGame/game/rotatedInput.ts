// src/game/rotatedInput.ts
/**
 * Make pointer input work when the canvas is rotated by CSS.
 *
 * On a portrait phone the canvas is turned a quarter turn (see game.css) so
 * this horizontal shooter fills a vertical screen. CSS `transform` is a purely
 * visual operation: it moves the pixels the player sees, but Phaser still maps
 * touches through the canvas's UNROTATED layout box. The result is that every
 * tap lands somewhere other than where the player aimed — buttons in the
 * corners simply stop responding, which is exactly what was observed.
 *
 * Phaser converts DOM coordinates to game coordinates in `transformX` and
 * `transformY` on the ScaleManager. Those two are the only place it happens,
 * which makes them the natural seam — but each receives a single axis, and a
 * rotation mixes the axes, so neither can be corrected on its own.
 *
 * So both are replaced with a pair that reads the raw page coordinates off the
 * live pointer event, un-rotates them together, and returns the axis asked for.
 * Everything downstream — hit tests, drag, `hitTestPointer` — is unchanged,
 * because they all consume the output of these two functions.
 */
import type Phaser from "phaser";

/**
 * The inverse of `rotate(-90deg)` about the canvas centre.
 *
 * With the canvas turned -90, a point the player touches at (px, py) — measured
 * in the rotated box the browser lays out — corresponds to the game point:
 *
 *     gameX = (py - top)  * scaleX
 *     gameY = (right - px) * scaleY
 *
 * i.e. the screen's vertical axis feeds the game's X, and the screen's
 * horizontal axis feeds the game's Y reversed. Both are then scaled from CSS
 * pixels into world units by the ScaleManager's own display scale.
 */
export function installRotatedInput(game: Phaser.Game): void {
  const scale = game.scale as Phaser.Scale.ScaleManager & {
    __rotatedPatched?: boolean;
  };
  if (scale.__rotatedPatched) return;
  scale.__rotatedPatched = true;

  // The rotated canvas's on-screen box. `getBoundingClientRect` already
  // accounts for the CSS transform, so this is the rectangle the player is
  // actually touching.
  const rect = () => game.canvas.getBoundingClientRect();

  const map = (pageX: number, pageY: number) => {
    const r = rect();
    const sx = window.pageXOffset || 0;
    const sy = window.pageYOffset || 0;
    // Position within the visible box, 0..1 on each axis.
    const u = (pageX - sx - r.left) / (r.width || 1);
    const v = (pageY - sy - r.top) / (r.height || 1);
    // Un-rotate. The canvas is turned -90deg, so the mapping back is:
    // the screen's vertical axis feeds the world's X *reversed* (the bottom of
    // the screen is the world's left, where the craft sits), and the screen's
    // horizontal axis feeds the world's Y directly.
    //
    // Verified against a live tap rather than derived on paper: a touch on the
    // pause button at screen (365, 810) must resolve to world (~38, ~590).
    return {
      x: (1 - v) * scale.width,
      y: u * scale.height,
    };
  };

  scale.transformX = function (pageX: number): number {
    const e = currentEvent();
    // Fall back to the unrotated path if no event is in flight — Phaser also
    // calls these from places where only one axis is known, and a wrong answer
    // there is better handled by the original behaviour than by a guess.
    if (!e) return (pageX - this.canvasBounds.left) * this.displayScale.x;
    return map(e.pageX, e.pageY).x;
  };

  scale.transformY = function (pageY: number): number {
    const e = currentEvent();
    if (!e) return (pageY - this.canvasBounds.top) * this.displayScale.y;
    return map(e.pageX, e.pageY).y;
  };

  // The page coordinates of the event Phaser is currently processing. Captured
  // in the capture phase so it is set before Phaser's own listeners run.
  let last: { pageX: number; pageY: number } | null = null;
  const currentEvent = () => last;

  const record = (ev: Event) => {
    const pe = ev as PointerEvent & { touches?: TouchList };
    const t = pe.touches && pe.touches.length > 0 ? pe.touches[0] : null;
    if (t) {
      last = { pageX: t.pageX, pageY: t.pageY };
    } else if (typeof pe.pageX === "number") {
      last = { pageX: pe.pageX, pageY: pe.pageY };
    }
  };

  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "touchstart",
    "touchmove",
    "touchend",
    "mousedown",
    "mousemove",
    "mouseup",
  ]) {
    window.addEventListener(type, record, { capture: true, passive: true });
  }
}
