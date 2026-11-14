// src/hooks/interactions/useKeyboardInteraction.ts
import { useCallback, useEffect, type RefObject } from "react";

export interface KeyboardInteractionOptions {
  /** Ref to the element to listen on (defaults to document) */
  elementRef?: RefObject<HTMLElement | null>;
  /** Only trigger on trusted events */
  trustedOnly?: boolean;
  /** Keys to listen for (e.g., ["ArrowLeft", "ArrowRight"]) */
  keys?: string[];
  /** Callback when ArrowLeft is pressed */
  onArrowLeft?: (event: KeyboardEvent) => void;
  /** Callback when ArrowRight is pressed */
  onArrowRight?: (event: KeyboardEvent) => void;
  /** Callback when ArrowUp is pressed */
  onArrowUp?: (event: KeyboardEvent) => void;
  /** Callback when ArrowDown is pressed */
  onArrowDown?: (event: KeyboardEvent) => void;
  /** Callback for any specified key */
  onKeyDown?: (event: KeyboardEvent, key: string) => void;
  /** Prevent default browser behavior for matched keys */
  preventDefault?: boolean;
  /** Only trigger when element or its children have focus */
  requireFocus?: boolean;
}

const INTERACTIVE_ELEMENTS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export const useKeyboardInteraction = ({
  elementRef,
  trustedOnly = true,
  keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
  onArrowLeft,
  onArrowRight,
  onArrowUp,
  onArrowDown,
  onKeyDown,
  preventDefault = true,
  requireFocus = true,
}: KeyboardInteractionOptions = {}) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (trustedOnly && !event.isTrusted) return;

      // Skip if typing in an input
      const target = event.target as HTMLElement | null;
      if (target && INTERACTIVE_ELEMENTS.has(target.tagName)) return;
      if (target?.isContentEditable) return;

      // Check if key is in our list
      if (!keys.includes(event.key)) return;

      // If requireFocus, check that the element or its children have focus
      if (requireFocus && elementRef?.current) {
        const el = elementRef.current;
        if (!el.contains(document.activeElement) && el !== document.activeElement) {
          return;
        }
      }

      if (preventDefault) {
        event.preventDefault();
      }

      // Call specific arrow handlers
      switch (event.key) {
        case "ArrowLeft":
          onArrowLeft?.(event);
          break;
        case "ArrowRight":
          onArrowRight?.(event);
          break;
        case "ArrowUp":
          onArrowUp?.(event);
          break;
        case "ArrowDown":
          onArrowDown?.(event);
          break;
      }

      // Call generic handler
      onKeyDown?.(event, event.key);
    },
    [
      trustedOnly,
      keys,
      onArrowLeft,
      onArrowRight,
      onArrowUp,
      onArrowDown,
      onKeyDown,
      preventDefault,
      requireFocus,
      elementRef,
    ]
  );

  useEffect(() => {
    const target = elementRef?.current ?? document;

    target.addEventListener("keydown", handleKeyDown as EventListener);
    return () => target.removeEventListener("keydown", handleKeyDown as EventListener);
  }, [elementRef, handleKeyDown]);

  return {
    /** Programmatically trigger a key event */
    triggerKey: (key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      handleKeyDown(event);
    },
  };
};
