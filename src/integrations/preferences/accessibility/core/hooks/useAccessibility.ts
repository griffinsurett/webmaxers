// src/integrations/preferences/core/accessibility/hooks/useAccessibility.ts
/**
 * Accessibility Preferences Hook (Core)
 *
 * Manages accessibility preferences with localStorage persistence.
 * Applies preferences to the DOM via CSS variables and data attributes.
 *
 * @example
 * ```tsx
 * import { useAccessibility } from '@/integrations/preferences/accessibility/core/hooks/useAccessibility';
 *
 * function MyAccessibilityPanel() {
 *   const { preferences, setPreferences, resetPreferences } = useAccessibility();
 *   // Build your own UI...
 * }
 * ```
 */

import { useEffect } from "react";
import useLocalStorage from "@/hooks/useLocalStorage";
import {
  DEFAULT_PREFS,
  type A11yPreferences,
} from "../types";

const FONT_WEIGHT_MAP: Record<A11yPreferences["text"]["fontWeight"], string> = {
  normal: "400",
  semibold: "600",
  bold: "700",
};

// Cursor tracking handlers
let guideHandler: ((e: MouseEvent) => void) | null = null;
let maskHandler: ((e: MouseEvent) => void) | null = null;

function attachReadingGuide() {
  if (guideHandler) return;

  guideHandler = (e: MouseEvent) => {
    const guide = document.querySelector("[data-reading-guide]") as HTMLElement;
    if (guide) {
      guide.style.top = `${e.clientY}px`;
    }
  };

  document.addEventListener("mousemove", guideHandler, { passive: true });

  if (!document.querySelector("[data-reading-guide]")) {
    const guide = document.createElement("div");
    guide.setAttribute("data-reading-guide", "true");
    guide.style.cssText = `
      position: fixed;
      left: 0;
      right: 0;
      height: 2px;
      background-color: rgba(255, 0, 0, 0.6);
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 0 8px rgba(255, 0, 0, 0.4);
    `;
    document.body.appendChild(guide);
  }
}

function detachReadingGuide() {
  if (guideHandler) {
    document.removeEventListener("mousemove", guideHandler);
    guideHandler = null;
  }

  const guide = document.querySelector("[data-reading-guide]");
  if (guide) {
    guide.remove();
  }
}

function attachReadingMask() {
  if (maskHandler) return;

  maskHandler = (e: MouseEvent) => {
    document.documentElement.style.setProperty("--cursor-x", `${e.clientX}px`);
    document.documentElement.style.setProperty("--cursor-y", `${e.clientY}px`);
  };

  document.addEventListener("mousemove", maskHandler, { passive: true });
}

function detachReadingMask() {
  if (maskHandler) {
    document.removeEventListener("mousemove", maskHandler);
    maskHandler = null;
  }
}

// Image hiding - stores original images to restore later
const hiddenImagesMap = new WeakMap<HTMLElement, HTMLImageElement>();

function hideImages() {
  // Handle regular images
  const images = document.querySelectorAll<HTMLImageElement>("img:not([data-a11y-hidden])");

  images.forEach((img) => {
    const alt = img.alt || "Image";

    // Create placeholder wrapper
    const placeholder = document.createElement("div");
    placeholder.className = "a11y-image-placeholder";
    placeholder.setAttribute("data-a11y-placeholder", "true");
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", alt);
    placeholder.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
      padding: 1em;
      background: #f0f0f0;
      border: 2px dashed #999;
      border-radius: 4px;
      text-align: center;
    `;

    // Create alt text content
    const altText = document.createElement("span");
    altText.style.cssText = `
      font-style: italic;
      color: #666;
      padding: 0.5em 1em;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    altText.textContent = `📷 ${alt}`;
    placeholder.appendChild(altText);

    // Store reference and replace
    img.setAttribute("data-a11y-hidden", "true");
    hiddenImagesMap.set(placeholder, img);
    img.parentNode?.insertBefore(placeholder, img);
    img.style.display = "none";
  });

  // Handle decorative logo containers
  const logoContainers = document.querySelectorAll<HTMLElement>('.logo-class:not([data-a11y-hidden])');
  logoContainers.forEach((container) => {
    const alt = container.getAttribute("aria-label") || "Animation";

    // Create placeholder
    const placeholder = document.createElement("div");
    placeholder.className = "a11y-image-placeholder";
    placeholder.setAttribute("data-a11y-placeholder", "true");
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", alt);
    placeholder.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      min-width: 40px;
      padding: 0.5em;
      background: #f0f0f0;
      border: 2px dashed #999;
      border-radius: 4px;
      text-align: center;
    `;

    // Create alt text content
    const altText = document.createElement("span");
    altText.style.cssText = `
      font-style: italic;
      color: #666;
      padding: 0.25em 0.5em;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 10px;
    `;
    altText.textContent = `🎬 ${alt}`;
    placeholder.appendChild(altText);

    // Store reference and replace
    container.setAttribute("data-a11y-hidden", "true");
    hiddenImagesMap.set(placeholder, container as unknown as HTMLImageElement);
    container.parentNode?.insertBefore(placeholder, container);
    container.style.display = "none";
  });
}

function showImages() {
  const placeholders = document.querySelectorAll<HTMLElement>("[data-a11y-placeholder]");

  placeholders.forEach((placeholder) => {
    const element = hiddenImagesMap.get(placeholder);
    if (element) {
      element.style.display = "";
      element.removeAttribute("data-a11y-hidden");
      placeholder.remove();
      hiddenImagesMap.delete(placeholder);
    }
  });

  // Also restore any elements that might have been hidden without placeholder
  document.querySelectorAll<HTMLElement>("[data-a11y-hidden]").forEach((el) => {
    el.style.display = "";
    el.removeAttribute("data-a11y-hidden");
  });
}

export function applyPreferences(prefs: A11yPreferences) {
  const root = document.documentElement;
  const resolvedWeight =
    FONT_WEIGHT_MAP[prefs.text.fontWeight] ?? FONT_WEIGHT_MAP.normal;

  console.log("🎨 Applying accessibility preferences:", prefs);

  // TEXT & TYPOGRAPHY
  root.style.setProperty("--a11y-font-size", `${prefs.text.fontSize}%`);
  root.style.setProperty("--a11y-line-height", `${prefs.text.lineHeight}`);
  root.style.setProperty(
    "--a11y-letter-spacing",
    `${prefs.text.letterSpacing}em`
  );
  root.style.setProperty("--a11y-word-spacing", `${prefs.text.wordSpacing}em`);
  root.style.setProperty("--a11y-font-weight", resolvedWeight);
  root.style.setProperty("--a11y-text-align", prefs.text.textAlign);
  root.setAttribute("data-a11y-font", prefs.text.fontFamily);

  // Set data attributes to trigger overrides when changed from defaults
  if (prefs.text.lineHeight !== 1.5) {
    root.setAttribute("data-a11y-line-height", "true");
  } else {
    root.removeAttribute("data-a11y-line-height");
  }

  if (prefs.text.letterSpacing !== 0) {
    root.setAttribute("data-a11y-letter-spacing", "true");
  } else {
    root.removeAttribute("data-a11y-letter-spacing");
  }

  if (prefs.text.wordSpacing !== 0) {
    root.setAttribute("data-a11y-word-spacing", "true");
  } else {
    root.removeAttribute("data-a11y-word-spacing");
  }

  if (prefs.text.fontWeight !== "normal") {
    root.setAttribute("data-a11y-font-weight", prefs.text.fontWeight);
  } else {
    root.removeAttribute("data-a11y-font-weight");
  }

  if (prefs.text.textAlign !== "left") {
    root.setAttribute("data-a11y-text-align", "true");
  } else {
    root.removeAttribute("data-a11y-text-align");
  }

  // VISUAL ENHANCEMENTS
  root.setAttribute(
    "data-a11y-links",
    prefs.visual.linkHighlight ? "true" : "false"
  );
  root.setAttribute(
    "data-a11y-titles",
    prefs.visual.titleHighlight ? "true" : "false"
  );
  root.setAttribute(
    "data-a11y-contrast",
    prefs.visual.contrastBoost ? "boost" : "normal"
  );
  root.setAttribute("data-a11y-saturation", prefs.visual.saturation);

  // READING AIDS
  root.setAttribute(
    "data-a11y-focus",
    prefs.reading.focusHighlight ? "true" : "false"
  );
  root.setAttribute(
    "data-a11y-cursor",
    prefs.reading.bigCursor ? "big" : "normal"
  );
  root.setAttribute(
    "data-a11y-mask",
    prefs.reading.readingMask ? "true" : "false"
  );

  if (prefs.reading.pauseAnimations) {
    root.style.setProperty("--a11y-animation-duration", "0.01ms");
    root.setAttribute("data-a11y-animations", "true");
  } else {
    root.style.removeProperty("--a11y-animation-duration");
    root.removeAttribute("data-a11y-animations");
  }

  // Attach/detach reading guide
  if (prefs.reading.readingGuide) {
    attachReadingGuide();
  } else {
    detachReadingGuide();
  }

  // Attach/detach reading mask
  if (prefs.reading.readingMask) {
    attachReadingMask();
  } else {
    detachReadingMask();
  }

  // CONTENT SIMPLIFICATION
  root.setAttribute(
    "data-a11y-images",
    prefs.content.hideImages ? "hide" : "show"
  );

  // Handle image hiding with JavaScript (CSS pseudo-elements don't work on img tags)
  if (prefs.content.hideImages) {
    hideImages();
  } else {
    showImages();
  }
  root.setAttribute(
    "data-a11y-sounds",
    prefs.content.muteSounds ? "mute" : "play"
  );
  root.setAttribute(
    "data-a11y-motion",
    prefs.content.reducedMotion ? "reduced" : "normal"
  );

  console.log("✅ Accessibility preferences applied successfully");
}

function removePreferences() {
  const root = document.documentElement;

  console.log("🧹 Removing all accessibility preferences");

  // Remove CSS variables
  root.style.removeProperty("--a11y-font-size");
  root.style.removeProperty("--a11y-line-height");
  root.style.removeProperty("--a11y-letter-spacing");
  root.style.removeProperty("--a11y-word-spacing");
  root.style.removeProperty("--a11y-font-weight");
  root.style.removeProperty("--a11y-text-align");
  root.style.removeProperty("--a11y-animation-duration");

  // Remove attributes
  root.removeAttribute("data-a11y-font");
  root.removeAttribute("data-a11y-line-height");
  root.removeAttribute("data-a11y-letter-spacing");
  root.removeAttribute("data-a11y-word-spacing");
  root.removeAttribute("data-a11y-font-weight");
  root.removeAttribute("data-a11y-text-align");
  root.removeAttribute("data-a11y-links");
  root.removeAttribute("data-a11y-titles");
  root.removeAttribute("data-a11y-contrast");
  root.removeAttribute("data-a11y-saturation");
  root.removeAttribute("data-a11y-focus");
  root.removeAttribute("data-a11y-cursor");
  root.removeAttribute("data-a11y-mask");
  root.removeAttribute("data-a11y-images");
  root.removeAttribute("data-a11y-sounds");
  root.removeAttribute("data-a11y-motion");
  root.removeAttribute("data-a11y-animations");

  // Detach handlers
  detachReadingGuide();
  detachReadingMask();

  // Restore hidden images
  showImages();
}

/**
 * Hook to manage accessibility preferences using existing useLocalStorage
 */
export function useAccessibility() {
  // Use existing hook with validation
  const [prefs, setPrefs] = useLocalStorage<A11yPreferences>(
    "user-a11y-prefs",
    DEFAULT_PREFS,
    {
      raw: false, // Use JSON mode
      syncTabs: true, // Sync across tabs
      validate: (value): boolean => {
        // Basic validation
        return !!(
          value &&
          typeof value === "object" &&
          "text" in value &&
          "visual" in value &&
          "reading" in value &&
          "content" in value
        );
      },
    }
  );

  // Apply preferences whenever they change (including cross-tab sync)
  useEffect(() => {
    console.log("🔄 Preferences changed, applying:", prefs);
    applyPreferences(prefs);
  }, [prefs]);

  const resetPreferences = () => {
    console.log("🔄 Resetting to default preferences");
    removePreferences();
    setPrefs(DEFAULT_PREFS);
  };

  return {
    preferences: prefs,
    setPreferences: setPrefs,
    resetPreferences,
  };
}
