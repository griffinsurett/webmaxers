// src/utils/query/query.ts
/**
 * Main Query Builder - FULLY LAZY
 * 
 * Fluent API for querying content collections with relations.
 * ALL astro:content imports are lazy to prevent circular dependencies.
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';
import { 
  type QueryOptions, 
  type QueryResult, 
  type FilterFn, 
  type SortFn,
  type SortConfig,
} from './types';
import { getRelations } from './relations';

// ❌ NO module-level imports of astro:content or filter/sort (they're pure functions, OK)
// ✅ Import pure utility functions (no astro:content in them)
import { applyFilters } from './filters';
import { applySorting, sortByOrder } from './sorting';

/**
 * Query builder class
 */
export class Query<T extends CollectionKey> {
  private _collection?: T | T[];
  private _filters: FilterFn<T>[] = [];
  private _sorts: Array<SortFn<T> | SortConfig> = [];
  private _limit?: number;
  private _offset: number = 0;
  private _includeRelations: boolean = false;
  private _maxDepth: number = 3;

  constructor(collection?: T | T[]) {
    this._collection = collection;
  }
  
  /**
   * Set collection(s) to query
   */
  from(collection: T | T[]): this {
    this._collection = collection;
    return this;
  }
  
  /**
   * Add filter condition
   */
  where(filter: FilterFn<T>): this {
    this._filters.push(filter);
    return this;
  }
  
  /**
   * Add multiple filters (AND logic)
   */
  whereAll(...filters: FilterFn<T>[]): this {
    this._filters.push(...filters);
    return this;
  }
  
  /**
   * Sort results
   */
  orderBy(sort: SortFn<T> | SortConfig): this {
    this._sorts.push(sort);
    return this;
  }
  
  /**
   * Limit number of results
   */
  limit(limit: number): this {
    this._limit = limit;
    return this;
  }
  
  /**
   * Skip number of results
   */
  offset(offset: number): this {
    this._offset = offset;
    return this;
  }
  
  /**
   * Include relation data in results
   */
  withRelations(include: boolean = true, maxDepth?: number): this {
    this._includeRelations = include;
    if (maxDepth !== undefined) {
      this._maxDepth = maxDepth;
    }
    return this;
  }

  /**
   * Execute query and return results
   */
  async get(): Promise<QueryResult<T>> {
    // ✅ Lazy import - use getPublishedCollection which excludes drafts
    const { getPublishedCollection } = await import('@/utils/collections');

    if (!this._collection) {
      throw new Error('Collection not specified');
    }

    // Get entries (drafts are automatically excluded)
    let entries: CollectionEntry<T>[];

    if (Array.isArray(this._collection)) {
      // Multiple collections
      entries = [];
      for (const coll of this._collection) {
        const collEntries = await getPublishedCollection(coll);
        entries.push(...(collEntries as CollectionEntry<T>[]));
      }
    } else {
      // Single collection
      entries = await getPublishedCollection(this._collection) as CollectionEntry<T>[];
    }
    
    // Apply filters
    if (this._filters.length > 0) {
      entries = applyFilters(entries, this._filters);
    }
    
    const total = entries.length;
    
    // Apply sorting (default to sortByOrder if no explicit sort specified)
    if (this._sorts.length > 0) {
      entries = applySorting(entries, this._sorts as any);
    } else {
      // Default: sort by order field ascending
      entries = applySorting(entries, sortByOrder());
    }
    
    // Apply pagination
    const start = this._offset;
    const end = this._limit ? start + this._limit : entries.length;
    const paginatedEntries = entries.slice(start, end);
    
    // Build result
    const result: QueryResult<T> = {
      entries: paginatedEntries,
      total,
    };
    
    // Add pagination metadata
    if (this._limit) {
      const pageSize = this._limit;
      const page = Math.floor(this._offset / pageSize) + 1;
      result.page = page;
      result.pageSize = pageSize;
      result.hasNext = end < entries.length;
      result.hasPrev = this._offset > 0;
    }
    
    // Include relations if requested
    if (this._includeRelations) {
      result.relations = new Map();
      
      for (const entry of paginatedEntries) {
        const collection = entry.collection as T;
        const id = entry.id;
        const relations = await getRelations(collection, id);
        result.relations.set(`${collection}:${id}`, relations);
      }
    }
    
    return result;
  }
  
  /**
   * Get first result
   */
  async first(): Promise<CollectionEntry<T> | undefined> {
    const working = this.clone();
    const result = await working.limit(1).get();
    return result.entries[0];
  }
  
  /**
   * Get all results (no pagination)
   */
  async all(): Promise<CollectionEntry<T>[]> {
    const working = this.clone();
    working._limit = undefined;
    working._offset = 0;
    const result = await working.get();
    return result.entries;
  }
  
  /**
   * Count results (without fetching)
   */
  async count(): Promise<number> {
    const working = this.clone();
    const result = await working.get();
    return result.total;
  }
  
  /**
   * Get collection name (for introspection)
   */
  getCollectionName(): T | T[] | null {
    return this._collection ?? null;
  }

  /**
   * Internal helper to clone query state so terminal operations
   * don't mutate the original builder
   */
  private clone(): Query<T> {
    const q = new Query<T>(this._collection);
    q._filters = [...this._filters];
    q._sorts = [...this._sorts];
    q._limit = this._limit;
    q._offset = this._offset;
    q._includeRelations = this._includeRelations;
    q._maxDepth = this._maxDepth;
    return q;
  }
}

/**
 * Create a new query
 */
export function query<T extends CollectionKey>(collection?: T | T[]): Query<T> {
  return new Query<T>(collection);
}

/**
 * Quick query helpers
 */
export async function find<T extends CollectionKey>(
  collection: T,
  id: string
): Promise<CollectionEntry<T> | undefined> {
  // ✅ Lazy import - use getPublishedCollection which excludes drafts
  const { getPublishedCollection } = await import('@/utils/collections');
  const entries = await getPublishedCollection(collection);
  return entries.find(e => e.id === id) as CollectionEntry<T> | undefined;
}

export async function findWhere<T extends CollectionKey>(
  collection: T,
  filter: FilterFn<T>
): Promise<CollectionEntry<T> | undefined> {
  return query(collection).where(filter).first();
}

export async function findAll<T extends CollectionKey>(
  collection: T,
  filter?: FilterFn<T>
): Promise<CollectionEntry<T>[]> {
  const q = query(collection);
  if (filter) q.where(filter);
  return q.all();
}
