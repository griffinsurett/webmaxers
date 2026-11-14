// src/utils/query/filters.ts
/**
 * Filtering Utilities
 * 
 * Type-safe filtering functions for query operations.
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';
import type { FilterFn } from './types';

/**
 * Create a filter for a specific field value
 */
export function whereEquals<T extends CollectionKey>(
  field: string,
  value: any
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    return data[field] === value;
  };
}

/**
 * Create a filter for field existence
 */
export function whereExists<T extends CollectionKey>(field: string): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    return data[field] !== undefined && data[field] !== null;
  };
}

/**
 * Create a filter for field value in array
 */
export function whereIn<T extends CollectionKey>(
  field: string,
  values: any[]
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    return values.includes(data[field]);
  };
}

/**
 * Create a filter for string contains
 */
export function whereContains<T extends CollectionKey>(
  field: string,
  substring: string,
  caseSensitive: boolean = false
): FilterFn<T> {
  const search = caseSensitive ? substring : substring.toLowerCase();
  
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const value = String(data[field] || '');
    const target = caseSensitive ? value : value.toLowerCase();
    return target.includes(search);
  };
}

/**
 * Create a filter for string starts with
 */
export function whereStartsWith<T extends CollectionKey>(
  field: string,
  prefix: string,
  caseSensitive: boolean = false
): FilterFn<T> {
  const search = caseSensitive ? prefix : prefix.toLowerCase();
  
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const value = String(data[field] || '');
    const target = caseSensitive ? value : value.toLowerCase();
    return target.startsWith(search);
  };
}

/**
 * Create a filter for numeric comparison
 */
export function whereGreaterThan<T extends CollectionKey>(
  field: string,
  value: number
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    return Number(data[field]) > value;
  };
}

export function whereLessThan<T extends CollectionKey>(
  field: string,
  value: number
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    return Number(data[field]) < value;
  };
}

export function whereBetween<T extends CollectionKey>(
  field: string,
  min: number,
  max: number
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const value = Number(data[field]);
    return value >= min && value <= max;
  };
}

/**
 * Create a filter for date comparison
 */
export function whereAfter<T extends CollectionKey>(
  field: string,
  date: Date | string
): FilterFn<T> {
  const compareDate = new Date(date);
  
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const entryDate = new Date(data[field]);
    return entryDate > compareDate;
  };
}

export function whereBefore<T extends CollectionKey>(
  field: string,
  date: Date | string
): FilterFn<T> {
  const compareDate = new Date(date);
  
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const entryDate = new Date(data[field]);
    return entryDate < compareDate;
  };
}

/**
 * Create a filter for array field contains value
 * Supports both array fields and single string values
 */
export function whereArrayContains<T extends CollectionKey>(
  field: string,
  value: any
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const fieldValue = data[field];

    // Handle array field
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(value);
    }

    // Handle single string value (treat as array of one)
    if (typeof fieldValue === 'string') {
      return fieldValue === value;
    }

    return false;
  };
}

/**
 * Create a filter for array field contains any of values
 */
export function whereArrayContainsAny<T extends CollectionKey>(
  field: string,
  values: any[]
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const arr = data[field];
    return Array.isArray(arr) && arr.some(item => values.includes(item));
  };
}

/**
 * Filter entries that do not have a parent (string, reference, or array)
 */
export function whereNoParent<T extends CollectionKey>(
  field: string = 'parent'
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    const data = entry.data as any;
    const parent = data[field];

    if (Array.isArray(parent)) {
      return parent.length === 0;
    }

    return !parent;
  };
}

/**
 * Logical combinators
 */
export function and<T extends CollectionKey>(
  ...filters: FilterFn<T>[]
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    return filters.every(filter => filter(entry));
  };
}

export function or<T extends CollectionKey>(
  ...filters: FilterFn<T>[]
): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    return filters.some(filter => filter(entry));
  };
}

export function not<T extends CollectionKey>(filter: FilterFn<T>): FilterFn<T> {
  return (entry: CollectionEntry<T>) => {
    return !filter(entry);
  };
}

/**
 * Apply filters to entries
 */
export function applyFilters<T extends CollectionKey>(
  entries: CollectionEntry<T>[],
  filters: FilterFn<T> | FilterFn<T>[]
): CollectionEntry<T>[] {
  const filterArray = Array.isArray(filters) ? filters : [filters];
  
  return entries.filter(entry => {
    return filterArray.every(filter => filter(entry));
  });
}
