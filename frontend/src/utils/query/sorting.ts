// src/utils/query/sorting.ts
/**
 * Sorting Utilities
 * 
 * Type-safe sorting functions for query operations.
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';
import type { SortFn, SortConfig } from './types';

/**
 * Create a sort function for a field
 */
export function sortBy<T extends CollectionKey>(
  field: string,
  direction: 'asc' | 'desc' = 'asc'
): SortFn<T> {
  return (a: CollectionEntry<T>, b: CollectionEntry<T>) => {
    const aData = a.data as any;
    const bData = b.data as any;
    const aValue = aData[field];
    const bValue = bData[field];
    
    // Handle null/undefined
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === 'asc' ? 1 : -1;
    if (bValue == null) return direction === 'asc' ? -1 : 1;
    
    // Compare values
    let result = 0;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      result = aValue.localeCompare(bValue);
    } else if (aValue instanceof Date && bValue instanceof Date) {
      result = aValue.getTime() - bValue.getTime();
    } else {
      result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
    
    return direction === 'asc' ? result : -result;
  };
}

/**
 * Sort by publish date (most recent first)
 */
export function sortByDate<T extends CollectionKey>(
  field: string = 'publishDate',
  direction: 'asc' | 'desc' = 'desc'
): SortFn<T> {
  return (a: CollectionEntry<T>, b: CollectionEntry<T>) => {
    const aData = a.data as any;
    const bData = b.data as any;
    const aDate = aData[field] ? new Date(aData[field]) : null;
    const bDate = bData[field] ? new Date(bData[field]) : null;
    const aValid = aDate instanceof Date && isFinite(aDate.getTime());
    const bValid = bDate instanceof Date && isFinite(bDate.getTime());
    
    if (!aValid && !bValid) return 0;
    if (!aValid) return direction === 'desc' ? 1 : -1;
    if (!bValid) return direction === 'desc' ? -1 : 1;
    
    const diff = aDate!.getTime() - bDate!.getTime();
    return direction === 'asc' ? diff : -diff;
  };
}

/**
 * Sort by title (alphabetically)
 */
export function sortByTitle<T extends CollectionKey>(
  direction: 'asc' | 'desc' = 'asc'
): SortFn<T> {
  return sortBy('title', direction);
}

/**
 * Sort by order field
 */
export function sortByOrder<T extends CollectionKey>(
  direction: 'asc' | 'desc' = 'asc'
): SortFn<T> {
  return sortBy('order', direction);
}

/**
 * Create a multi-level sort function
 */
export function sortByMultiple<T extends CollectionKey>(
  ...sortFns: SortFn<T>[]
): SortFn<T> {
  return (a: CollectionEntry<T>, b: CollectionEntry<T>) => {
    for (const sortFn of sortFns) {
      const result = sortFn(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/**
 * Create sort function from config
 */
export function createSortFn<T extends CollectionKey>(
  config: SortConfig
): SortFn<T> {
  return sortBy(config.field, config.direction);
}

/**
 * Apply sorting to entries
 */
export function applySorting<T extends CollectionKey>(
  entries: CollectionEntry<T>[],
  sort: SortFn<T> | SortFn<T>[] | SortConfig[] | Array<SortFn<T> | SortConfig>
): CollectionEntry<T>[] {
  // Handle empty sort
  if (!sort || (Array.isArray(sort) && sort.length === 0)) {
    return entries;
  }
  
  // Single sort function
  if (typeof sort === 'function') {
    return [...entries].sort(sort);
  }
  
  // Array of items - need to check if they're configs or functions
  if (Array.isArray(sort)) {
    // Check if first item is a config
    if (sort.length > 0 && typeof sort[0] === 'object' && 'field' in sort[0]) {
      // All configs
      const sortFns = (sort as SortConfig[]).map(config => createSortFn<T>(config));
      return [...entries].sort(sortByMultiple(...sortFns));
    }
    
    // Check if it's a mixed array
    const hasMixed = sort.some(s => typeof s === 'object' && 'field' in s);
    if (hasMixed) {
      // Convert all to functions
      const sortFns = sort.map(s => 
        typeof s === 'function' ? s : createSortFn<T>(s as SortConfig)
      );
      return [...entries].sort(sortByMultiple(...(sortFns as SortFn<T>[])));
    }
    
    // All functions
    return [...entries].sort(sortByMultiple(...(sort as SortFn<T>[])));
  }
  
  return entries;
}
