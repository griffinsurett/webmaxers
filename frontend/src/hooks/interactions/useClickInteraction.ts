// src/hooks/interactions/useClickInteraction.ts
import { useEffect } from "react";

export interface ClickInteractionOptions {
  containerSelector?: string;
  itemSelector?: string;
  onOutsideClick?: (event: MouseEvent) => void;
  onInsideClick?: (event: MouseEvent, container: Element) => void;
  onItemClick?: (event: MouseEvent, item: Element | null, container: Element | null) => void;
  trustedOnly?: boolean;
}

export const useClickInteraction = ({
  containerSelector = "[data-container]",
  itemSelector = "[data-item]",
  onOutsideClick = () => {},
  onInsideClick = () => {},
  onItemClick = () => {},
  trustedOnly = true,
}: ClickInteractionOptions = {}) => {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (trustedOnly && !event.isTrusted) return;
      const target = event.target as HTMLElement | null;
      const container = target?.closest?.(containerSelector) ?? null;
      const item = target?.closest?.(itemSelector) ?? null;

      if (!container) {
        onOutsideClick(event);
        return;
      }

      onInsideClick(event, container);
      onItemClick(event, item, container);
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [containerSelector, itemSelector, onInsideClick, onOutsideClick, onItemClick, trustedOnly]);

  return {
    triggerClick: (selector: string) => {
      const el = document.querySelector(selector);
      (el as HTMLElement | null)?.click?.();
    },
  };
};
