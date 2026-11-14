// src/utils/pages/pageGeneration.ts
/**
 * Page Generation Configuration
 *
 * Controls which collections should generate static pages.
 * Some collections (like menus, menu-items) are data-only
 * and shouldn't create pages.
 *
 * This separation keeps the page generation clean and prevents
 * creating unnecessary routes.
 */

import type { CollectionKey } from "astro:content";
import { collections } from "@/content.config";

/**
 * Get all collection names that should generate pages
 *
 * Returns ALL collections - filtering by hasPage happens at the getStaticPaths level.
 * This ensures that _meta.mdx configuration is the single source of truth.
 *
 * @returns Array of collection names that can have pages
 * @example
 * getPageCollections() // ['blog', 'authors', 'services', 'menu-items', 'menus', ...]
 */
export function getPageCollections(): CollectionKey[] {
  return Object.keys(collections) as CollectionKey[];
}
