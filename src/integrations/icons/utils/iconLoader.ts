// src/integrations/icons/utils/iconLoader.ts
/**
 * Icon Loading and Rendering System
 *
 * Comprehensive icon system supporting:
 * - Multiple icon libraries (Lucide, Feather, Font Awesome, Simple Icons, etc.)
 * - String identifiers ("lu:search", "fa:home")
 * - Emoji icons (direct Unicode)
 * - Custom SVG/image icons
 * - Size management (sm, md, lg, xl)
 * - Accessibility (aria-labels)
 *
 * Used throughout the app for consistent icon rendering in React components.
 */

import { isValidElement, type ReactNode, createElement } from "react";
import { iconMap, type IconKey, type IconData } from "./iconMap.generated.js";
import { normalizeLibraryPrefix } from "./iconConfig.js";

/**
 * Map icon size names to pixel values
 */
export const iconSizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
} as const;

export type IconSize = keyof typeof iconSizeMap;

/**
 * Options for rendering an icon
 */
export interface IconRenderOptions {
  size: IconSize; // Size preset
  className?: string; // Additional CSS classes
  color?: string; // Icon color
  style?: Record<string, any>; // Inline style overrides
  ariaLabel?: string; // Accessibility label
  ariaHidden?: boolean; // Explicitly set aria-hidden (default: true when no ariaLabel)
}

/**
 * Parse icon string to extract library and icon name
 *
 * @param icon - Icon string like "lu:search" or just "search"
 * @returns Object with library and name
 * @example
 * parseIconString("lu:search") // { library: 'lu', name: 'search' }
 * parseIconString("search") // { library: 'lu', name: 'search' }
 */
export function parseIconString(icon: string): {
  library: string;
  name: string;
} {
  if (icon.includes(":")) {
    const [library, name] = icon.split(":");
    return { library: normalizeLibraryPrefix(library), name };
  }
  // Default to Lucide icons if no library specified
  return { library: "lu", name: icon };
}

/**
 * Check if a string is an emoji
 *
 * Uses Unicode range for emoji detection
 *
 * @param str - String to check
 * @returns True if string appears to be an emoji
 */
export function isEmoji(str: string): boolean {
  return (
    /[\u{1F300}-\u{1FAD6}]/u.test(str) ||
    (str.length <= 2 && !/^[a-zA-Z0-9]+$/.test(str))
  );
}

/**
 * Validate icon identifier string format
 *
 * @param icon - Icon identifier to validate
 * @returns True if valid format
 */
export function isValidIconString(icon: string): boolean {
  if (!icon || typeof icon !== "string") return false;
  if (isEmoji(icon)) return true;
  return /^([a-z0-9-]+:)?[a-z0-9-]+$/i.test(icon);
}

/**
 * Get raw SVG data for an icon from the map
 */
export function getIconData(
  library: string,
  iconName: string,
): IconData | null {
  const normalizedLibrary = normalizeLibraryPrefix(library);
  const iconId = `${normalizedLibrary}:${iconName}` as IconKey;
  const data = iconMap[iconId];

  if (!data) {
    console.warn(`Icon not found: ${library}:${iconName}`);
  }

  return data ?? null;
}

/**
 * Recursively convert IconData tree to React elements.
 * When overrideColor is true, strip fill/stroke from child nodes so the
 * parent SVG's color cascades down (overriding brand colors).
 */
function iconDataToElement(node: IconData, overrideColor = false): ReactNode {
  const children =
    node.child?.map((c) => iconDataToElement(c, overrideColor)) ?? [];
  if (overrideColor) {
    const { fill: _f, stroke: _s, ...attr } = node.attr as any;
    return createElement(node.tag, attr, ...children);
  }
  return createElement(node.tag, node.attr, ...children);
}

/**
 * Render an emoji or text as an icon
 */
function renderEmojiIcon(icon: string, options: IconRenderOptions): ReactNode {
  const { size, className = "", color, ariaLabel, style } = options;
  const sizeValue = iconSizeMap[size];
  return createElement("span", {
    className: `inline-flex items-center justify-center ${className}`,
    style: { fontSize: sizeValue, color, ...(style || {}) },
    role: "img",
    "aria-label": ariaLabel,
    children: icon,
  });
}

/**
 * Render an icon from the data map
 */
function renderLibraryIcon(
  library: string,
  iconName: string,
  options: IconRenderOptions,
): ReactNode {
  const { size, className = "", color, ariaLabel, ariaHidden, style } = options;
  const data = getIconData(library, iconName);
  if (!data) return null;

  // Stroke-based icons (Lucide) have fill:"none" on the root — color applies to stroke.
  // Fill-based icons (FA6, SI) have no stroke on the root — color applies to fill.
  const isStrokeBased = data.attr.fill === "none";
  const svgAttrs: Record<string, any> = {
    ...data.attr,
    width: iconSizeMap[size],
    height: iconSizeMap[size],
    // Fill-based: default to currentColor so text-* classes work; explicit color overrides.
    // Stroke-based: always set stroke (currentColor or explicit).
    ...(isStrokeBased
      ? { stroke: color ?? "currentColor" }
      : { fill: color ?? "currentColor" }),
    className,
    style: style ?? undefined,
  };

  if (ariaLabel) {
    svgAttrs["aria-label"] = ariaLabel;
    if (ariaHidden === true) svgAttrs["aria-hidden"] = "true";
  } else {
    svgAttrs["aria-hidden"] = ariaHidden === false ? "false" : "true";
  }

  const children = data.child?.map((c) => iconDataToElement(c, !!color)) ?? [];
  return createElement("svg", svgAttrs, ...children);
}

/**
 * Render a string icon (emoji or library icon)
 *
 * @param icon - Icon string
 * @param options - Render options
 * @returns Rendered icon element
 */
export function renderStringIcon(
  icon: string,
  options: IconRenderOptions,
): ReactNode {
  // Render as emoji if it looks like one
  if (isEmoji(icon)) {
    return renderEmojiIcon(icon, options);
  }

  // Validate format
  if (!isValidIconString(icon)) {
    console.warn(`Invalid icon string: ${icon}`);
    return null;
  }

  // Parse and render from library
  const { library, name } = parseIconString(icon);
  return renderLibraryIcon(library, name, options);
}

/**
 * Render an object-based icon (image, SVG, emoji, text)
 *
 * @param icon - Icon object with type or src
 * @param options - Render options
 * @returns Rendered icon element
 */
export function renderObjectIcon(
  icon: any,
  options: IconRenderOptions,
): ReactNode {
  const { size, className = "", color, ariaLabel, style } = options;
  const sizeValue = iconSizeMap[size];

  // Image object with src
  if ("src" in icon) {
    return createElement("img", {
      src: icon.src,
      alt: ariaLabel || "",
      className,
      width: sizeValue,
      height: sizeValue,
      style: { color, ...(style || {}) },
    });
  }

  // Typed icon objects
  if ("type" in icon) {
    switch (icon.type) {
      case "svg":
        // Raw SVG content
        return createElement("span", {
          className: `inline-flex items-center justify-center ${className}`,
          style: {
            width: sizeValue,
            height: sizeValue,
            color,
            ...(style || {}),
          },
          dangerouslySetInnerHTML: { __html: icon.content },
          "aria-label": ariaLabel,
        });

      case "emoji":
        // Emoji content
        return createElement("span", {
          className: `inline-flex items-center justify-center ${className}`,
          style: { fontSize: sizeValue, color, ...(style || {}) },
          role: "img",
          "aria-label": ariaLabel,
          children: icon.content,
        });

      case "text":
        // Plain text icon
        return createElement("span", {
          className: `inline-flex items-center justify-center ${className}`,
          style: { fontSize: sizeValue, color, ...(style || {}) },
          children: icon.content,
        });
    }
  }

  return null;
}

/**
 * Main render function - handles any icon type
 *
 * Universal entry point for icon rendering.
 * Detects type and delegates to appropriate renderer.
 *
 * @param icon - Icon of any supported type
 * @param options - Render options
 * @returns Rendered icon or null
 * @example
 * renderIcon("lu:search", { size: 'md' })
 * renderIcon("🔍", { size: 'lg' })
 * renderIcon(<CustomIcon />, { size: 'sm' })
 */
export function renderIcon(icon: any, options: IconRenderOptions): ReactNode {
  if (!icon) return null;

  // Already a React element - return as-is
  if (isValidElement(icon)) {
    return icon;
  }

  // String icon (library or emoji)
  if (typeof icon === "string") {
    return renderStringIcon(icon, options);
  }

  // Object icon (image, SVG, etc.)
  if (typeof icon === "object") {
    return renderObjectIcon(icon, options);
  }

  return null;
}

/**
 * Get fully-qualified icon name with library prefix
 *
 * @param icon - Icon name
 * @param library - Optional library name
 * @returns Prefixed icon name
 * @example
 * getIconName('search', 'lu') // 'lu:search'
 */
export function getIconName(icon: string, library?: string): string {
  if (icon.includes(":")) return icon;
  const prefix = library ? normalizeLibraryPrefix(library) || "lu" : "lu";
  return `${prefix}:${icon}`;
}

/**
 * Get human-readable library name from prefix
 *
 * @param prefix - Library prefix
 * @returns Display name
 * @example
 * getLibraryName('lu') // 'Lucide'
 */
export function getLibraryName(prefix: string): string {
  const names: Record<string, string> = {
    lu: "Lucide",
    si: "Simple Icons",
    fi: "Feather",
    fa: "Font Awesome",
    "fa6-brands": "Font Awesome 6 Brands",
    "fa6-solid": "Font Awesome 6 Solid",
    bi: "Bootstrap Icons",
    ai: "Ant Design Icons",
    md: "Material Design Icons",
  };
  const normalized = normalizeLibraryPrefix(prefix);
  return names[normalized] || normalized;
}
