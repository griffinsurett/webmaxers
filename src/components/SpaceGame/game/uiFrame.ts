// src/game/uiFrame.ts
/**
 * Orientation helpers for the full-screen UI scenes (title, how-to, game over).
 *
 * In portrait the canvas is rotated a quarter turn by CSS so this horizontal
 * shooter fills a vertical screen (see game.css). That turn is applied to the
 * canvas element, so it takes the UI with it — which is why the title and game
 * over text render sideways unless something undoes it.
 *
 * PlayScene solves this by rotating a HUD container, because it has a game
 * world underneath that must stay in world space. These scenes have no such
 * constraint: they are ENTIRELY text and buttons, and every single object wants
 * the same correction. So they take the simpler route and rotate the camera,
 * which needs no per-object bookkeeping and cannot drift out of sync with the
 * layout.
 */
import type Phaser from "phaser";
import { isRotated } from "./tuning";

/**
 * Whether this is a touch device, for choosing copy ("TAP" vs "PRESS SPACE").
 *
 * A coarse pointer, not screen size: a small window on a desktop still has a
 * keyboard, and a large tablet still does not. Both input paths are wired up
 * regardless, so a wrong guess costs nothing worse than slightly odd wording —
 * telling a phone user to "PRESS SPACE" is the failure this avoids.
 */
export const isTouch = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * The frame a UI scene should lay itself out against.
 *
 * In portrait the dimensions swap: the scene gets the tall narrow frame the
 * player actually sees, rather than the wide short canvas underneath it.
 * Scenes must use this instead of `this.scale` for every position, or they will
 * lay out against the wrong rectangle and centre their text off-screen.
 */
export function uiFrame(scene: Phaser.Scene): { width: number; height: number } {
  const { width, height } = scene.scale;
  return isRotated() ? { width: height, height: width } : { width, height };
}

/**
 * Make everything a UI scene has drawn read upright in portrait.
 *
 * Call at the END of `create()`, once every object exists — it sweeps the
 * scene's display list, so anything added afterwards is missed.
 *
 * Rotating the camera instead would be simpler to write and does not work: a
 * camera's viewport keeps the canvas's own 1280x620 shape no matter how it is
 * turned, so content laid out against the 620x1280 frame the player sees falls
 * outside it and is culled. Measured — the title screen went completely blank.
 * A container has no viewport and no such limit.
 */
/**
 * Pre-invert a Y coordinate so it survives the portrait flip.
 *
 * `uprightScene` mirrors the scene vertically to undo the canvas rotation,
 * which also reverses top-to-bottom order. Passing every Y through this puts
 * the content back in its authored order, so one layout serves both
 * orientations.
 *
 * Identity in landscape.
 */
export function uiRow(scene: Phaser.Scene, y: number): number {
  return isRotated() ? uiFrame(scene).height - y : y;
}

export function uprightScene(
  scene: Phaser.Scene,
  opts: { flipY?: boolean } = {},
): void {
  if (!isRotated()) return;

  const { width, height } = scene.scale;

  // Snapshot first: adding to a container mutates the display list being read.
  const objs = scene.children.list.slice();

  // Children hold coordinates in the UI frame, whose origin is its top-left. A
  // container measures its children from its own centre and re-parents without
  // adjusting for its position, so rebase BEFORE adding or the offset lands
  // twice.
  //
  // This is the same transform PlayScene applies to its HUD, and for the same
  // reason. It is expressed as a rebase plus a +90 turn: the turn cancels the
  // CSS -90 so glyphs read upright, and the rebase converts each object's
  // UI-frame coordinate (origin top-left) into container-local space (origin
  // centre).
  //
  // The Y flip is what makes the turn come out upright rather than upside-down.
  // It also reverses top-to-bottom order, so callers lay their content out
  // against `uiFrame()` and pass each Y through `uiRow()`, which pre-inverts it.
  // Doing the inversion at the layout site rather than here is what keeps a
  // stacked screen (title above body above prompt) in its authored order.
  const frame = uiFrame(scene);
  for (const o of objs) {
    const t = o as unknown as { x?: number; y?: number };
    if (typeof t.x !== "number" || typeof t.y !== "number") continue;
    t.x -= frame.width / 2;
    t.y = frame.height / 2 - t.y;
    // `flipY` restores authored top-to-bottom order for scenes that did not
    // pre-invert their own layout — see the note on the option.
    if (opts.flipY) t.y = -t.y;
  }

  scene.add
    .container(width / 2, height / 2, objs)
    .setRotation(Math.PI / 2)
    .setDepth(1000);
}
