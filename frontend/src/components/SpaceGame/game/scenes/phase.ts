// src/game/scenes/phase.ts
/**
 * One helper so every scene reports its phase the same way.
 *
 * The host passes `onPhase` through MountOptions; `config.ts` puts the whole
 * options object on Phaser's registry at preBoot. Scenes therefore never import
 * the boundary file or anything host-specific — they just announce where the
 * game is, and the host decides whether it cares.
 */
import type Phaser from "phaser";
import type { GamePhase, MountOptions } from "../index";

export function reportPhase(scene: Phaser.Scene, phase: GamePhase) {
  const opts = scene.registry.get("opts") as MountOptions | undefined;
  opts?.onPhase?.(phase);
}
