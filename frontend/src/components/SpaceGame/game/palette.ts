// src/game/palette.ts
/**
 * Bridges the CSS custom properties in styles/game.css to the numeric colours
 * Phaser needs (0xRRGGBB ints and '#rrggbb' strings).
 *
 * ── Why read from CSS at all ───────────────────────────────────────────────
 * The host site lets the user pick the brand accent, and that lands on
 * `--color-accent`. If the game hard-coded #5e76f6, the player's craft would
 * stop matching the site the moment anyone changed the accent. Reading the
 * computed value means the game inherits the live theme for free once ported,
 * with no build step and no duplicated palette.
 *
 * Resolved ONCE at mount, not per frame — getComputedStyle is a layout read and
 * has no business in a game loop. If the accent can change while the game is
 * open, call refresh() from the host on that event.
 */

const TOKENS = {
  bg: "--color-bg",
  bg2: "--color-bg2",
  bg3: "--color-bg3",
  heading: "--color-heading",
  text: "--color-text",
  alien: "--game-alien",
  alienDim: "--game-alien-dim",
  player: "--game-player",
  shot: "--game-shot",
  danger: "--game-danger",
  star: "--game-star",
} as const;

export type ColorName = keyof typeof TOKENS;

/** Fallbacks, used only if a token is missing (e.g. CSS failed to load). */
const FALLBACK: Record<ColorName, string> = {
  bg: "#080808",
  bg2: "#030303",
  bg3: "#18181b",
  heading: "#fafafa",
  text: "#e4e4e7",
  alien: "#4ade80",
  alienDim: "#16a34a",
  player: "#5e76f6",
  shot: "#e0e7ff",
  danger: "#f87171",
  star: "#ffffff",
};

/** '#rgb' | '#rrggbb' | 'rgb(r g b)' | 'rgb(r, g, b)'  →  0xRRGGBB */
function toInt(raw: string, fallback: string): number {
  const v = (raw || "").trim() || fallback;

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = hex[0]!, g = hex[1]!, b = hex[2]!;
      return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    }
    return parseInt(hex.slice(0, 6), 16);
  }

  // Browsers normalise most colour functions to rgb()/rgba() when computed.
  const nums = v.match(/[\d.]+/g);
  if (nums && nums.length >= 3) {
    const r = Math.round(Number(nums[0])) & 255;
    const g = Math.round(Number(nums[1])) & 255;
    const b = Math.round(Number(nums[2])) & 255;
    return (r << 16) | (g << 8) | b;
  }

  return parseInt(fallback.slice(1), 16);
}

export interface Palette {
  /** 0xRRGGBB — what Phaser's tint/fill APIs want. */
  int: Record<ColorName, number>;
  /** '#rrggbb' — what Phaser's text styles and CSS want. */
  css: Record<ColorName, string>;
}

function build(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const int = {} as Record<ColorName, number>;
  const css = {} as Record<ColorName, string>;

  for (const name of Object.keys(TOKENS) as ColorName[]) {
    const raw = cs.getPropertyValue(TOKENS[name]);
    const n = toInt(raw, FALLBACK[name]);
    int[name] = n;
    css[name] = `#${n.toString(16).padStart(6, "0")}`;
  }

  return { int, css };
}

let cached: Palette | null = null;

/** Resolve the palette against `el`. Cached; call refresh() to re-read. */
export function getPalette(el: HTMLElement): Palette {
  if (!cached) cached = build(el);
  return cached;
}

/** Re-read the tokens — use if the host's theme/accent changes while mounted. */
export function refreshPalette(el: HTMLElement): Palette {
  cached = build(el);
  return cached;
}
