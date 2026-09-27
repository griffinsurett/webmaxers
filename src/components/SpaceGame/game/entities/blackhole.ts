// src/game/entities/blackhole.ts
/**
 * The black hole — a hazard that drifts in toward the player's craft and pulls
 * it in.
 *
 * Only one exists at a time, so it is a single record rather than a pool. Like
 * the other entities it is free functions over plain data, and like them it
 * never allocates mid-run: the images are created once and toggled.
 *
 * ── Pull ────────────────────────────────────────────────────────────────────
 * `pullAt` returns a VELOCITY toward the centre for a point, never a force to
 * integrate. The caller adds it to whatever the thing is already doing, so the
 * same distance always means the same pull (HANDOFF §4).
 *
 * Distances are measured in reference space: vertical offsets are divided by
 * `vScale()` first, and the vertical result is multiplied back. On a tall
 * portrait world the well therefore covers the same PROPORTION of the field as
 * it does at 1280x720 — the same rule every other vertical number follows.
 */
import Phaser from "phaser";
import { BLACK_HOLE, vScale } from "../tuning";

export interface BlackHole {
  /** The dark core and the lensing glow around it. */
  core: Phaser.GameObjects.Image;
  /** The accretion ring, spun independently of the core. */
  ring: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  /** Seconds since it opened. */
  age: number;
  /** 0 → 1 → 0 across its life. Scales both its look and its pull. */
  strength: number;
  /** Seconds left in its collapse once it has fed; null while it is hungry. */
  collapseIn: number | null;
}

export function openBlackHole(h: BlackHole, x: number, y: number) {
  h.active = true;
  h.x = x;
  h.y = y;
  h.age = 0;
  h.strength = 0;
  h.collapseIn = null;
  for (const img of [h.core, h.ring]) {
    img.setPosition(x, y).setScale(0).setAlpha(0).setVisible(true).setActive(true);
  }
}

export function closeBlackHole(h: BlackHole) {
  h.active = false;
  h.strength = 0;
  for (const img of [h.core, h.ring]) img.setVisible(false).setActive(false);
}

/** It has swallowed the craft: stop pulling and collapse. */
export function collapseBlackHole(h: BlackHole) {
  if (h.collapseIn === null) h.collapseIn = BLACK_HOLE.collapseSeconds;
}

/**
 * Advance the hole. Returns false once it has fully closed, so the caller can
 * schedule the next one. `craftX`/`craftY` are what it drifts toward.
 */
export function updateBlackHole(
  h: BlackHole,
  dt: number,
  craftX: number,
  craftY: number,
  worldHeight: number,
): boolean {
  h.age += dt;
  const { lifetime, fadeIn, fadeOut, scale, spinDegPerSec } = BLACK_HOLE;

  if (h.collapseIn !== null) h.collapseIn -= dt;
  if (
    h.age >= lifetime ||
    h.x < BLACK_HOLE.exitX ||
    (h.collapseIn !== null && h.collapseIn <= 0)
  ) {
    closeBlackHole(h);
    return false;
  }

  // Creep toward the craft: a steady leftward drift, and a capped ease toward
  // its height while it is still far off, so it homes in without snapping onto
  // the player — then commits to its line so the player can get around it.
  // Kept out of the top and bottom bands, so there is always a way past.
  h.x -= BLACK_HOLE.approachSpeed * dt;
  if (h.x - craftX > BLACK_HOLE.commitX) {
    const track = BLACK_HOLE.trackSpeed * vScale() * dt;
    const keep = worldHeight * BLACK_HOLE.edgeKeepOut;
    const target = Phaser.Math.Clamp(craftY, keep, worldHeight - keep);
    h.y += Phaser.Math.Clamp(target - h.y, -track, track);
  }
  h.core.setPosition(h.x, h.y);
  h.ring.setPosition(h.x, h.y);

  // A bounded function of age: rises over fadeIn, holds, falls over fadeOut.
  // It also fades out over its last `exitFade` px of travel, so once it has
  // passed the craft the pull eases off instead of cutting out at the edge.
  h.strength = Phaser.Math.Clamp(
    Math.min(
      h.age / fadeIn,
      (lifetime - h.age) / fadeOut,
      (h.x - BLACK_HOLE.exitX) / BLACK_HOLE.exitFade,
      h.collapseIn === null ? 1 : h.collapseIn / BLACK_HOLE.collapseSeconds,
    ),
    0,
    1,
  );

  // Eased so it swells open rather than popping, and a slow breathe while open
  // so it reads as alive. Both are bounded (sin of age).
  const eased = Phaser.Math.Easing.Cubic.Out(h.strength);
  const breathe = 1 + Math.sin(h.age * 2.4) * 0.03;
  h.core.setScale(scale * eased * breathe).setAlpha(eased);
  h.ring
    .setScale(scale * eased)
    .setAlpha(eased * 0.95)
    .setAngle(h.age * spinDegPerSec);
  return true;
}

/**
 * Velocity (px/s) the hole imparts on a point at (x, y), for a pull of `max`
 * inside `radius`. Zero outside the radius or while the hole is closed.
 */
export function pullAt(
  h: BlackHole,
  x: number,
  y: number,
  max: number,
  radius: number,
): { vx: number; vy: number; dist: number } {
  const k = vScale();
  const dx = h.x - x;
  const dy = (h.y - y) / k;
  const dist = Math.hypot(dx, dy);
  if (!h.active || dist >= radius || dist < 0.001) return { vx: 0, vy: 0, dist };

  const falloff = Math.pow(1 - dist / radius, BLACK_HOLE.falloffPower);
  const speed = max * falloff * h.strength;
  return { vx: (dx / dist) * speed, vy: (dy / dist) * speed * k, dist };
}

/** Reference-space distance from the hole's centre, matching `pullAt`. */
export function distanceTo(h: BlackHole, x: number, y: number): number {
  return Math.hypot(h.x - x, (h.y - y) / vScale());
}
