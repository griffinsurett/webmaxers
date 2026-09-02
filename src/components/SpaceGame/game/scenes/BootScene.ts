// src/game/scenes/BootScene.ts
/**
 * First scene. Resolves the palette against the mount element, generates the
 * placeholder textures, then hands over to Title.
 *
 * Textures are DRAWN AT RUNTIME with Phaser.Graphics rather than loaded as
 * image files. For simple vector shapes this is the better trade: no network
 * requests, no spritesheet loader, no asset pipeline, and everything picks up
 * the site's live accent colour because it is drawn from the palette. When real
 * cartoon art arrives this is the one file that changes.
 */
import Phaser from "phaser";
import { getPalette, type Palette } from "../palette";

export const TEX = {
  player: "tex-player",
  saucer: "tex-saucer",
  shot: "tex-shot",
  star: "tex-star",
  box: "tex-box",
  soundOn: "tex-sound-on",
  soundOff: "tex-sound-off",
  grenadeIcon: "tex-grenade-icon",
  shieldIcon: "tex-shield-icon",
} as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const palette = getPalette(this.game.canvas.parentElement as HTMLElement);
    this.makeTextures(palette);
    this.scene.start("Title");
  }

  /** Draw each sprite once into a texture Phaser can reuse cheaply. */
  private makeTextures(p: Palette) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // ── Player craft: a blunt arrowhead pointing right ────────────────────
    // Deliberately readable as "human/ours" — angular, accent-coloured, in
    // contrast to the aliens' soft green discs.
    g.clear();
    g.fillStyle(p.int.player, 1);
    g.beginPath();
    g.moveTo(0, 12);
    g.lineTo(36, 20);
    g.lineTo(0, 28);
    g.lineTo(8, 20);
    g.closePath();
    g.fillPath();
    // Cockpit highlight.
    g.fillStyle(p.int.shot, 1);
    g.fillCircle(12, 20, 3);
    g.generateTexture(TEX.player, 40, 40);

    // ── Saucer: classic disc + dome, alien green ──────────────────────────
    g.clear();
    g.fillStyle(p.int.alienDim, 1);
    g.fillEllipse(20, 22, 36, 12);      // hull
    g.fillStyle(p.int.alien, 1);
    g.fillEllipse(20, 17, 20, 14);      // dome
    g.fillStyle(p.int.shot, 0.9);
    g.fillCircle(20, 15, 2.5);          // dome glint
    g.generateTexture(TEX.saucer, 40, 32);

    // ── Shot: a short bright capsule ──────────────────────────────────────
    g.clear();
    g.fillStyle(p.int.shot, 1);
    g.fillRoundedRect(0, 0, 12, 4, 2);
    g.generateTexture(TEX.shot, 12, 4);

    // ── Star: 2x2 dot, tinted per-instance for depth ──────────────────────
    g.clear();
    g.fillStyle(p.int.star, 1);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture(TEX.star, 2, 2);

    // ── Mystery box: a crate with a "?" ───────────────────────────────────
    // Neutral yellow, so it reads as neither friend (accent) nor foe (green) —
    // it is a thing to decide about.
    g.clear();
    g.fillStyle(0xfacc15, 1);
    g.fillRoundedRect(2, 2, 30, 30, 5);
    g.lineStyle(2, 0x000000, 0.35);
    g.strokeRoundedRect(2, 2, 30, 30, 5);
    // A blocky "?" drawn from rects — a font glyph would need a loaded font.
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(12, 9, 10, 3);
    g.fillRect(19, 12, 3, 5);
    g.fillRect(15, 17, 7, 3);
    g.fillRect(15, 20, 3, 3);
    g.fillRect(15, 25, 3, 3);
    g.generateTexture(TEX.box, 34, 34);

    // ── HUD icons ─────────────────────────────────────────────────────────
    // Grenade: a filled circle with a fuse.
    g.clear();
    g.fillStyle(p.int.danger, 1);
    g.fillCircle(11, 13, 8);
    g.fillStyle(0xfacc15, 1);
    g.fillRect(10, 2, 2, 5);
    g.generateTexture(TEX.grenadeIcon, 22, 22);

    // Shield: a rounded chevron outline.
    g.clear();
    g.lineStyle(2.5, p.int.player, 1);
    g.beginPath();
    g.moveTo(11, 2);
    g.lineTo(20, 6);
    g.lineTo(20, 12);
    g.lineTo(11, 20);
    g.lineTo(2, 12);
    g.lineTo(2, 6);
    g.closePath();
    g.strokePath();
    g.generateTexture(TEX.shieldIcon, 22, 22);

    // ── Speaker icons ─────────────────────────────────────────────────────
    // Drawn as textures rather than using 🔊/🔇: emoji render as COLOUR glyphs
    // through the WebGL text pipeline and came out as an unreadable red blob.
    // A drawn icon also matches the rest of the HUD's flat vector look and
    // tints with the palette.
    //
    // Shared body: a small square plus a triangular horn, pointing right.
    const speakerBody = (gg: Phaser.GameObjects.Graphics) => {
      gg.fillStyle(0xffffff, 1);
      gg.fillRect(2, 8, 5, 8);          // the driver
      gg.beginPath();                    // the cone
      gg.moveTo(7, 8);
      gg.lineTo(13, 2);
      gg.lineTo(13, 22);
      gg.lineTo(7, 16);
      gg.closePath();
      gg.fillPath();
    };

    // SOUND ON: speaker plus two arcs, drawn as tapering bars so they read at
    // 24px without anti-aliasing mush.
    g.clear();
    speakerBody(g);
    g.fillStyle(0xffffff, 1);
    g.fillRect(16, 9, 2, 6);
    g.fillRect(20, 6, 2, 12);
    g.generateTexture(TEX.soundOn, 24, 24);

    // SOUND OFF: the same speaker with a cross, so the two icons differ by more
    // than the presence of small marks (which is hard to read at a glance).
    g.clear();
    speakerBody(g);
    g.lineStyle(2.5, 0xffffff, 1);
    g.beginPath();
    g.moveTo(16, 8);
    g.lineTo(23, 16);
    g.moveTo(23, 8);
    g.lineTo(16, 16);
    g.strokePath();
    g.generateTexture(TEX.soundOff, 26, 24);

    g.destroy();
  }
}
