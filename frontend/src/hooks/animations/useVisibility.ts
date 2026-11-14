import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useScrollInteraction } from "@/hooks/interactions/useScrollInteraction";
import { createIntersectionObserver } from "@/utils/IntersectionObserver";

interface VisibilityOptions {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string | number;
  once?: boolean;
  onEnter?: (entry: IntersectionObserverEntry) => void;
  onExit?: (entry: IntersectionObserverEntry) => void;
  onForward?: () => void;
  onBackward?: () => void;
  pauseDelay?: number;
  restoreAtTopOffset?: number;
  menuCheckboxId?: string;
}

function normalizeRootMargin(rootMargin?: string | number): string {
  if (typeof rootMargin === "number") {
    return `0px 0px ${rootMargin}px 0px`;
  }
  const trimmed = String(rootMargin ?? "").trim();
  if (/^-?\d+px$/.test(trimmed)) {
    return `0px 0px ${trimmed} 0px`;
  }
  return trimmed || "0px";
}

export function useVisibility(
  ref: MutableRefObject<HTMLElement | null> | null,
  {
    threshold = 0.1,
    root = null,
    rootMargin = "0px",
    once = false,
    onEnter,
    onExit,
    onForward,
    onBackward,
    pauseDelay = 100,
    restoreAtTopOffset = 100,
    menuCheckboxId,
  }: VisibilityOptions = {}
): boolean {
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);
  const normalizedMargin = useMemo(() => normalizeRootMargin(rootMargin), [rootMargin]);

  useEffect(() => {
    const element = ref?.current;
    if (!element) return;

    const { isVisible, hasBeenSeen, disconnect } = createIntersectionObserver(element, {
      threshold,
      root,
      rootMargin: normalizedMargin,
      once,
      onEnter: (entry) => {
        setVisible(true);
        setSeen(true);
        onEnter?.(entry);
      },
      onExit: (entry) => {
        setVisible(false);
        onExit?.(entry);
      },
    });

    setVisible(isVisible);
    setSeen(hasBeenSeen);

    return disconnect;
  }, [ref, threshold, root, normalizedMargin, once, onEnter, onExit]);

  const wantsDirection = typeof onForward === "function" || typeof onBackward === "function";

  useScrollInteraction({
    elementRef: null,
    scrollThreshold: 5,
    debounceDelay: pauseDelay,
    onScrollActivity: wantsDirection
      ? ({ dir }) => {
          if (dir === "down") {
            onForward?.();
          } else if (typeof window !== "undefined" && window.pageYOffset <= restoreAtTopOffset) {
            onBackward?.();
          }
        }
      : undefined,
  });

  useEffect(() => {
    if (!menuCheckboxId || !wantsDirection || typeof document === "undefined") return;
    const checkbox = document.getElementById(menuCheckboxId) as HTMLInputElement | null;
    if (!checkbox) return;

    const syncMenu = () => {
      if (checkbox.checked) {
        onBackward?.();
      } else if (typeof window !== "undefined" && window.pageYOffset > restoreAtTopOffset) {
        onForward?.();
      } else {
        onBackward?.();
      }
    };

    checkbox.addEventListener("change", syncMenu);
    syncMenu();

    return () => checkbox.removeEventListener("change", syncMenu);
  }, [menuCheckboxId, onBackward, onForward, restoreAtTopOffset, wantsDirection]);

  return once ? seen : visible;
}
