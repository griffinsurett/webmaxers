/**
 * Scroll Animation Props Utilities
 *
 * This file combines both CSS-only and JavaScript-observed animation prop helpers.
 * Choose the appropriate system based on your needs:
 *
 * - CSS-only: Zero JavaScript, better performance, modern browsers only
 * - JS-observed: Broader compatibility, interactive features
 *
 * See README.md for detailed usage and when to use each system.
 */

/* ═══════════════════════════════════════════════════════════════════ */
/* CSS-ONLY ANIMATION PROPS (Zero JavaScript Required)                 */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * CSS-only animations use modern CSS scroll-driven animations with animation-timeline: view()
 * Browser support: Chrome 115+, Edge 115+, Safari 17.5+ (2024)
 * Fallback: Elements appear immediately without animation
 *
 * Usage:
 * ```astro
 * import { cssAnimationProps } from "@/integrations/scroll-animations/props";
 * <div {...cssAnimationProps("fade-in-up")}>Content</div>
 * ```
 */

export type CSSAnimationType =
  | "fade-in"
  | "fade-in-up"
  | "fade-in-down"
  | "fade-in-left"
  | "fade-in-right"
  | "fade-in-scale"
  | "scale-in"
  | "pop-in"
  | "zoom-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right";

export type AnimationRange = "default" | "delayed" | "cover" | "cover-fast" | "contain" | "exit";

export interface CSSAnimationOptions {
  /**
   * Animation range preset
   * - default: Triggers on entry (0% to 30%)
   * - delayed: Triggers when 20% into viewport (20% to 50%)
   * - cover: Animates across entire viewport journey (0% to 100%)
   * - contain: Only animates when fully visible
   * - exit: Animates when leaving viewport
   */
  range?: AnimationRange;

  /**
   * Custom animation range start and end
   * Overrides the range preset if provided
   * Examples: "entry 0%", "cover 50%", "contain 25%"
   */
  customRangeStart?: string;
  customRangeEnd?: string;
}

interface CSSAnimationDataAttributes {
  "data-animate-css": CSSAnimationType;
  "data-animate-range"?: AnimationRange;
  style?: {
    "--animation-range-start"?: string;
    "--animation-range-end"?: string;
  };
}

/**
 * Generate CSS-only animation data attributes for an element
 * No JavaScript required - works purely with modern CSS
 */
export function cssAnimationProps(
  animation: CSSAnimationType,
  options: CSSAnimationOptions = {}
): CSSAnimationDataAttributes {
  const { range = "default", customRangeStart, customRangeEnd } = options;

  const attrs: CSSAnimationDataAttributes = {
    "data-animate-css": animation,
  };

  if (range !== "default") {
    attrs["data-animate-range"] = range;
  }

  if (customRangeStart || customRangeEnd) {
    attrs.style = {};
    if (customRangeStart) {
      attrs.style["--animation-range-start"] = customRangeStart;
    }
    if (customRangeEnd) {
      attrs.style["--animation-range-end"] = customRangeEnd;
    }
  }

  return attrs;
}

/**
 * Generate staggered CSS-only animation props for a list of items
 */
export function staggeredCSSAnimationProps(
  animation: CSSAnimationType,
  index: number,
  options: CSSAnimationOptions & { staggerPercent?: number } = {}
): CSSAnimationDataAttributes {
  const { staggerPercent = 5, customRangeStart, customRangeEnd, ...rest } = options;

  const baseStart = customRangeStart || "entry 0%";
  const baseEnd = customRangeEnd || "entry 30%";

  const startMatch = baseStart.match(/(\d+)%/);
  const endMatch = baseEnd.match(/(\d+)%/);

  if (startMatch && endMatch) {
    const startPercent = parseInt(startMatch[1], 10);
    const endPercent = parseInt(endMatch[1], 10);
    const rangeType = baseStart.split(" ")[0];

    return cssAnimationProps(animation, {
      ...rest,
      customRangeStart: `${rangeType} ${startPercent + index * staggerPercent}%`,
      customRangeEnd: `${rangeType} ${endPercent + index * staggerPercent}%`,
    });
  }

  return cssAnimationProps(animation, rest);
}

/* ═══════════════════════════════════════════════════════════════════ */
/* JAVASCRIPT-OBSERVED ANIMATION PROPS                                  */
/* ═══════════════════════════════════════════════════════════════════ */

/**
 * JavaScript-observed animations use IntersectionObserver to detect viewport visibility
 * Browser support: All modern browsers (Chrome 51+, Safari 12.1+, Firefox 55+)
 * Requires: JavaScript enabled and scroll-animations script loaded
 *
 * Usage:
 * ```astro
 * import { animationProps } from "@/integrations/scroll-animations/props";
 * <div {...animationProps("fade-in-up", { once: true, delay: 200 })}>Content</div>
 * ```
 */

type CSSProperties = Record<string, string | number>;

export type AnimationType =
  | "fade-in"
  | "fade-in-up"
  | "fade-in-down"
  | "fade-in-left"
  | "fade-in-right"
  | "fade-in-scale"
  | "letter-reveal"
  | "scale-in"
  | "pop-in"
  | "zoom-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "color-text-fade";

export interface AnimationOptions {
  /** Only animate once (default: true) */
  once?: boolean;
  /** Delay in milliseconds before animation starts */
  delay?: number;
  /** Custom duration in milliseconds */
  duration?: number;
  /** Custom IntersectionObserver threshold (0-1) */
  threshold?: number;
  /** Custom IntersectionObserver rootMargin (e.g., "-10% 0px -20% 0px") */
  rootMargin?: string;
  /** Enable direction-aware exit animations (default: false) */
  directional?: boolean;
}

interface AnimationDataAttributes {
  "data-animate": AnimationType;
  "data-animate-once"?: string;
  "data-animate-delay"?: string;
  "data-animate-threshold"?: string;
  "data-animate-root-margin"?: string;
  "data-animate-directional"?: string;
  style?: CSSProperties;
}

/**
 * Generate animation data attributes for an element
 */
export function animationProps(
  animation: AnimationType,
  options: AnimationOptions = {}
): AnimationDataAttributes {
  const { once = true, delay, duration, threshold, rootMargin, directional } = options;

  const attrs: AnimationDataAttributes = {
    "data-animate": animation,
  };

  if (once) {
    attrs["data-animate-once"] = "true";
  }

  if (threshold !== undefined) {
    attrs["data-animate-threshold"] = String(threshold);
  }

  if (rootMargin !== undefined) {
    attrs["data-animate-root-margin"] = rootMargin;
  }

  if (directional) {
    attrs["data-animate-directional"] = "true";
  }

  if (delay !== undefined || duration !== undefined) {
    const style: Record<string, string> = {};
    if (delay !== undefined) {
      attrs["data-animate-delay"] = String(delay);
      style["--animation-delay"] = `${delay}ms`;
    }
    if (duration !== undefined) {
      style["--animation-duration"] = `${duration}ms`;
    }
    attrs.style = style as CSSProperties;
  }

  return attrs;
}

/**
 * Generate staggered animation props for a list of items
 */
export function staggeredAnimationProps(
  animation: AnimationType,
  index: number,
  options: AnimationOptions & { staggerDelay?: number } = {}
): AnimationDataAttributes {
  const { staggerDelay = 300, delay = 0, ...rest } = options;
  return animationProps(animation, {
    ...rest,
    delay: delay + index * staggerDelay,
  });
}
