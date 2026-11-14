// src/components/section/utils/queryIntrospection.ts
/**
 * Query Introspection for Section Component
 *
 * Extracts metadata from Query objects to auto-populate
 * Section titles and descriptions from collection meta.
 */

import type { Query } from '@/utils/query';  // ← Change this (not from /types)
import type { CollectionKey } from 'astro:content';

/**
 * Extract collection name from a Query object
 * Returns the collection for single-collection queries, or null for multi-collection
 */
export function getQueryCollection<T extends CollectionKey>(
  queryObj: Query<T>
): T | null {
  const collection = (queryObj as any)._collection;
  
  if (!collection) return null;
  
  // If array (multi-collection), return null
  if (Array.isArray(collection)) return null;
  
  return collection;
}
