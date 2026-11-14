/**
 * Scroll Animation Integration
 *
 * This integration provides two animation systems:
 * 1. CSS-only animations (zero JavaScript, modern browsers)
 * 2. JavaScript-observed animations (broader compatibility)
 *
 * See README.md for detailed documentation.
 */

// Re-export all animation prop helpers from the consolidated props file
export {
  // CSS-only animation exports
  cssAnimationProps,
  staggeredCSSAnimationProps,
  type CSSAnimationType,
  type AnimationRange,
  type CSSAnimationOptions,

  // JavaScript-observed animation exports
  animationProps,
  staggeredAnimationProps,
  type AnimationType,
  type AnimationOptions,
} from "./props";

// Re-export the observer initialization for use in Theme.astro
export { initScrollAnimations } from "./observer";

// Auto-initialize the observer when this module is imported
import "./observer";
