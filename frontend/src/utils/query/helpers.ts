// src/utils/query/helpers.ts
/**
 * Helper utilities for the query system
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';

export function getQueryKey(entry: CollectionEntry<CollectionKey>): string {
  return normalizeId(entry.id);
}

/**
 * Normalize an ID string
 * Strips file extensions and trims whitespace
 */
export function normalizeId(id: string): string {
  return id
    .replace(/\.(mdx?|json)$/i, '')
    .trim();
}

/** The primary parent, shared by entry preparation and static page generation. */
export function getFirstParentId(parent: unknown): string | undefined {
  const ref = Array.isArray(parent) ? parent[0] : parent;
  const id = typeof ref === "string" ? ref : (ref as { id?: unknown } | null)?.id;
  return typeof id === "string" ? normalizeId(id) || undefined : undefined;
}

/**
 * Check if an entry exists in a collection
 */
export async function entryExists(
  collection: CollectionKey,
  id: string
): Promise<boolean> {
  try {
    const { getEntry } = await import('astro:content');
    const entry = await getEntry(collection, normalizeId(id));
    return !!entry;
  } catch {
    return false;
  }
}

/**
 * Safely get an entry, returning undefined if not found
 */
export async function safeGetEntry(
  collection: CollectionKey,
  id: string
): Promise<CollectionEntry<CollectionKey> | undefined> {
  try {
    const { getEntry } = await import('astro:content');
    return await getEntry(collection, normalizeId(id));
  } catch {
    return undefined;
  }
}
