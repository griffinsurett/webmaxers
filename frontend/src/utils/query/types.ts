// src/utils/query/types.ts
/**
 * Core Type Definitions for the Query System
 * 
 * Provides type-safe interfaces for the entire querying system.
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';

/**
 * Relationship types in the system
 */
export type RelationType = 
  | 'reference'      // Direct reference (A → B)
  | 'referenced-by'  // Reverse reference (B ← A)
  | 'parent'         // Hierarchical parent
  | 'child'          // Hierarchical child
  | 'sibling'        // Same parent
  | 'ancestor'       // Any level up
  | 'descendant'     // Any level down
  | 'indirect';      // Multi-hop relation (A → B → C)

/**
 * A single relationship between two entries
 */
export interface Relation<T extends CollectionKey = CollectionKey> {
  type: RelationType;
  collection: T;
  id: string;
  field?: string;           // Which field contains the reference
  depth?: number;           // For indirect relations
  path?: string[];          // Path of collections for indirect relations
  entry?: CollectionEntry<T>; // Resolved entry (lazy loaded)
}

/**
 * Complete relationship map for an entry
 */
export interface RelationMap<T extends CollectionKey = CollectionKey> {
  entry: CollectionEntry<T>;
  
  // Direct relations
  references: Relation[];           // What this entry references
  referencedBy: Relation[];         // What references this entry
  
  // Hierarchical relations
  parent?: Relation;                // Direct parent
  parents: Relation[];              // All direct parents (multi-parent support)
  children: Relation[];             // Direct children
  siblings: Relation[];             // Same parent
  ancestors: Relation[];            // All parents up the tree
  descendants: Relation[];          // All children down the tree
  
  // Indirect relations
  indirect: Relation[];             // Multi-hop relations
  
  // Metadata
  depth: number;                    // Depth in hierarchy (0 = root)
  hasChildren: boolean;
  isRoot: boolean;
  isLeaf: boolean;
}

/**
 * Query filter function
 */
export type FilterFn<T extends CollectionKey = CollectionKey> = (
  entry: CollectionEntry<T>
) => boolean;

/**
 * Query sort function
 */
export type SortFn<T extends CollectionKey = CollectionKey> = (
  a: CollectionEntry<T>,
  b: CollectionEntry<T>
) => number;

/**
 * Query options
 */
export interface QueryOptions<T extends CollectionKey = CollectionKey> {
  collection?: T | T[];
  filter?: FilterFn<T> | FilterFn<T>[];
  sort?: SortFn<T> | SortFn<T>[] | SortConfig[];
  limit?: number;
  offset?: number;
  includeRelations?: boolean;
  maxDepth?: number;              // For indirect relations
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  nullsFirst?: boolean;
}

/**
 * Query result with metadata
 */
export interface QueryResult<T extends CollectionKey = CollectionKey> {
  entries: CollectionEntry<T>[];
  total: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  relations?: Map<string, RelationMap>;
}

/**
 * Relationship graph for the entire system
 */
export interface RelationshipGraph {
  // Collection → Entry ID → Relations
  nodes: Map<string, Map<string, RelationMap>>;
  
  // Quick lookup indexes
  indexes: {
    byCollection: Map<CollectionKey, Set<string>>;
    byParent: Map<string, Set<string>>;
    byReference: Map<string, Set<string>>;
  };
  
  // Metadata
  collections: CollectionKey[];
  totalEntries: number;
}

/**
 * Graph build options
 */
export interface GraphBuildOptions {
  collections?: CollectionKey[];
  includeIndirect?: boolean;
  maxIndirectDepth?: number;
  cache?: boolean;
  verbose?: boolean;
}

/**
 * Helper type for entry reference
 */
export interface EntryReference {
  collection: CollectionKey;
  id: string;
}

/**
 * Helper to create unique entry key
 */
export function getEntryKey(collection: CollectionKey, id: string): string {
  return `${collection}:${id}`;
}

/**
 * Helper to parse entry key
 */
export function parseEntryKey(key: string): EntryReference {
  const [collection, id] = key.split(':');
  return { collection: collection as CollectionKey, id };
}

/**
 * Type guard for collection reference
 */
export function isCollectionReference(value: any): value is EntryReference {
  return (
    value &&
    typeof value === 'object' &&
    'collection' in value &&
    'id' in value
  );
}
