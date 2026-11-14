// src/utils/redirects/pathAliasCollector.ts
/**
 * Path Alias Redirect Collector
 * 
 * Automatically generates redirects between root-level and collection-level paths.
 * Ensures users never hit 404s when accessing items via alternate paths.
 * 
 * Examples:
 * - Item at /about (rootPath: true) → Redirect /pages/about to /about
 * - Item at /blog/post (rootPath: false) → Redirect /post to /blog/post
 */

import { scanCollections, DEFAULT_CONTENT_DIR } from '../filesystem/contentScanner';
import { normalizePath } from '../pathValidation';
import { shouldItemHavePage, shouldItemUseRootPath } from '../filesystem/pageLogic';
import type { RedirectEntry } from './types';

/**
 * Collect path alias redirects for a single collection
 * 
 * For each item that has a page:
 * - If rootPath: true → Redirect /collection/slug to /slug
 * - If rootPath: false → Redirect /slug to /collection/slug
 * 
 * @param collectionName - Collection to process
 * @param contentDir - Path to content directory
 * @returns Array of redirect entries
 */
export function collectPathAliasRedirects(
  collectionName: string,
  contentDir: string
): RedirectEntry[] {
  const redirects: RedirectEntry[] = [];
  const collection = scanCollections(contentDir).find((c) => c.name === collectionName);
  if (!collection) return redirects;

  const meta = collection.meta;

  for (const item of collection.items) {
    const itemData = item.data;

    // Skip items without pages - using Node.js-compatible function from filesystem/pageLogic
    if (!shouldItemHavePage(itemData, meta)) continue;

    const slug = item.slug;

    // Determine paths
    const rootPath = `/${slug}`;
    const collectionPath = `/${collectionName}/${slug}`;

    // Use Node.js-compatible function from filesystem/pageLogic
    const useRootPath = shouldItemUseRootPath(itemData, meta);

    // Create redirect based on rootPath setting
    if (useRootPath) {
      redirects.push({
        from: normalizePath(collectionPath),
        to: normalizePath(rootPath),
        source: `${collectionName}/${slug} (path-alias)`,
        type: 'path-alias',
      });
    } else {
      redirects.push({
        from: normalizePath(rootPath),
        to: normalizePath(collectionPath),
        source: `${collectionName}/${slug} (path-alias)`,
        type: 'path-alias',
      });
    }
  }

  return redirects;
}

/**
 * Collect all path alias redirects from all collections
 * 
 * @param contentDir - Path to content directory
 * @returns Array of all path alias redirect entries
 */
export function collectAllPathAliasRedirects(
  contentDir: string = DEFAULT_CONTENT_DIR
): RedirectEntry[] {
  const allRedirects: RedirectEntry[] = [];
  const collections = scanCollections(contentDir);
  
  for (const { name } of collections) {
    try {
      const pathRedirects = collectPathAliasRedirects(name, contentDir);
      allRedirects.push(...pathRedirects);
    } catch (error) {
      console.error(`Error collecting path alias redirects from ${name}:`, error);
    }
  }
  
  return allRedirects;
}
