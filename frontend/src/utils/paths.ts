// src/utils/paths.ts
/**
 * Path Parsing Utilities
 * 
 * Helper functions for working with content file paths.
 * Extracts collection names, slugs, and identifies special files.
 * 
 * Used by loaders and other utilities to parse glob import paths.
 */

/**
 * Parse a content file path to extract collection name and slug
 * 
 * Handles the standard content structure:
 * src/content/{collection}/{file}.mdx
 * 
 * @param path - File path from glob import
 * @returns Object with collection name and slug (filename without extension)
 * @example
 * parseContentPath('../../content/blog/my-post.mdx')
 * // Returns: { collection: 'blog', slug: 'my-post' }
 */
export function parseContentPath(path: string): { collection: string; slug: string } {
  const segments = path.split('/');
  const fileName = segments.pop()!;
  const collection = segments.pop()!;
  const slug = fileName.replace(/\.(mdx|md|json)$/, '');
  
  return { collection, slug };
}

/**
 * Check if a path is a meta file (_meta.mdx, _meta.md, _meta.json)
 * 
 * Meta files are special - they configure collections but aren't
 * collection entries themselves.
 * 
 * @param path - File path to check
 * @returns True if path is a meta file
 */
export function isMetaFile(path: string): boolean {
  return /_meta\.(mdx|md|json)$/.test(path);
}

/**
 * Check if a path belongs to a specific collection
 *
 * @param path - File path to check
 * @param collectionName - Collection name to match
 * @returns True if path is in the specified collection
 */
export function isInCollection(path: string, collectionName: string): boolean {
  return path.includes(`/content/${collectionName}/`);
}

/**
 * Parse a URL pathname to extract collection and slug
 *
 * Handles standard URL structure:
 * /{collection}/{slug} -> { collection: 'collection', slug: 'slug' }
 * /{slug} -> { collection: null, slug: 'slug' }
 *
 * @param pathname - URL pathname (e.g., from Astro.url.pathname)
 * @returns Object with collection (or null) and slug
 * @example
 * parseUrlPath('/capabilities/web-design')
 * // Returns: { collection: 'capabilities', slug: 'web-design' }
 *
 * parseUrlPath('/about-us')
 * // Returns: { collection: null, slug: 'about-us' }
 */
export function parseUrlPath(pathname: string): { collection: string | null; slug: string } {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { collection: null, slug: '' };
  }

  if (segments.length === 1) {
    return { collection: null, slug: segments[0] };
  }

  // Last segment is always the slug
  const slug = segments[segments.length - 1];
  // First segment is the collection
  const collection = segments[0];

  return { collection, slug };
}