// src/game/config.ts
/**
 * The Phaser game config. Kept separate from index.ts so the boundary file has
 * no Phaser types in its signature — that is what lets the host import
 * mountGame() without pulling Phaser into its static graph.
 */
import Phaser from "phaser";
import type { MountOptions } from "./index";
import { getPalette } from "./palette";
import { GameAudio } from "./audio";
import { WORLD, setWorldHeight, getWorldHeight, setRotated } from "./tuning";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { HowToScene } from "./scenes/HowToScene";
import { PlayScene } from "./scenes/PlayScene";
import { GameOverScene } from "./scenes/GameOverScene";

/**
 * Derive the world height from the container's shape, clamped, and publish it to
 * tuning.ts so every vertical quantity scales against it.
 *
 * Measured from the container rather than the window: once embedded in the host
 * site the game may not occupy the whole viewport.
 */
function worldHeightFor(el: HTMLElement): number {
  // ── Rotation: which layout this run uses ────────────────────────────────
  // The touch layout puts the player at the BOTTOM shooting up, with saucers
  // descending. Rather than teaching every entity about a second axis — which
  // would invalidate every balance number and every collision test — the world
  // stays a horizontal shooter and the CANVAS is rotated 90° in CSS.
  //
  // `pointer: coarse` picks out handhelds (so a large tablet is treated as one
  // rather than as a small desktop), and `orientation: portrait` is required
  // alongside it: the quarter turn only yields a sensible playfield when the
  // screen's long axis is vertical. A device held sideways would otherwise get
  // a 1280x2770 world — a field twice as tall as it is wide.
  const rotated =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse) and (orientation: portrait)").matches;
  setRotated(rotated);

  // Stamp the decision, and let CSS key off THAT rather than re-evaluating the
  // media query itself.
  //
  // This is what locks the layout for the run. A media query is live: turning
  // the phone mid-game flipped the CSS to the unrotated rules while the world
  // height — fixed below, once — stayed as it was. The two disagreed and the
  // canvas collapsed to 390x180 with the game still running inside it.
  // Measured, not theorised.
  //
  // Locking also matters for play. The tilt axis, the HUD corners and the
  // craft's position all follow this, so switching mid-run would hand the
  // player different controls halfway through a timed round. Whichever way the
  // device is held at launch is the layout they keep.
  el.setAttribute("data-rotated", rotated ? "true" : "false");

  // Measure AFTER stamping. The attribute drives the element's own sizing
  // rules, so reading the box first samples the pre-layout shape — that is what
  // gave a 4:3 tablet a world height of 983 instead of 960, stretching every
  // sprite by 2%.
  const r = el.getBoundingClientRect();
  const w = r.width || window.innerWidth || WORLD.width;
  const h = r.height || window.innerHeight || WORLD.refHeight;

  // When rotated, the world's "width" runs DOWN the screen, so the aspect ratio
  // that derives the world height is inverted: the game is authored as h/w but
  // presented as w/h. This must match the canvas's CSS box exactly (game.css
  // sizes it `width: 100dvh; height: 100vw`) or every sprite is stretched.
  const aspect = rotated ? w / h : h / w;
  setWorldHeight(WORLD.width * aspect);
  return getWorldHeight();
}

export function createConfig(
  el: HTMLElement,
  opts: MountOptions,
): Phaser.Types.Core.GameConfig {
  const palette = getPalette(el);

  return {
    // MountOptions are put on the registry in a `callbacks.preBoot` hook below,
    // so every scene can reach them (`this.registry.get("opts")`) without any
    // scene importing the host or the boundary file.
    callbacks: {
      preBoot: (game) => {
        game.registry.set("opts", opts);
        // ONE audio instance for the whole game, shared via the registry so
        // every scene mutes together and only one AudioContext is ever created.
        game.registry.set("audio", new GameAudio(opts.muted === true));
      },
    },

    type: Phaser.AUTO,
    parent: el,
    backgroundColor: palette.int.bg,

    scale: {
      // The world is always WORLD.width wide; its HEIGHT is derived from the
      // container's aspect ratio (see tuning.ts). That is what lets a portrait
      // phone fill its screen instead of letterboxing to a ~220px strip, while
      // saucers still cross the same horizontal distance everywhere.
      //
      // FIT + CENTER_BOTH then scales that world to the container. Because the
      // world's aspect already matches the container's, "fit" is close to an
      // exact fill and the letterboxing is negligible.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD.width,
      height: worldHeightFor(el),
    },

    // NOTE on device pixel ratio: Phaser 3 has no `resolution` config key (it
    // was removed during v3 development). The Scale manager's FIT mode already
    // renders at the fixed 1280x720 backing size above and CSS-scales it, which
    // caps the real cost regardless of DPR — the same effect StarfieldCanvas
    // gets on the host by clamping DPR to 2.

    physics: {
      default: "arcade",
      arcade: {
        // Top-down space: nothing falls.
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },

    // Phaser's audio system is disabled outright: all sound is synthesised in
    // `audio.ts` with raw Web Audio, so Phaser has nothing to manage. This is
    // NOT the mute control — muting is handled by GameAudio's master gain, so
    // it can be toggled at runtime.
    audio: { noAudio: true },

    // Phaser's loop is already delta-correct; forceSetTimeOut would break that.
    fps: { target: 60, forceSetTimeOut: false },

    scene: [BootScene, TitleScene, HowToScene, PlayScene, GameOverScene],
  };
}
