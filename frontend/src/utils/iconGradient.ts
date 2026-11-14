// src/utils/iconGradient.ts
/**
 * Gradient-filled icons.
 *
 * SVG cannot take a CSS `linear-gradient()` on `stroke` or `fill` — those
 * properties only accept a paint server, so a gradient has to be declared as an
 * SVG `<linearGradient>` and referenced by id (`url(#id)`). That means every
 * gradient icon needs three things kept in sync:
 *
 *   1. a UNIQUE dom id (several icons render per page; duplicate ids make every
 *      one of them resolve against whichever gradient parsed first),
 *   2. a hidden `<defs>` block carrying the gradient,
 *   3. `stroke`/`fill` styles pointing at that id.
 *
 * Getting any of them subtly wrong fails silently — the icon just renders black
 * or transparent. This module owns all three so callers can't get it wrong.
 *
 * Usage in an .astro file:
 *
 *   ---
 *   import { iconGradient } from "@/utils/iconGradient";
 *   import IconGradientDefs from "@/components/IconGradientDefs.astro";
 *   const grad = iconGradient("stat", label);
 *   ---
 *   <IconGradientDefs id={grad.id} />
 *   <Icon icon={icon} style={grad.style} />
 */
import { SimpleIdRegistry } from "./idRegistry";

/** The gradient presets available to icons, as [from, to] CSS custom props. */
export const ICON_GRADIENT_PRESETS = {
  /** Brand primary, light → dark. The default. */
  primary: ["var(--color-primary)", "var(--color-primary-700)"],
  /** Primary → accent, the showier pairing used by capability cards. */
  accent: ["var(--color-primary)", "var(--color-accent)"],
} as const;

export type IconGradientPreset = keyof typeof ICON_GRADIENT_PRESETS;

export interface IconGradient {
  /** The dom id of the `<linearGradient>` — pass to IconGradientDefs. */
  id: string;
  /** Gradient stops as [from, to]. */
  stops: readonly [string, string];
  /** Spread onto an `<Icon>`'s `style` prop. */
  style: { stroke: string; fill?: string };
}

/**
 * Registry shared by every call in a single build. `SimpleIdRegistry` returns
 * `base`, then `base-1`, `base-2`… so two stats that happen to produce the same
 * slug still get distinct ids.
 *
 * NOTE: this is module state and therefore per-build, not per-page. That's fine
 * — ids only need to be unique within a page, and being unique across the whole
 * build is strictly stronger. It does mean the numeric suffix depends on render
 * order, so don't rely on a specific id string anywhere.
 */
const registry = new SimpleIdRegistry();

/**
 * Build a unique gradient id plus the styles that reference it.
 *
 * @param scope  Short namespace for the call site, e.g. "stat" or "button".
 * @param hint   Optional extra distinguishing text (a label, a title) so ids
 *               stay readable in devtools. Slugified; anything non-alphanumeric
 *               collapses to a dash.
 * @param preset Which gradient to paint. Defaults to the brand primary ramp.
 */
export function iconGradient(
  scope: string,
  hint?: string | null,
  preset: IconGradientPreset = "primary",
  /**
   * Paint `fill` as well as `stroke`. OFF by default, and that default matters:
   * this project's icon set is stroke-drawn and declares `fill="none"` on the
   * <svg>. An inline `style.fill` OVERRIDES that attribute, so filling turns
   * every enclosed area into a solid gradient blob — an arrow grows filled
   * triangles. Only enable it for a genuinely solid-glyph icon.
   */
  paintFill = false,
): IconGradient {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const base = [
    "icon-gradient",
    slug(scope || "icon"),
    hint ? slug(String(hint)) : "",
  ]
    .filter(Boolean)
    .join("-");

  const id = registry.getUniqueId(base);
  const stops = ICON_GRADIENT_PRESETS[preset];

  return {
    id,
    stops,
    // Stroke only unless explicitly asked for a fill — see `paintFill`.
    style: paintFill
      ? { stroke: `url(#${id})`, fill: `url(#${id})` }
      : { stroke: `url(#${id})` },
  };
}
