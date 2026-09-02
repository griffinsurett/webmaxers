// src/game/entities/saucer.ts
/**
 * Saucer behaviour — movement patterns and firing decisions.
 *
 * Kept as free functions over a plain data record rather than a Phaser.Sprite
 * subclass: the saucers live in an object pool, and pooled entities are easier
 * to reason about when "reset to spawn state" is just overwriting fields.
 *
 * ── The one invariant that matters here ────────────────────────────────────
 * The weave is `sin(age * hz)` — time INSIDE a bounded function, with the
 * amplitude a constant. It is never `y += rate * dt` accumulated toward a
 * target, and never `time * rate` fed to a position. That distinction is what
 * keeps every saucer's path finite and reproducible no matter how long the tab
 * has been open (HANDOFF §4, and the 3D-logo post-mortem behind it).
 */
import Phaser from "phaser";
import { SAUCERS, vScale, type SaucerKind } from "../tuning";
import { TEX } from "../scenes/BootScene";

export interface Saucer {
  img: Phaser.GameObjects.Image;
  kind: SaucerKind;
  active: boolean;
  hp: number;
  /** Y it was spawned at — the weave oscillates around this, not around 0. */
  baseY: number;
  /** Seconds since this saucer spawned. Drives its own weave phase. */
  age: number;
  /** Per-saucer phase offset so a formation does not move in lockstep. */
  phase: number;
  /** Seconds until it may fire again. */
  fireIn: number;
}

/** Put a pooled saucer into play. */
export function spawnSaucer(
  s: Saucer,
  kind: SaucerKind,
  x: number,
  y: number,
  tint: number,
) {
  const def = SAUCERS[kind];
  s.kind = kind;
  s.active = true;
  s.hp = def.hp;
  s.baseY = y;
  s.age = 0;
  s.phase = Math.random() * Math.PI * 2;
  // Stagger the first shot so a wave does not volley the instant it appears.
  s.fireIn = def.fireRate > 0 ? 0.6 + Math.random() * 1.4 : Infinity;

  s.img.setTexture(TEX.saucer);
  s.img.setPosition(x, y);
  s.img.setScale(def.scale);
  s.img.setTint(tint);
  s.img.setVisible(true);
  s.img.setActive(true);
}

export function despawnSaucer(s: Saucer) {
  s.active = false;
  s.img.setVisible(false);
  s.img.setActive(false);
}

/**
 * Advance one saucer. Returns true if it wants to fire this frame.
 *
 * `playerY` is only used by the diver pattern; passing it always keeps the
 * signature uniform.
 */
export function updateSaucer(
  s: Saucer,
  dt: number,
  playerY: number,
  fireScale: number,
): boolean {
  const def = SAUCERS[s.kind];
  s.age += dt;

  // Horizontal: constant leftward drift for every pattern.
  s.img.x -= def.speed * dt;

  // ── Vertical ──────────────────────────────────────────────────────────
  // Every kind now closes on the player; they differ in HOW MUCH weave they
  // carry versus how hard they track. Two independent parts:
  //
  //   1. baseY drifts toward the player at a capped rate (the hunt)
  //   2. a bounded sine around that baseY (the character)
  //
  // Tracking moves baseY rather than y directly, so the weave stays centred on
  // the pursuit line instead of fighting it.
  // Vertical quantities scale with world height so pursuit and weave cover the
  // same PROPORTION of the field on every device (see tuning.ts).
  const k = vScale();
  const track = ((def as { trackSpeed?: number }).trackSpeed ?? 0) * k;
  if (track > 0) {
    const diff = playerY - s.baseY;
    s.baseY += Phaser.Math.Clamp(diff, -track * dt, track * dt);
  }

  if (def.weaveAmp > 0) {
    s.img.y =
      s.baseY +
      Math.sin(s.age * def.weaveHz * Math.PI * 2 + s.phase) * def.weaveAmp * k;
  } else {
    s.img.y = s.baseY;
  }

  // Bank slightly into vertical motion — a function of current offset, bounded.
  const lean = Phaser.Math.Clamp((s.img.y - s.baseY) / 60, -1, 1);
  s.img.setAngle(lean * 10);

  // Firing.
  const rate = def.fireRate * fireScale;
  if (rate <= 0) return false;
  s.fireIn -= dt;
  if (s.fireIn <= 0) {
    // Randomised interval around the nominal rate so volleys feel organic
    // rather than metronomic.
    s.fireIn = (1 / rate) * (0.7 + Math.random() * 0.6);
    return true;
  }
  return false;
}
