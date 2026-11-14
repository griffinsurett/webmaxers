/**
 * useLazyLoad - Universal lazy loading hook
 *
 * Works with Astro's client directives. Three trigger modes:
 *
 * DELAY: Load after timeout
 *   const { Component } = useLazyLoad(() => import("./Foo"), { delay: 3000 });
 *
 * CLICK: Load when element clicked (one-time)
 *   const { Component } = useLazyLoad(() => import("./Foo"), { triggerId: "btn" });
 *
 * TOGGLE: Load on click + manage open/close state
 *   const { Component, isOpen, close } = useLazyLoad(() => import("./Foo"), {
 *     triggerId: "btn",
 *     toggle: true
 *   });
 */

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

interface DelayOptions {
  /** Delay in ms before loading */
  delay: number;
  /** Skip if returns true */
  skipIf?: () => boolean;
  triggerId?: never;
  toggle?: never;
}

interface ClickOptions {
  /** Element ID that triggers load on click */
  triggerId: string;
  /** If true, manages open/close state */
  toggle?: boolean;
  delay?: never;
  skipIf?: never;
}

type Options = DelayOptions | ClickOptions;

interface Result<P> {
  Component: ComponentType<P> | null;
  isLoaded: boolean;
  isOpen: boolean;
  close: () => void;
}

export function useLazyLoad<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  options: Options
): Result<P> {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const started = useRef(false);

  const triggerId = "triggerId" in options ? options.triggerId : undefined;
  const toggle = "toggle" in options ? options.toggle : false;
  const delay = "delay" in options ? options.delay : undefined;
  const skipIf = "skipIf" in options ? options.skipIf : undefined;

  const doLoad = useCallback((cb?: () => void) => {
    if (started.current) {
      cb?.();
      return;
    }
    started.current = true;
    load().then((m) => {
      setComponent(() => m.default);
      cb?.();
    });
  }, [load]);

  const close = useCallback(() => {
    setIsOpen(false);
    if (triggerId) {
      document.getElementById(triggerId)?.setAttribute("aria-expanded", "false");
    }
  }, [triggerId]);

  // Delay trigger
  useEffect(() => {
    if (delay === undefined) return;
    if (skipIf?.()) return;
    if (started.current) return;

    const id = setTimeout(() => doLoad(), delay);
    return () => clearTimeout(id);
  }, [delay, skipIf, doLoad]);

  // Click/Toggle trigger
  useEffect(() => {
    if (!triggerId) return;

    // Use requestAnimationFrame to ensure DOM is ready after React render
    let frameId: number;
    let el: HTMLElement | null = null;

    const onClick = () => {
      if (!el) return;
      if (!started.current) {
        doLoad(() => {
          if (toggle) {
            setIsOpen(true);
            el?.setAttribute("aria-expanded", "true");
          }
        });
      } else if (toggle) {
        setIsOpen((prev) => {
          const next = !prev;
          el?.setAttribute("aria-expanded", String(next));
          return next;
        });
      }
    };

    const setup = () => {
      el = document.getElementById(triggerId);
      if (!el) {
        // Retry on next frame if element not found yet
        frameId = requestAnimationFrame(setup);
        return;
      }
      el.addEventListener("click", onClick);
    };

    frameId = requestAnimationFrame(setup);

    return () => {
      cancelAnimationFrame(frameId);
      el?.removeEventListener("click", onClick);
    };
  }, [triggerId, toggle, doLoad]);

  return {
    Component,
    isLoaded: Component !== null,
    isOpen,
    close,
  };
}

export default useLazyLoad;
