// src/game/entities/grenade.ts
/**
 * The thrown grenade — a single in-flight projectile.
 *
 * Only one can be airborne at a time, so this is a plain record on the scene
 * rather than a pool: pooling one object buys nothing.
 *
 * Motion is a simple ballistic arc — constant horizontal velocity, gravity on
 * the vertical. Velocities are integrated by `dt` (never per frame), and the
 * fuse is a countdown rather than a comparison against elapsed time, so nothing
 * here depends on how long the page has been open (HANDOFF §4).
 */
import Phaser from "phaser";
import { GRENADE, vScale } from "../tuning";
import { TEX } from "../scenes/BootScene";

export interface Grenade {
  img: Phaser.GameObjects.Image;
  active: boolean;
  vx: number;
  vy: number;
  /** Seconds until it detonates on its own. */
  fuse: number;
}

export function throwGrenade(g: Grenade, x: number, y: number, tint: number) {
  g.active = true;
  g.vx = GRENADE.throwSpeed;
  // Lift and gravity are vertical, so they scale — otherwise the arc would be a
  // barely-visible twitch in a tall portrait world.
  g.vy = GRENADE.throwLift * vScale();
  g.fuse = GRENADE.fuseSeconds;
  g.img.setTexture(TEX.grenadeIcon);
  g.img.setPosition(x, y);
  g.img.setScale(1.3);
  g.img.setTint(tint);
  g.img.setVisible(true);
  g.img.setActive(true);
}

export function clearGrenade(g: Grenade) {
  g.active = false;
  g.img.setVisible(false);
  g.img.setActive(false);
}

/** Advance the arc. Returns true when the fuse runs out. */
export function updateGrenade(g: Grenade, dt: number): boolean {
  g.vy += GRENADE.gravity * vScale() * dt;
  g.img.x += g.vx * dt;
  g.img.y += g.vy * dt;
  // Tumble as it flies. setAngle is absolute, so this cannot accumulate.
  g.img.setAngle(g.img.angle + 420 * dt);

  g.fuse -= dt;
  return g.fuse <= 0;
}
