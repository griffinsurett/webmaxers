// src/game/entities/bullet.ts
/**
 * Bullets, for both sides. One record type with a `friendly` flag rather than
 * two near-identical ones — the only differences are direction, tint and which
 * collision test they take part in.
 */
import Phaser from "phaser";
import { SHOT } from "../tuning";
import { TEX } from "../scenes/BootScene";

export interface Bullet {
  img: Phaser.GameObjects.Image;
  active: boolean;
  /** px/second along X. Positive = rightward (player), negative = alien. */
  vx: number;
}

export function fireBullet(
  b: Bullet,
  x: number,
  y: number,
  friendly: boolean,
  tint: number,
) {
  b.active = true;
  b.vx = friendly ? SHOT.playerSpeed : -SHOT.alienSpeed;
  b.img.setTexture(TEX.shot);
  b.img.setPosition(x, y);
  b.img.setTint(tint);
  b.img.setVisible(true);
  b.img.setActive(true);
}

export function killBullet(b: Bullet) {
  b.active = false;
  b.img.setVisible(false);
  b.img.setActive(false);
}

/** Advance; caller retires it when it leaves the field. */
export function updateBullet(b: Bullet, dt: number) {
  b.img.x += b.vx * dt;
}
