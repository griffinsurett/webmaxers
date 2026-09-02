// src/game/scenes/starfield.ts
/**
 * The scrolling starfield, shared by Title and Play.
 *
 * Extracted rather than duplicated because the title screen shows the same
 * space the game is played in — a separate implementation would drift out of
 * sync the first time either was tuned.
 *
 * Wraps by SUBTRACTING a width once a star passes the left edge, so positions
 * stay bounded however long the page has been open. An ever-growing offset
 * would eventually lose float precision (see HANDOFF §4).
 */
import Phaser from "phaser";
import { getPalette } from "../palette";
import { TEX } from "./BootScene";

/** [count, speed px/s, alpha, scale] per depth layer. Parallax = depth. */
export const STAR_LAYERS = [
  { count: 60, speed: 22, alpha: 0.35, scale: 1 },
  { count: 40, speed: 55, alpha: 0.6, scale: 1 },
  { count: 22, speed: 110, alpha: 1, scale: 1.5 },
] as const;

export interface Star {
  img: Phaser.GameObjects.Image;
  speed: number;
}

export function createStarfield(scene: Phaser.Scene): Star[] {
  const { width, height } = scene.scale;
  const p = getPalette(scene.game.canvas.parentElement as HTMLElement);
  const stars: Star[] = [];

  for (const layer of STAR_LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const img = scene.add
        .image(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          TEX.star,
        )
        .setAlpha(layer.alpha)
        .setScale(layer.scale)
        .setTint(p.int.star);
      stars.push({ img, speed: layer.speed });
    }
  }

  return stars;
}

/** Advance the field. `dt` in seconds. */
export function updateStarfield(
  scene: Phaser.Scene,
  stars: Star[],
  dt: number,
) {
  const { width, height } = scene.scale;
  for (const s of stars) {
    s.img.x -= s.speed * dt;
    if (s.img.x < -2) {
      s.img.x += width + 4;
      s.img.y = Phaser.Math.Between(0, height);
    }
  }
}
