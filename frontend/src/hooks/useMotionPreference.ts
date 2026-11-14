import { useSyncExternalStore } from "react";

const MOTION_ATTRIBUTE_FILTER: string[] = [
  "data-a11y-motion",
  "data-a11y-animations",
  "data-a11y-images",
];

/**
 * Read the current motion preference from system settings or accessibility controls.
 * Safe for SSR – falls back to `false` when window/document are unavailable.
 */
export function readMotionPreference(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  const systemPrefersReduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const userPrefersReduced =
    root.getAttribute("data-a11y-motion") === "reduced";
  const userPausedAnimations =
    root.getAttribute("data-a11y-animations") === "true";
  const userHidesImages =
    root.getAttribute("data-a11y-images") === "hide";

  return systemPrefersReduced || userPrefersReduced || userPausedAnimations || userHidesImages;
}

/**
 * Singleton Motion Preference Manager
 *
 * Instead of each component creating its own MutationObserver and mediaQuery listener,
 * this singleton manages a single set of listeners and notifies all subscribers.
 * This dramatically reduces overhead when many components need motion preference.
 */
class MotionPreferenceManager {
  private subscribers = new Set<() => void>();
  private currentValue: boolean = false;
  private initialized = false;
  private mediaQuery: MediaQueryList | null = null;
  private observer: MutationObserver | null = null;

  private init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    this.currentValue = readMotionPreference();

    // Single mediaQuery listener for all subscribers
    this.mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    this.mediaQuery?.addEventListener("change", this.handleChange);

    // Single MutationObserver for all subscribers
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName &&
          MOTION_ATTRIBUTE_FILTER.includes(mutation.attributeName)
        ) {
          this.handleChange();
          break;
        }
      }
    });

    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: MOTION_ATTRIBUTE_FILTER,
    });
  }

  private handleChange = () => {
    const newValue = readMotionPreference();
    if (newValue !== this.currentValue) {
      this.currentValue = newValue;
      this.notifySubscribers();
    }
  };

  private notifySubscribers() {
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch (e) {
        console.error("MotionPreferenceManager subscriber error:", e);
      }
    });
  }

  subscribe = (callback: () => void): (() => void) => {
    // Auto-initialize on first subscription
    this.init();
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  };

  getSnapshot = (): boolean => {
    // Ensure we're initialized before returning
    this.init();
    return this.currentValue;
  };

  getServerSnapshot = (): boolean => {
    return false; // SSR fallback
  };
}

// Singleton instance
const motionPreferenceManager = new MotionPreferenceManager();

/**
 * React hook that tracks whether motion/animation should be disabled.
 * Uses a singleton manager to share a single observer across all components.
 */
export function useMotionPreference(respect: boolean = true): boolean {
  const shouldDisableMotion = useSyncExternalStore(
    motionPreferenceManager.subscribe,
    motionPreferenceManager.getSnapshot,
    motionPreferenceManager.getServerSnapshot
  );

  return respect ? shouldDisableMotion : false;
}
