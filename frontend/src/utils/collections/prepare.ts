// src/utils/collections/prepare.ts
/**
 * Collection Entry Preparation - LAZY RENDER
 */

import type { CollectionKey, CollectionEntry } from "astro:content";
import { render as renderEntry } from "astro:content";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import type { MetaData, BaseData } from "@/content/schema";
import { getFirstParentId } from "@/utils/query/helpers";
// ❌ NO imports that touch pages/filesystem during module load
// ✅ Import inside functions

export interface PreparedFields {
  id: string;
  collection?: string;
  url?: string;
  /** Generated page path, distinct from a card's contact/checkout/custom link. */
  pageUrl?: string;
  /** SEO identity derived from the same resolved link and item/collection SEO. */
  canonicalUrl?: string;
  displayValue?: string;
  /** Lazy render function - call to get Content component when needed */
  render?: () => Promise<{ Content: AstroComponentFactory }>;
  content?: string;
}

export type PreparedItem = BaseData & PreparedFields;

/** The quote shown by TestimonialCard; schema consumes this same selection. */
export function getTestimonialQuote(item: { content?: string | null; description?: string | null }): string {
  return (item.content ?? item.description ?? "").trim();
}

export async function prepareEntry<T extends CollectionKey>(
  entry: CollectionEntry<T>,
  collection: T,
  meta: MetaData,
  entriesMap?: Map<string, CollectionEntry<T>>
): Promise<PreparedItem> {
  // ✅ Lazy import utilities
  const { shouldItemHavePage, shouldItemUseRootPath } = await import(
    "@/utils/pages"
  );
  const { applyLinkBehavior, mergeLinkBehavior } = await import(
    "@/utils/links/linkBehavior"
  );

  const identifier = entry.id;
  const data = entry.data as Record<string, any>;

  // Use the same primary-parent rule as static route generation.
  const parentId = getFirstParentId(data.parent);
  const parentEntry = parentId
    ? entriesMap?.get(parentId) ?? await (await import("@/utils/query")).find(collection, parentId)
    : undefined;

  // Check for link behavior config (item-level overrides collection-level)
  const linkBehavior = mergeLinkBehavior(
    data.linkBehavior,
    meta.itemsLinkBehavior
  );

  let itemUrl: string | undefined;
  let displayValue: string | undefined;
  const hasPage = shouldItemHavePage(entry, meta, parentEntry);
  const pageUrl = hasPage
    ? (shouldItemUseRootPath(entry, meta) ? `/${identifier}` : `/${collection}/${identifier}`)
    : undefined;

  if (linkBehavior) {
    // Use link behavior to determine URL and display value
    const linkResult = applyLinkBehavior(data, linkBehavior, collection as string, identifier);
    // Preserve the existing explicit URL fallback (e.g. a map link in a
    // collection of prefixed phone/email entries). Explicit "none" disables it.
    itemUrl = linkResult.url ?? (linkBehavior.mode === "none" ? undefined : data.url);
    displayValue = linkResult.displayValue;
  } else {
    // Standard URL generation
    const hasExistingUrl = data.url !== undefined;

    if (hasExistingUrl) {
      itemUrl = data.url;
    } else if (hasPage) {
      itemUrl = pageUrl;
    }
  }

  // Store raw body for variants that need it - don't render Content here
  // Rendering MDX Content is expensive and should only happen when actually displayed
  let content: string | undefined;
  if ("body" in entry) {
    content = (entry as any).body;
  }

  // Store lazy render closure using standalone render() — entry.render() removed in Astro 6
  const hasBody = "body" in entry;
  const renderFn = hasBody
    ? () => renderEntry(entry as any)
    : undefined;

  const { absoluteWebUrl, canonicalWebUrl } = await import("@/utils/links/linkBehavior");
  const { mergeItemSEO } = await import("@/utils/seo");
  const { siteData } = await import("@site/content/siteData");
  const seo = mergeItemSEO(data, meta);
  const webUrl = absoluteWebUrl(pageUrl, siteData.url);
  const canonicalUrl = webUrl || seo?.canonicalUrl
    ? canonicalWebUrl(webUrl ?? "/", siteData.url, seo?.canonicalUrl)
    : undefined;

  return {
    ...data,
    id: identifier,
    collection,
    url: itemUrl,
    pageUrl,
    canonicalUrl,
    ...(displayValue && { displayValue }),
    ...(renderFn && { render: renderFn }),
    ...(content && { content }),
  } as PreparedItem;
}

export async function prepareCollectionEntries<T extends CollectionKey>(
  entries: CollectionEntry<T>[],
  collection: T,
  meta: MetaData
): Promise<PreparedItem[]> {
  const entriesMap = new Map<string, CollectionEntry<T>>();
  for (const entry of entries) {
    if (entry.id) entriesMap.set(entry.id, entry);
  }

  return Promise.all(
    entries.map((entry) => prepareEntry(entry, collection, meta, entriesMap))
  );
}
