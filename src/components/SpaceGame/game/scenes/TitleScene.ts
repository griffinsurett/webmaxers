// src/game/scenes/TitleScene.ts
/**
 * The start screen. Shows the title over the same drifting starfield the game
 * is played in, plus a saucer or two so the threat is established before the
 * player presses anything.
 *
 * Starting the game requires a DELIBERATE action — Space/Enter or a click. It
 * deliberately does not start on any keypress: a player who is still reading
 * should not be dropped into a shooter by pressing an arrow key.
 */
import Phaser from "phaser";
import { getPalette } from "../palette";
import type { GameAudio } from "../audio";
import { TEX } from "./BootScene";
import { createStarfield, updateStarfield, type Star } from "./starfield";
import { reportPhase } from "./phase";
import { SCORING } from "../tuning";
import { TiltInput } from "../tilt";
import { uiFrame, uiRow, uprightScene, isTouch } from "../uiFrame";

/** Text content lives here so it is trivial to reword later. */
const COPY = {
  eyebrow: "WEBM@XXERS PRESENTS",
  title: "SAUCER\nDEFENDER",
  tagline: "A green armada is jamming the website.\nYou are the last line of defence.",
  start: "PRESS SPACE TO LAUNCH",
  startTouch: "TAP TO LAUNCH",
  howTo: "H — HOW TO PLAY",
  howToTouch: "HOW TO PLAY",
  hint: "↑ ↓ or W S to fly    •    SPACE to fire in BURSTS    •    ESC to pause",
  hintTouch: "TILT to fly    •    tap to fire in BURSTS    •    ❙❙ to pause",
} as const;

/**
 * Peak vertical excursion of the decorative saucer bob, px.
 *
 * Sized to roughly match what the old accumulating version happened to settle
 * at, so the screen looks the same — it is the frame-rate dependence that was
 * the bug, not the amount of movement.
 */
const BOB_AMPLITUDE = 12;

export class TitleScene extends Phaser.Scene {
  private stars: Star[] = [];
  /**
   * Decorative saucers, each with the Y it was created at. The bob oscillates
   * AROUND `baseY` rather than accumulating onto `y` — see update().
   */
  private saucers: { img: Phaser.GameObjects.Image; baseY: number }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private howToBtn!: Phaser.GameObjects.Text;
  /**
   * Guards the one-way exit from this screen. Reset in create(), NOT here:
   * a field initialiser runs once per page load, but this scene is re-entered
   * every time the player quits or replays. Left latched at `true` it made the
   * title screen a dead end — QUIT returned here and nothing could start a new
   * run (HANDOFF §4.3, the same trap PlayScene hit with its run state).
   */
  private started = false;

  constructor() {
    super("Title");
  }

  create() {
    const { width, height } = uiFrame(this);
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);

    // Re-entered on every QUIT and every replay — clear the exit guard, or the
    // launch handlers below are registered but can never fire. See the field.
    this.started = false;
    this.saucers = [];

    this.cameras.main.setBackgroundColor(p.int.bg);
    this.stars = createStarfield(this);
    this.decorSaucers(width, height, p.int.alien);

    const cx = width / 2;
    const touch = isTouch();

    // ── Vertical centring ─────────────────────────────────────────────────
    // The layout used hardcoded height fractions (0.2 → 0.93), which was
    // bottom-heavy: dead space above the eyebrow and the hint line clipped off
    // the bottom on short viewports (a landscape phone in particular).
    //
    // Instead the block's total height is summed from its own rows and the
    // stack is centred on that, so it sits in the middle of ANY viewport and the
    // spacing is expressed once, as gaps between rows, rather than as eight
    // magic numbers that have to be re-tuned together.
    const ROWS = [
      { h: 22, gap: 10 },  // eyebrow
      { h: 176, gap: 26 }, // title (two lines)
      { h: 56, gap: 26 },  // tagline
      { h: 24, gap: 8 },   // objective
      { h: 18, gap: 34 },  // rules line
      { h: 28, gap: 18 },  // start prompt
      { h: 20, gap: 22 },  // how-to
      { h: 16, gap: 0 },   // controls hint
    ];
    const stackH = ROWS.reduce((n, r) => n + r.h + r.gap, 0);
    let y = height / 2 - stackH / 2;
    /**
     * Advance the cursor and return the CENTRE y for row `i`.
     *
     * In portrait the result is flipped, because `uprightScene` mirrors the
     * scene vertically to undo the canvas rotation — without the pre-flip the
     * stack would render bottom-up, with the title beneath the hint line.
     */
    const row = (i: number) => {
      const centre = y + ROWS[i]!.h / 2;
      y += ROWS[i]!.h + ROWS[i]!.gap;
      return uiRow(this, centre);
    };

    this.add
      .text(cx, row(0), COPY.eyebrow, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: p.css.text,
      })
      .setOrigin(0.5)
      .setLetterSpacing(6);

    this.add
      .text(cx, row(1), COPY.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "88px",
        fontStyle: "bold",
        color: p.css.heading,
        align: "center",
        lineSpacing: -8,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, row(2), COPY.tagline, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: p.css.text,
        align: "center",
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    // State the objective explicitly. A score target the player does not know
    // about is just a number going up.
    this.add
      .text(
        cx,
        row(3),
        `${SCORING.winTarget} POINTS IN ${SCORING.timeLimit}s TO WIN A DISCOUNT`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "16px",
          color: p.css.text,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.9);

    this.add
      .text(
        cx,
        row(4),
        "Hold the trigger and your gun overheats — burst, aim, and never let one past",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          color: p.css.text,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.6);

    // The call to action, in the brand accent so it reads as "ours".
    this.prompt = this.add
      .text(cx, row(5), touch ? COPY.startTouch : COPY.start, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: p.css.player,
      })
      .setOrigin(0.5)
      .setLetterSpacing(3);

    // Directions entry. This game has three mechanics that cannot be discovered
    // by pressing buttons — heat, the escape penalty and the combo — so there
    // has to be somewhere to read them. Clickable as well as keyed, since a
    // touch player has no H key.
    this.howToBtn = this.add
      .text(cx, row(6), touch ? COPY.howToTouch : COPY.howTo, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: p.css.text,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2)
      .setAlpha(0.75)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () =>
        this.howToBtn.setColor(p.css.player).setAlpha(1),
      )
      .on("pointerout", () =>
        this.howToBtn.setColor(p.css.text).setAlpha(0.75),
      )
      // `pointerup`, and it stops propagation so the scene-wide "click to
      // launch" handler does not also fire and skip straight into the game.
      .on("pointerup", (
        _ptr: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.openHowTo();
      });

    this.add
      .text(cx, row(7), touch ? COPY.hintTouch : COPY.hint, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: p.css.text,
      })
      .setOrigin(0.5)
      .setAlpha(0.65);

    // ── Start input ───────────────────────────────────────────────────────
    // Specific keys only, not "any key" — see the class note.
    this.input.keyboard!.once("keydown-H", () => this.openHowTo());
    this.input.keyboard!.once("keydown-SPACE", () => this.launch());
    this.input.keyboard!.once("keydown-ENTER", () => this.launch());
    this.input.once("pointerdown", () => this.launch());

    reportPhase(this, "title");

    // Portrait rotates the canvas in CSS, which would lay this screen's copy on
    // its side. Undo it. Last statement in create(): it sweeps the display
    // list, so anything added after this point would be left sideways.
    uprightScene(this);
  }

  /** Two saucers hovering in the upper area, to set the scene. */
  private decorSaucers(width: number, height: number, tint: number) {
    const spots = [
      { x: width * 0.74, y: height * 0.3, s: 1.6 },
      { x: width * 0.85, y: height * 0.46, s: 1.1 },
    ];
    for (const spot of spots) {
      const img = this.add
        .image(spot.x, spot.y, TEX.saucer)
        .setScale(spot.s)
        .setTint(tint);
      this.saucers.push({ img, baseY: spot.y });
    }
  }

  private openHowTo() {
    if (this.started) return;
    this.started = true; // reuse the same guard: either way we are leaving
    this.audio.uiClick();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("HowTo");
    });
  }

  /** Shared instance from the registry — see config.ts. */
  private get audio(): GameAudio {
    return this.registry.get("audio") as GameAudio;
  }

  private async launch() {
    if (this.started) return;
    this.started = true;
    this.audio.uiClick();

    // iOS 13+ only shows the motion-permission prompt from inside a user
    // gesture, and this tap is the last one before gameplay. Requesting here
    // rather than in PlayScene is the difference between tilt working and
    // silently never being offered.
    //
    // The result is not checked: PlayScene re-reads availability and falls back
    // to drag steering on its own, so a denial costs nothing but a moment.
    if (isTouch()) {
      await new TiltInput().start().catch(() => false);
    }
    // Brief fade so the transition does not snap.
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("Play");
    });
  }

  update(time: number, delta: number) {
    updateStarfield(this, this.stars, delta / 1000);

    // Pulse the prompt and bob the saucers. Both are BOUNDED oscillations of
    // `time` inside sin(), ASSIGNED to the property rather than added to it.
    //
    // The bob used to read `s.y += sin(...) * 0.35`, which is the §4 trap in
    // miniature: `+=` makes the value a discrete integral of the sine, so the
    // saucers wandered ~30px off their marks and — with no `dt` — did it twice
    // as far on a 120Hz display as on a 60Hz one. Assigning around a stored
    // baseY is what makes the motion identical at any frame rate (HANDOFF §4).
    const t = time / 1000;
    this.prompt.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3)));

    this.saucers.forEach(({ img, baseY }, i) => {
      img.y = baseY + Math.sin(t * 1.4 + i * 2.1) * BOB_AMPLITUDE;
      img.setAngle(Math.sin(t * 0.9 + i) * 6);
    });
  }
}
