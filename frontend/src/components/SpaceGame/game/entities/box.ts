// src/game/entities/box.ts
/**
 * Mystery boxes — drifting crates that grant one item when collected.
 *
 * The contents are decided at SPAWN, not on pickup, so the roll cannot be
 * re-rolled by a lucky frame and the same box always holds the same thing. The
 * player just cannot see which until they take it.
 *
 * Bob is `sin(age * hz)` — time inside a bounded function (HANDOFF §4).
 */
import Phaser from "phaser";
import { BOX, vScale, type ItemKind } from "../tuning";
import { TEX } from "../scenes/BootScene";

export interface Box {
  img: Phaser.GameObjects.Image;
  active: boolean;
  /** Decided at spawn; hidden from the player until collected. */
  item: ItemKind;
  baseY: number;
  age: number;
  phase: number;
}

export function spawnBox(b: Box, x: number, y: number, item: ItemKind) {
  b.active = true;
  b.item = item;
  b.baseY = y;
  b.age = 0;
  b.phase = Math.random() * Math.PI * 2;
  b.img.setTexture(TEX.box);
  b.img.setPosition(x, y);
  b.img.setScale(BOX.scale);
  b.img.setVisible(true);
  b.img.setActive(true);
}

export function despawnBox(b: Box) {
  b.active = false;
  b.img.setVisible(false);
  b.img.setActive(false);
}

export function updateBox(b: Box, dt: number) {
  b.age += dt;
  b.img.x -= BOX.speed * dt;
  b.img.y =
    b.baseY +
    Math.sin(b.age * BOX.bobHz * Math.PI * 2 + b.phase) * BOX.bobAmp * vScale();
  // Slow tumble so it reads as an object, not a sprite. Bounded: setAngle takes
  // an absolute value, so this never accumulates.
  b.img.setAngle(Math.sin(b.age * 0.8 + b.phase) * 14);
}
