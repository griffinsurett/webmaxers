// src/game/scenes/HowToScene.ts
/**
 * The directions screen, reachable from the title.
 *
 * Exists because this game has three mechanics a player cannot discover by
 * pressing buttons — heat, the escape penalty, and the combo multiplier. A
 * shooter where holding fire is *wrong* is unusual enough that discovering it by
 * failing is annoying rather than interesting.
 *
 * Structured as three columns (controls / rules / items) rather than a wall of
 * prose: this is a reference someone scans for ten seconds before playing, not
 * something they read.
 *
 * Content lives in `SECTIONS` below so it can be reworded without touching
 * layout, and every number is pulled from tuning so the screen cannot drift out
 * of sync with the game it describes.
 */
import Phaser from "phaser";
import { getPalette } from "../palette";
import { TEX } from "./BootScene";
import { createStarfield, updateStarfield, type Star } from "./starfield";
import {
  PLAYER, SCORING, SAUCERS, GRENADE, SHIELD, isRotated,
} from "../tuning";
import { uiFrame, uprightScene, isTouch } from "../uiFrame";

export class HowToScene extends Phaser.Scene {
  private stars: Star[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super("HowTo");
  }

  create() {
    const { width, height } = uiFrame(this);
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);
    const cx = width / 2;

    this.leaving = false;
    this.cameras.main.setBackgroundColor(p.int.bg);
    this.stars = createStarfield(this);

    this.add
      .text(cx, 54, "HOW TO PLAY", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "44px",
        fontStyle: "bold",
        color: p.css.heading,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);

    // Objective, stated once and prominently — it is the only thing on this
    // screen the player strictly needs.
    this.add
      .text(
        cx,
        112,
        `Score ${SCORING.winTarget} in ${SCORING.timeLimit} seconds to win a discount.`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "19px",
          color: p.css.player,
        },
      )
      .setOrigin(0.5);

    // ── Column placement ──────────────────────────────────────────────────
    // Three side-by-side columns need ~1000px of width. Portrait has 620, so
    // they overlap into an unreadable pile. There the columns STACK instead:
    // full width, one under the other.
    //
    // `column()` returns its own height, so each stacked column starts where
    // the last one ended rather than at a guessed offset — the three blocks
    // have very different lengths and fixed spacing would either collide or
    // leave a gap.
    const stacked = isRotated();
    const colY = 168;
    const colW = stacked ? Math.min(width - 56, 520) : 340;
    const touch = isTouch();
    const COL_FRACTIONS = [0.22, 0.5, 0.78];
    let stackY = colY;

    /**
     * Place column `i`. Side by side in landscape, stacked in portrait.
     *
     * Stacked columns advance a shared cursor by each column's measured height,
     * so blocks of different lengths butt up against each other cleanly.
     */
    const place = (
      i: number,
      heading: string,
      rows: readonly (readonly [string, string])[],
    ) => {
      const x = stacked ? width / 2 : width * COL_FRACTIONS[i]!;
      const y = stacked ? stackY : colY;
      const used = this.column(x, y, colW, heading, rows, p);
      if (stacked) stackY += used + 26;
    };

    place(0, "CONTROLS", touch
      ? [
          ["Tilt the device", "Fly up and down"],
          ["Tap anywhere", "Fire"],
          ["Tap the grenade icon", "Throw grenade"],
          ["Tap the shield icon", "Raise shield"],
          ["❙❙ top right", "Pause"],
        ]
      : [
          ["↑ ↓  or  W S", "Fly up and down"],
          ["SPACE / click", "Fire"],
          ["Q", "Throw grenade"],
          ["E", "Raise shield"],
          ["ESC / P", "Pause"],
        ]);

    place(1, "THE RULES", [
      [
        "Burst, don't hold",
        `Firing builds heat. Hold the trigger and you overheat for ${PLAYER.overheatSeconds}s — then you must release and press again.`,
      ],
      [
        "Let none past",
        `A saucer that reaches the left edge costs up to ${SAUCERS.diver.escapePenalty} points — more than killing it was worth.`,
      ],
      [
        "Build a combo",
        `Every kill raises your multiplier up to ${SCORING.comboMax}x. One escape resets it to 1x.`,
      ],
      [
        "Missed shots cost",
        `Every shot that hits nothing is -${PLAYER.missPenalty}.`,
      ],
    ]);

    place(2, "MYSTERY BOXES", [
      [
        "Grenade",
        `Thrown ahead of you, detonating on impact. Clears saucers within ${GRENADE.radius}px.`,
      ],
      [
        "Shield",
        `${SHIELD.seconds}s of invulnerability. Fires only when you choose.`,
      ],
      [
        "Grab the ? crates",
        "You cannot see which item a box holds until you take it.",
      ],
    ]);

    // Show the actual sprites, so the player recognises them in play rather than
    // meeting them for the first time under fire.
    // In portrait the stacked columns are much taller than the side-by-side
    // layout, so anchoring these to the frame's bottom would leave a large gap
    // or overlap the last column. Follow the cursor instead.
    const legendY = stacked ? stackY + 12 : height - 118;
    this.legend(width * 0.34, legendY, TEX.player, "You", p);
    this.legend(width * 0.46, legendY, TEX.saucer, "Saucer", p);
    this.legend(width * 0.58, legendY, TEX.box, "Mystery box", p);

    this.prompt = this.add
      .text(cx, stacked ? legendY + 92 : height - 52, touch ? "TAP TO LAUNCH" : "PRESS SPACE TO LAUNCH    •    ESC TO GO BACK", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: p.css.player,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);

    // BACK as a real target. ESC is unreachable on a phone, and without this
    // the directions screen is a dead end on touch.
    const back = this.add
      .text(28, 28, "‹  BACK", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: p.css.text,
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => back.setColor(p.css.heading))
      .on("pointerout", () => back.setColor(p.css.text));

    back.on(
      "pointerup",
      (
        _ptr: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        // Stop the scene-wide "tap to launch" from also firing.
        event.stopPropagation();
        this.go("Title");
      },
    );

    const kb = this.input.keyboard!;
    kb.once("keydown-SPACE", () => this.go("Play"));
    kb.once("keydown-ENTER", () => this.go("Play"));
    kb.once("keydown-ESC", () => this.go("Title"));
    this.input.once("pointerdown", () => this.go("Play"));

    // Portrait rotates the canvas in CSS, which would lay this screen's copy on
    // its side. Undo it. Last statement in create(): it sweeps the display
    // list, so anything added after this point would be left sideways.
    //
    // `flip` because this screen's layout is not a single top-down stack — the
    // columns advance their own cursors and the legend and prompt anchor to the
    // bottom — so pre-inverting each Y at the call site (as TitleScene does)
    // would take a dozen edits and break the columns' internal spacing.
    // Flipping once, after everything is placed, preserves every relationship.
    uprightScene(this, { flipY: true });
  }

  /** One titled column of label/description pairs. */
  private column(
    x: number,
    y: number,
    w: number,
    heading: string,
    rows: readonly (readonly [string, string])[],
    p: ReturnType<typeof getPalette>,
  ): number {
    this.add
      .text(x, y, heading, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: p.css.text,
      })
      .setOrigin(0.5, 0)
      .setLetterSpacing(3)
      .setAlpha(0.75);

    let cursor = y + 30;
    for (const [label, desc] of rows) {
      const l = this.add
        .text(x, cursor, label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "17px",
          fontStyle: "bold",
          color: p.css.heading,
        })
        .setOrigin(0.5, 0);
      cursor += l.height + 2;

      const d = this.add
        .text(x, cursor, desc, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          color: p.css.text,
          align: "center",
          wordWrap: { width: w },
          lineSpacing: 3,
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.8);
      cursor += d.height + 16;
    }

    // The height consumed, so a stacked caller knows where the next column
    // starts. Ignored by the side-by-side layout.
    return cursor - y;
  }

  /** A sprite plus its name, so the player can recognise it in play. */
  private legend(
    x: number,
    y: number,
    tex: string,
    label: string,
    p: ReturnType<typeof getPalette>,
  ) {
    this.add.image(x, y, tex).setScale(1.2);
    this.add
      .text(x, y + 26, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: p.css.text,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.7);
  }

  private go(scene: string) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(scene));
  }

  update(time: number, delta: number) {
    updateStarfield(this, this.stars, delta / 1000);
    // Bounded pulse — sin of time, never accumulated (HANDOFF §4).
    this.prompt.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin((time / 1000) * 3)));
  }
}
