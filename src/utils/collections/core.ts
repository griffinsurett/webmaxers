// src/utils/collections/core.ts
/**
 * Core Collection Management - FULLY LAZY
 */

import type { CollectionKey, CollectionEntry } from "astro:content";
import { collections } from "@/content.config";
import type { MetaData } from "@/content/schema";

// ❌ NO astro:content imports at module level

export function getCollectionNames(): string[] {
  return Object.keys(collections);
}

/**
 * Filter function that excludes draft entries
 * Drafts should never appear in any collection query
 */
const excludeDrafts = (entry: { data: unknown }) => {
  const data = entry.data;
  return !(data && typeof data === "object" && "draft" in data && data.draft === true);
};

/**
 * Get a collection with drafts automatically filtered out
 * This is the primary way to fetch collection entries - drafts simply don't exist
 */
export async function getPublishedCollection<T extends CollectionKey>(
  collectionName: T
): Promise<CollectionEntry<T>[]> {
  const { getCollection } = await import("astro:content");
  return getCollection(collectionName, excludeDrafts) as Promise<CollectionEntry<T>[]>;
}

export async function getCollectionWithMeta(collectionName: CollectionKey) {
  const { metaSchema } = await import("@/content/schema");

  const mdxModules = import.meta.glob<{ frontmatter?: Record<string, any> }>(
    "../../content/**/_meta.mdx",
    { eager: true }
  );

  const mdxKey = Object.keys(mdxModules).find((k) =>
    k.endsWith(`/${collectionName}/_meta.mdx`)
  );

  const data = mdxKey ? (mdxModules[mdxKey] as any).frontmatter ?? {} : {};

  const simpleImageFn = () => ({
    parse: (val: any) => val,
    _parse: (val: any) => ({ success: true, data: val }),
  });

  const meta: MetaData = metaSchema({ image: simpleImageFn }).parse(data);

  // Use getPublishedCollection to exclude drafts
  const entries = await getPublishedCollection(collectionName);

  return { entries, meta, collectionName };
}
