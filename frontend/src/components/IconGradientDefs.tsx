// src/components/IconGradientDefs.tsx
/**
 * React counterpart to IconGradientDefs.astro — see @/utils/iconGradient for why
 * SVG needs a <defs> + `url(#id)` reference instead of a CSS gradient.
 *
 * Why a separate React version: the Astro helper derives its id from a
 * build-time registry, which can't guarantee uniqueness for a component that
 * hydrates and may mount any number of times on the client. `useId()` is React's
 * own collision-free id, stable across SSR and hydration, so each mounted button
 * gets its own gradient.
 *
 *   const grad = useIconGradient();
 *   <IconGradientDefs {...grad.defsProps} />
 *   <Icon style={grad.style} />
 */
import { useId } from "react";
import {
  ICON_GRADIENT_PRESETS,
  type IconGradientPreset,
} from "@/utils/iconGradient";

/**
 * Hook form: returns the id, the `stroke`/`fill` style, and the props for the
 * <defs> element. Call it in the component that renders the icon.
 */
export function useIconGradient(
  preset: IconGradientPreset = "primary",
  /**
   * Paint `fill` as well as `stroke`. OFF by default — this project's icons are
   * stroke-drawn with `fill="none"` on the <svg>, and an inline `style.fill`
   * overrides that attribute, filling every enclosed area with a solid gradient
   * blob (an arrow sprouts filled triangles). Only enable for solid glyphs.
   */
  paintFill = false,
) {
  // useId() produces ids containing ':' (e.g. ":r0:"), which is legal in an HTML
  // id but NOT in a CSS/SVG url(#...) fragment selector — strip to a safe slug.
  const raw = useId();
  const id = `icon-gradient-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stops = ICON_GRADIENT_PRESETS[preset];

  return {
    id,
    stops,
    style: paintFill
      ? { stroke: `url(#${id})`, fill: `url(#${id})` }
      : { stroke: `url(#${id})` },
    defsProps: { id, stops },
  };
}

interface Props {
  id: string;
  stops?: readonly [string, string];
}

export default function IconGradientDefs({
  id,
  stops = ICON_GRADIENT_PRESETS.primary,
}: Props) {
  return (
    <svg className="absolute h-0 w-0 overflow-hidden" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="100%" stopColor={stops[1]} />
        </linearGradient>
      </defs>
    </svg>
  );
}
