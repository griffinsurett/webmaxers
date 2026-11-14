/**
 * Scroll Event Bus - Singleton for consolidated scroll/wheel event handling
 *
 * Instead of multiple components adding their own scroll/wheel listeners,
 * this single bus handles all scroll events and notifies subscribers.
 * This dramatically reduces Total Blocking Time (TBT) by eliminating
 * duplicate event listener overhead.
 */

export type ScrollDirection = "up" | "down";
export type ScrollSource = "scroll" | "wheel";

export interface ScrollEventPayload {
  direction: ScrollDirection;
  scrollY: number;
  deltaY: number;
  source: ScrollSource;
  timestamp: number;
}

type ScrollSubscriber = (payload: ScrollEventPayload) => void;

class ScrollEventBus {
  private subscribers = new Set<ScrollSubscriber>();
  private lastScrollY = 0;
  private lastDirection: ScrollDirection = "down";
  private initialized = false;
  private rafId: number | null = null;
  private pendingUpdate = false;

  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Defer initial scrollY read to avoid forced reflow during page load
    this.lastScrollY = 0;

    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("wheel", this.handleWheel, { passive: true });
  }

  private handleScroll = () => {
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;

    // Batch scroll events with rAF to reduce main thread blocking
    this.rafId = requestAnimationFrame(() => {
      this.pendingUpdate = false;
      const currentScrollY = window.scrollY;
      const deltaY = currentScrollY - this.lastScrollY;

      if (deltaY === 0) return;

      this.lastDirection = deltaY > 0 ? "down" : "up";
      this.lastScrollY = currentScrollY;

      this.notify({
        direction: this.lastDirection,
        scrollY: currentScrollY,
        deltaY,
        source: "scroll",
        timestamp: performance.now(),
      });
    });
  };

  private handleWheel = (event: WheelEvent) => {
    if (event.deltaY === 0) return;

    const direction: ScrollDirection = event.deltaY > 0 ? "down" : "up";
    this.lastDirection = direction;

    this.notify({
      direction,
      scrollY: window.scrollY,
      deltaY: event.deltaY,
      source: "wheel",
      timestamp: performance.now(),
    });
  };

  private notify(payload: ScrollEventPayload) {
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(payload);
      } catch (e) {
        // Prevent one subscriber from breaking others
        console.error("ScrollEventBus subscriber error:", e);
      }
    });
  }

  subscribe(callback: ScrollSubscriber): () => void {
    // Auto-initialize on first subscription
    this.init();
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getLastDirection(): ScrollDirection {
    return this.lastDirection;
  }

  getLastScrollY(): number {
    return this.lastScrollY;
  }

  destroy() {
    if (!this.initialized || typeof window === "undefined") return;

    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("wheel", this.handleWheel);

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.subscribers.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const scrollEventBus = new ScrollEventBus();

// Auto-initialize when DOM is ready
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scrollEventBus.init(), { once: true });
  } else {
    scrollEventBus.init();
  }
}
