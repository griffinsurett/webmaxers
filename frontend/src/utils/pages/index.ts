// src/utils/pages/index.ts
/**
 * Page Generation Decision Logic
 *
 * Determines which collections and items should have pages generated.
 * Uses the override pattern from pages/pageRules.ts to respect both
 * collection-level and item-level settings.
 *
 * Four key functions:
 * - shouldItemHavePage: Does this specific item get a page?
 * - shouldItemUseRootPath: Should item be at root level (e.g., /about)?
 * - shouldCollectionHavePage: Does the collection get an index page?
 * - shouldProcessCollection: Should we even look at this collection?
 */

import type { CollectionEntry, CollectionKey } from "astro:content";
import { getCollection } from "astro:content";
import { getCollectionMeta } from "@/utils/collections";
import type { MetaData } from "@/content/schema";
import {
  shouldItemHavePageData,
  shouldItemUseRootPathData,
  shouldCollectionHavePageMeta,
  shouldProcessCollectionData,
} from "./pageRules";

/**
 * Determine if an individual item should have its own page
 *
 * Uses priority resolution:
 * 1. Item's hasPage field (highest priority)
 * 2. Parent's childHasPage (if item has a parent)
 * 3. Collection's itemsChildHasPage (for items with parents)
 * 4. Collection's itemsHasPage setting from _meta.mdx
 * 5. Default: true (most items should have pages)
 *
 * @param item - Collection entry to check
 * @param meta - Collection metadata
 * @param parentItem - Optional parent entry (for childHasPage resolution)
 * @returns True if item should get a dedicated page
 * @example
 * // Item explicitly says no page
 * shouldItemHavePage({ data: { hasPage: false } }, meta) // false
 *
 * // Item has no preference, use collection default
 * shouldItemHavePage({ data: {} }, { itemsHasPage: false }) // false
 *
 * // Parent controls child pages
 * shouldItemHavePage(child, meta, { data: { childHasPage: false } }) // false
 */
export function shouldItemHavePage(
  item: CollectionEntry<CollectionKey>,
  meta: MetaData,
  parentItem?: CollectionEntry<CollectionKey>
): boolean {
  return shouldItemHavePageData(item.data, meta, true, parentItem?.data);
}

/**
 * Determine if an item should use root-level path
 *
 * Uses override pattern:
 * - Item's rootPath field (if present)
 * - Collection's itemsRootPath setting from _meta.mdx
 * - Default: false (most items use collection paths)
 *
 * When true, item is accessible at /slug instead of /collection/slug
 *
 * @param item - Collection entry to check
 * @param meta - Collection metadata
 * @returns True if item should use root path
 * @example
 * // Item says use root path
 * shouldItemUseRootPath({ data: { rootPath: true } }, meta) // true
 * // Result: /about instead of /pages/about
 *
 * // Collection sets default for all items
 * shouldItemUseRootPath({ data: {} }, { itemsRootPath: true }) // true
 */
export function shouldItemUseRootPath(
  item: CollectionEntry<CollectionKey>,
  meta: MetaData
): boolean {
  return shouldItemUseRootPathData(item.data, meta, false);
}

/**
 * Determine if a collection should have an index page
 *
 * This is the SINGLE SOURCE OF TRUTH for collection page generation.
 * Checks the hasPage field in _meta.mdx (defaults to true).
 * Index pages show all items in the collection.
 *
 * @param meta - Collection metadata
 * @returns True if collection should have /collection index page
 * @example
 * shouldCollectionHavePage({ hasPage: false }) // false
 * shouldCollectionHavePage({}) // true (default)
 */
export function shouldCollectionHavePage(meta: MetaData): boolean {
  return shouldCollectionHavePageMeta(meta, true);
}

/**
 * Determine if a collection should be processed for page generation
 *
 * A collection should be processed if:
 * - Collection-level itemsHasPage is not false, OR
 * - At least one item has hasPage: true
 *
 * This allows collections with itemsHasPage: false to still have
 * individual items opt-in to having pages.
 *
 * @param collectionName - Collection to check
 * @returns True if collection should be processed for static pages
 */
export async function shouldProcessCollection(
  collectionName: CollectionKey
): Promise<boolean> {
  const meta = getCollectionMeta(collectionName);

  // If collection allows item pages by default, process it
  if (meta.itemsHasPage !== false) {
    return true;
  }

  // Otherwise, check if any individual items override this
  const entries = await getCollection(collectionName);
  return shouldProcessCollectionData(entries, meta);
}
