// src/integrations/preferences/ui/accessibility/components/DecorativeWrapper.tsx
/**
 * Wrapper component for decorative/illustrative content.
 * Automatically hides content from screen readers and removes focusable elements from tab order.
 */
import { useEffect, useRef, type ReactNode } from "react";

interface DecorativeWrapperProps {
  children: ReactNode;
  className?: string;
}

export default function DecorativeWrapper({
  children,
  className = "",
}: DecorativeWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableSelectors = [
      "input",
      "button",
      "select",
      "textarea",
      "a[href]",
      "[tabindex]",
      "summary",
      "iframe",
      "audio[controls]",
      "video[controls]",
      "[contenteditable=\"true\"]",
    ].join(", ");

    const makeDecorative = () => {
      if (container.getAttribute("aria-hidden") !== "true") {
        container.setAttribute("aria-hidden", "true");
      }
      if (container.getAttribute("role") !== "presentation") {
        container.setAttribute("role", "presentation");
      }
      if (container.getAttribute("aria-live") !== "off") {
        container.setAttribute("aria-live", "off");
      }
      if (container.getAttribute("data-decorative") !== "true") {
        container.setAttribute("data-decorative", "true");
      }
      if (!container.hasAttribute("inert")) {
        container.setAttribute("inert", "");
      }

      const focusableElements = container.querySelectorAll<HTMLElement>(
        focusableSelectors,
      );

      focusableElements.forEach((el) => {
        if (el.getAttribute("tabindex") !== "-1") {
          el.setAttribute("tabindex", "-1");
        }
        if (el.getAttribute("aria-hidden") !== "true") {
          el.setAttribute("aria-hidden", "true");
        }
      });
    };

    makeDecorative();

    const observer = new MutationObserver(() => {
      makeDecorative();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "controls", "contenteditable"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      role="presentation"
      aria-live="off"
      data-decorative="true"
    >
      {children}
    </div>
  );
}
