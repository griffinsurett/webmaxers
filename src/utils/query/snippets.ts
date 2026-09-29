// src/utils/query/snippets.ts
/**
 * Query Snippets - Pre-built queries for common patterns
 * 
 * TODO: Implement these common query patterns
 * These will make it easier to reuse complex queries
 */

import { query, whereEquals, whereArrayContains, whereNoParent, sortByDate, sortByOrder, getLeaves, normalizeId, and, or } from '@/utils/query';
import type { CollectionKey } from 'astro:content';

// ============================================================================
// GENERAL PATTERNS
// ============================================================================

// TODO: Featured items from any collection
// export const featured = (collection: CollectionKey, limit = 10) =>
//   query(collection)
//     .where(whereArrayContains('tags', 'featured'))
//     .orderBy(sortByOrder())
//     .limit(limit);

// TODO: Recent items from any collection
// export const recent = (collection: CollectionKey, limit = 10) =>
//   query(collection)
//     .orderBy(sortByDate('publishDate', 'desc'))
//     .limit(limit);

export const byTag = <T extends CollectionKey>(collection: T, tags: string | string[], limit?: number) => {
  const tagList = (Array.isArray(tags) ? tags : [tags]).filter(Boolean);
  if (tagList.length === 0) {
    // No tags to match; return empty query
    return query(collection).where(() => false).limit(0);
  }

  const filter =
    tagList.length === 1
      ? whereArrayContains('tags', tagList[0])
      : or(...tagList.map((tag) => whereArrayContains('tags', tag)));

  const q = query(collection).where(filter);
  if (typeof limit === "number") {
    q.limit(limit);
  }
  return q;
};

/**
 * Get specific items by their keys (slugs/ids), preserving the order provided.
 * Supports a single key or an array of keys.
 *
 * Example: byItemKeys("about-us", "our-mission")
 * Example: byItemKeys("about-us", ["our-mission", "our-vision"])
 */
export const byItemKeys = <T extends CollectionKey>(collection: T, keys: string | string[]) => {
  const keyList = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (keyList.length === 0) {
    return query(collection).where(() => false).limit(0);
  }

  const normalizedKeys = keyList.map(normalizeId);
  const keySet = new Set(normalizedKeys);

  return query(collection)
    .where((entry) => {
      const entryKey = normalizeId(entry.id);
      return keySet.has(entryKey);
    })
    .orderBy((a, b) => {
      // Preserve the order from the keys array
      const aKey = normalizeId(a.id);
      const bKey = normalizeId(b.id);
      return normalizedKeys.indexOf(aKey) - normalizedKeys.indexOf(bKey);
    });
};

// TODO: Items by author
// export const byAuthor = (collection: CollectionKey, authorId: string, limit?: number) => {}

// ============================================================================
// HIERARCHICAL QUERIES
// ============================================================================

/**
 * Root level items only (no parent)
 */
export const roots = <T extends CollectionKey>(collection: T) =>
  query(collection)
    .where(whereNoParent())
    .orderBy(sortByOrder());

/**
 * Leaves (items with no children)
 */
export const leaves = async (collection: CollectionKey) => {
  const entries = await getLeaves(collection);
  return entries.sort(sortByOrder());
};

/**
 * Children of a specific parent
 */
export const children = <T extends CollectionKey>(collection: T, parentId: string) => {
  // Guard against missing/undefined parent ids so the query doesn't crash
  const targetId = parentId ? normalizeId(parentId) : "";
  if (!targetId) {
    // No parent means no children to fetch
    return query(collection).where(() => false);
  }
  return query(collection)
    .where((entry) => {
      const parent = (entry.data as any).parent;
      if (!parent) return false;

      if (Array.isArray(parent)) {
        return parent.some((p) => {
          const id = typeof p === "string" ? p : p?.id || "";
          return normalizeId(id) === targetId;
        });
      }

      const id = typeof parent === "string" ? parent : parent?.id || parent?.slug || "";
      return normalizeId(id) === targetId;
    })
    .orderBy(sortByOrder());
};

/**
 * Parent(s) of a specific child
 */
export const parent = (
  collection: CollectionKey,
  child?: { data?: any; parent?: any; id?: string; slug?: string } | string
) => {
  // Pull parent info either from explicit string or the child entry's data/parent fields
  const parentField =
    typeof child === "string"
      ? child
      : child
      ? (child as any).data?.parent ?? (child as any).parent
      : undefined;

  const parentRefs = Array.isArray(parentField)
    ? parentField
    : parentField
    ? [parentField]
    : [];

  const targetIds = parentRefs
    .map((p) => (typeof p === "string" ? p : p?.id || ""))
    .filter(Boolean)
    .map(normalizeId);

  if (targetIds.length === 0) {
    // No parent data; return empty result
    return query(collection).where(() => false).limit(0);
  }

  return query(collection)
    .where((entry) => {
      const id = normalizeId(entry.id);
      return targetIds.includes(id);
    })
    .orderBy(sortByOrder());
};

/**
 * Get siblings (entries with the same parent) for a given item.
 * Requires the full entry so we can read parent data synchronously.
 */
export const siblings = (
  collection: CollectionKey,
  item?: { data?: any; parent?: any; id?: string; slug?: string }
) => {
  const targetId = item ? normalizeId((item as any).id || (item as any).slug || "") : "";

  const parentField = item ? (item as any).data?.parent ?? (item as any).parent : undefined;

  const parentRefs = Array.isArray(parentField)
    ? parentField
    : parentField
    ? [parentField]
    : [];

  const targetParentIds = parentRefs
    .map((p) => (typeof p === "string" ? p : p?.id || ""))
    .filter(Boolean)
    .map(normalizeId);

  if (targetParentIds.length === 0) {
    // No parent info; can't determine siblings
    return query(collection).where(() => false).limit(0);
  }

  const parentIdSet = new Set(targetParentIds);

  return query(collection)
    .where((entry) => {
      // Exclude the target item itself when possible
      if (targetId && normalizeId(entry.id) === targetId) {
        return false;
      }

      const parent = (entry.data as any).parent;
      if (!parent) return false;

      if (Array.isArray(parent)) {
        return parent.some((p) => {
          const id = typeof p === "string" ? p : p?.id || "";
          return id && parentIdSet.has(normalizeId(id));
        });
      }

      const id = typeof parent === "string" ? parent : parent?.id || parent?.slug || "";
      return Boolean(id && parentIdSet.has(normalizeId(id)));
    })
    .orderBy(sortByOrder());
};

// TODO: Items at specific depth
// export const atDepth = (collection: CollectionKey, depth: number) => {}

// ============================================================================
// RELATIONAL QUERIES
// ============================================================================

/**
 * Filter function for matching a reference field to a target ID.
 * Handles both single refs and arrays of refs.
 */
const matchesRef = (fieldValue: any, targetNormalized: string): boolean => {
  if (!fieldValue) return false;

  if (Array.isArray(fieldValue)) {
    return fieldValue.some((ref: any) => {
      const id = typeof ref === "string" ? ref : ref?.id || ref?.slug || "";
      return normalizeId(id) === targetNormalized;
    });
  }

  const id = typeof fieldValue === "string" ? fieldValue : fieldValue?.id || fieldValue?.slug || "";
  return normalizeId(id) === targetNormalized;
};

/**
 * Items from a collection that reference a specific entry via a field.
 *
 * Example: Get capabilities related to the "blogs" solution
 * related("capabilities", "solutions", "blogs")
 *
 * @param collection - The collection to query (e.g., "capabilities")
 * @param field - The reference field name (e.g., "solutions")
 * @param targetId - The ID of the target entry (e.g., "blogs")
 */
export const related = <T extends CollectionKey>(
  collection: T,
  field: string,
  targetId: string
) => {
  const targetNormalized = normalizeId(targetId);

  return query(collection)
    .where((entry) => matchesRef((entry.data as any)[field], targetNormalized))
    .orderBy(sortByOrder());
};

/**
 * Root-level items (no parent) that reference a specific entry via a field.
 *
 * Example: Get root capabilities related to the "blogs" solution
 * relatedRoots("capabilities", "solutions", "blogs")
 *
 * @param collection - The collection to query (e.g., "capabilities")
 * @param field - The reference field name (e.g., "solutions")
 * @param targetId - The ID of the target entry (e.g., "blogs")
 */
export const relatedRoots = <T extends CollectionKey>(
  collection: T,
  field: string,
  targetId: string
) => {
  const targetNormalized = normalizeId(targetId);

  return query(collection)
    .where((entry) => {
      const data = entry.data as any;
      // Must have no parent AND match the reference
      const hasNoParent = !data.parent || (Array.isArray(data.parent) && data.parent.length === 0);
      return hasNoParent && matchesRef(data[field], targetNormalized);
    })
    .orderBy(sortByOrder());
};

/**
 * Items from a collection that have any reference to a target collection.
 *
 * Example: Get all capabilities that reference any solution
 * withReferencesTo("capabilities", "solutions")
 *
 * @param collection - The collection to query (e.g., "capabilities")
 * @param field - The reference field name (e.g., "solutions")
 */
export const withReferencesTo = (
  collection: CollectionKey,
  field: string
) => {
  return query(collection)
    .where((entry) => {
      const data = entry.data as any;
      const fieldValue = data[field];

      // Check if field has any value (not null, undefined, or empty array)
      if (!fieldValue) return false;
      if (Array.isArray(fieldValue)) return fieldValue.length > 0;
      return true;
    })
    .orderBy(sortByOrder());
}

// ============================================================================
// CROSS-COLLECTION
// ============================================================================

// TODO: All content from multiple collections
// export const allContent = (collections: CollectionKey[], limit = 20) => {}

// TODO: Search across collections
// export const searchContent = (searchTerm: string, collections?: CollectionKey[]) => {}

// ============================================================================
// UTILITY EXPORTS (for when implemented)
// ============================================================================

export const snippets = {

};
