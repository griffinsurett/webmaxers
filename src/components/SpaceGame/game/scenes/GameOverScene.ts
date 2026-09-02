// src/game/scenes/GameOverScene.ts
/**
 * End of run — win or loss. Reports the result to the host via `onWin` (the
 * future reward hook) and offers a replay.
 *
 * Note it receives the result as scene DATA rather than reading anything from
 * PlayScene. That keeps runs isolated: nothing survives from the previous
 * playthrough except what was explicitly handed over (HANDOFF §4.3).
 */
import Phaser from "phaser";
import { getPalette } from "../palette";
import type { GameAudio } from "../audio";
import { createStarfield, updateStarfield, type Star } from "./starfield";
import type { GameResult, MountOptions } from "../index";
import { SCORING } from "../tuning";
import { uiFrame, uiRow, uprightScene, isTouch } from "../uiFrame";

interface OverData extends GameResult {
  won: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private stars: Star[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private restarting = false;

  constructor() {
    super("GameOver");
  }

  create(data: OverData) {
    const { width, height } = uiFrame(this);
    const p = getPalette(this.game.canvas.parentElement as HTMLElement);
    const cx = width / 2;

    this.restarting = false;
    this.cameras.main.setBackgroundColor(p.int.bg);
    this.stars = createStarfield(this);

    this.add
      .text(cx, uiRow(this, height * 0.28), data.won ? "EARTH IS SAFE" : "GAME OVER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "72px",
        fontStyle: "bold",
        color: data.won ? p.css.player : p.css.heading,
      })
      .setOrigin(0.5);

    // Naming the reason matters: a loss the player cannot explain is a loss they
    // cannot learn from, and "so close" is what makes them press replay.
    const timedOut = !data.won && data.timeLeft <= 0;
    const shortBy = SCORING.winTarget - data.score;
    const reason = data.won
      ? "The armada is scrap. The website loads again."
      : timedOut
        ? shortBy <= 1500
          ? `Out of time — ${shortBy} points short.`
          : "Out of time. The armada kept coming."
        : "Your craft is scrap. The saucers won this round.";

    this.add
      .text(
        cx,
        uiRow(this, height * 0.44),
        reason,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          color: p.css.text,
          align: "center",
        },
      )
      .setOrigin(0.5);

    const secs = (data.durationMs / 1000).toFixed(0);
    this.add
      .text(
        cx,
        uiRow(this, height * 0.58),
        `SCORE  ${data.score} / ${SCORING.winTarget}        SURVIVED  ${secs}s`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          fontStyle: "bold",
          color: p.css.heading,
        },
      )
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.prompt = this.add
      .text(
        cx,
        uiRow(this, height * 0.75),
        isTouch() ? "TAP TO FLY AGAIN" : "PRESS SPACE TO FLY AGAIN",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          fontStyle: "bold",
          color: p.css.player,
        },
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);

    // The reward hook. Deliberately the ONLY place a win leaves the game — when
    // a discount mechanic is added it attaches here and nowhere else.
    if (data.won) {
      const opts = this.registry.get("opts") as MountOptions | undefined;
      opts?.onWin?.({
        score: data.score,
        wave: data.wave,
        durationMs: data.durationMs,
        timeLeft: data.timeLeft,
      });
    }

    // A short delay before input is accepted, so the last frantic keypress of a
    // losing run cannot instantly skip this screen.
    this.time.delayedCall(500, () => {
      this.input.keyboard!.once("keydown-SPACE", () => this.replay());
      this.input.keyboard!.once("keydown-ENTER", () => this.replay());
      this.input.once("pointerdown", () => this.replay());
    });

    // Portrait rotates the canvas in CSS, which would lay this screen's copy on
    // its side. Undo it. Last statement in create(): it sweeps the display
    // list, so anything added after this point would be left sideways.
    uprightScene(this);
  }

  /** Shared instance from the registry — see config.ts. */
  private get audio(): GameAudio {
    return this.registry.get("audio") as GameAudio;
  }

  private replay() {
    if (this.restarting) return;
    this.restarting = true;
    this.audio.uiClick();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("Play");
    });
  }

  update(time: number, delta: number) {
    updateStarfield(this, this.stars, delta / 1000);
    // Bounded pulse — sin of time, never accumulated.
    const t = time / 1000;
    this.prompt.setAlpha(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3)));
  }
}
