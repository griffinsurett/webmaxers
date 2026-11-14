// src/utils/redirects/collector.ts
/**
 * Redirect Collection from Filesystem
 * 
 * Scans content collections and extracts redirect configurations
 * from _meta.mdx files and individual content items.
 */

import { scanCollections, DEFAULT_CONTENT_DIR } from '../filesystem/contentScanner';
import { normalizePath } from '../pathValidation';
import type { RedirectEntry } from './types';

/**
 * Normalize redirectFrom field to array
 * 
 * @param redirectFrom - Value from frontmatter
 * @returns Array of redirect paths
 */
function normalizeRedirectFrom(redirectFrom: any): string[] {
  if (!redirectFrom) return [];
  if (Array.isArray(redirectFrom)) return redirectFrom;
  if (typeof redirectFrom === 'string') return [redirectFrom];
  return [];
}

/**
 * Collect redirects from a collection's _meta.mdx file
 * 
 * @param collectionName - Collection to process
 * @param contentDir - Path to content directory
 * @returns Array of redirect entries
 */
export function collectCollectionRedirects(
  collectionName: string,
  contentDir: string
): RedirectEntry[] {
  const collection = scanCollections(contentDir).find((c) => c.name === collectionName);
  if (!collection) return [];

  const redirects: RedirectEntry[] = [];
  const meta = collection.meta;

  // Only process if collection has a page
  if (meta.hasPage === false) {
    return redirects;
  }
  
  const redirectFromPaths = normalizeRedirectFrom(meta.redirectFrom);
  
  if (redirectFromPaths.length === 0) {
    return redirects;
  }
  
  const targetPath = `/${collectionName}`;
  
  for (const fromPath of redirectFromPaths) {
    redirects.push({
      from: normalizePath(fromPath),
      to: targetPath,
      source: `${collectionName}/_meta.mdx`,
      type: 'collection',
    });
  }
  
  return redirects;
}

/**
 * Collect redirects from individual items in a collection
 * 
 * @param collectionName - Collection to process
 * @param contentDir - Path to content directory
 * @returns Array of redirect entries
 */
export function collectItemRedirects(
  collectionName: string,
  contentDir: string
): RedirectEntry[] {
  const collection = scanCollections(contentDir).find((c) => c.name === collectionName);
  if (!collection) return [];

  const redirects: RedirectEntry[] = [];
  const meta = collection.meta;
  const itemsHasPageDefault = meta.itemsHasPage !== false;

  for (const item of collection.items) {
    const data = item.data;

    // Check if item should have a page
    const hasPage = data.hasPage !== undefined ? data.hasPage : itemsHasPageDefault;
    if (!hasPage) continue;

    const redirectFromPaths = normalizeRedirectFrom(data.redirectFrom);
    if (redirectFromPaths.length === 0) continue;

    const slug = item.slug;

    // Determine target path based on rootPath setting
    const useRootPath =
      data.rootPath !== undefined ? data.rootPath : meta.itemsRootPath !== undefined ? meta.itemsRootPath : false;

    const targetPath = useRootPath ? `/${slug}` : `/${collectionName}/${slug}`;

    for (const fromPath of redirectFromPaths) {
      redirects.push({
        from: normalizePath(fromPath),
        to: targetPath,
        source: `${collectionName}/${slug}`,
        type: 'item',
      });
    }
  }

  return redirects;
}

/**
 * Collect all redirects from all collections
 * 
 * @param contentDir - Path to content directory
 * @returns Array of all redirect entries
 */
export function collectAllRedirects(
  contentDir: string = DEFAULT_CONTENT_DIR
): RedirectEntry[] {
  const allRedirects: RedirectEntry[] = [];
  const collections = scanCollections(contentDir);
  
  for (const { name } of collections) {
    try {
      // Collection-level redirects
      const collectionRedirects = collectCollectionRedirects(name, contentDir);
      allRedirects.push(...collectionRedirects);
      
      // Item-level redirects
      const itemRedirects = collectItemRedirects(name, contentDir);
      allRedirects.push(...itemRedirects);
    } catch (error) {
      console.error(`Error collecting redirects from ${name}:`, error);
    }
  }
  
  return allRedirects;
}
