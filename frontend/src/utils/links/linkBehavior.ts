// src/utils/links/linkBehavior.ts
/**
 * Link Behavior Utilities
 *
 * Applies link behavior configuration to collection items.
 * Enables special collections (contact, social) to work with standard variants.
 */

import type { LinkBehaviorConfigType, ValueFormatterType } from "@/content/schema";
import { formatPhoneNumber } from "@/utils/string";

/** Absolute HTTP(S) link; contact protocols are links, not web-page identities. */
export function absoluteWebUrl(value: unknown, base: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Shared SEO canonical rule: preserve explicit overrides; generated paths have no trailing slash. */
export function canonicalWebUrl(pathname: string, base: string, override?: string): string {
  const value = override || (pathname === "/" ? "/" : pathname.replace(/\/+$/, ""));
  const absolute = absoluteWebUrl(value, base);
  if (!absolute) throw new Error(`[urls] Invalid canonical URL: ${value}`);
  const url = new URL(absolute);
  if (!override && url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  url.hash = "";
  return url.href;
}

/**
 * Format a value based on the formatter type
 */
export function formatValue(
  value: string | undefined,
  formatter: ValueFormatterType
): string {
  if (!value) return "";

  switch (formatter) {
    case "phone":
      return formatPhoneNumber(value);
    case "email":
      return value.toLowerCase().trim();
    case "none":
    default:
      return value;
  }
}

/**
 * Build a URL based on link behavior configuration
 */
export function buildUrl(
  item: Record<string, any>,
  config: LinkBehaviorConfigType,
  collection: string,
  id: string
): string | undefined {
  if (!config) return undefined;

  const mode = config.mode ?? "standard";

  switch (mode) {
    case "prefixed": {
      const prefix = config.prefix ?? item[config.linkPrefix ?? "linkPrefix"] ?? "";
      const value = item.description ?? "";
      if (!prefix || !value) return undefined;
      return `${prefix}${value}`;
    }

    case "field": {
      const linkField = config.link ?? "url";
      return item[linkField] ?? undefined;
    }

    case "root":
      return `/${id}`;

    case "none":
      return undefined;

    case "standard":
    default:
      return `/${collection}/${id}`;
  }
}

/**
 * Apply link behavior to an item, returning url and displayValue
 */
export function applyLinkBehavior(
  item: Record<string, any>,
  config: LinkBehaviorConfigType,
  collection: string,
  id: string
): { url?: string; displayValue?: string } {
  if (!config) {
    return {};
  }

  const url = buildUrl(item, config, collection, id);
  const displayValue = formatValue(
    item.description,
    config.valueFormatter ?? "none"
  );

  return {
    ...(url && { url }),
    ...(displayValue && { displayValue }),
  };
}

/**
 * Merge item's linkBehavior with collection's itemsLinkBehavior
 * Item-level config takes priority
 */
export function mergeLinkBehavior(
  itemConfig: LinkBehaviorConfigType,
  collectionConfig: LinkBehaviorConfigType
): LinkBehaviorConfigType {
  if (!itemConfig && !collectionConfig) return undefined;
  if (!itemConfig) return collectionConfig;
  if (!collectionConfig) return itemConfig;

  // Item config takes priority, fill in missing fields from collection config
  return {
    mode: itemConfig.mode ?? collectionConfig.mode,
    link: itemConfig.link ?? collectionConfig.link,
    linkPrefix: itemConfig.linkPrefix ?? collectionConfig.linkPrefix,
    prefix: itemConfig.prefix ?? collectionConfig.prefix,
    valueFormatter: itemConfig.valueFormatter ?? collectionConfig.valueFormatter,
  };
}
