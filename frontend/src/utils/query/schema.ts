// src/utils/query/schema.ts
/**
 * Schema Helpers for Relations
 * 
 * Provides schema definitions and validators for relationships.
 * These are pure Zod schemas - no astro:content imports at module level.
 */

import { z, reference } from 'astro:content';
import type { CollectionKey } from 'astro:content';

/**
 * Create a relation field schema for a collection
 * Supports single reference, array of references, or mixed
 */
export function relationSchema(targetCollection: CollectionKey | CollectionKey[]) {
  const collections = Array.isArray(targetCollection) ? targetCollection : [targetCollection];
  
  // Single reference
  const singleRef = z.union(
    collections.map(coll => reference(coll)) as any
  );
  
  // Array of references
  const arrayRef = z.array(singleRef);
  
  // Union of single or array
  return z.union([singleRef, arrayRef]).optional();
}

/**
 * Parent field schema for hierarchical relationships
 * Uses self-reference
 */
export function parentSchema(collection: CollectionKey) {
  return z.union([
    reference(collection),
    z.array(reference(collection))
  ]).optional();
}

/**
 * Create a full relational schema with common patterns
 */
export function createRelationalSchema(
  collection: CollectionKey,
  relations: Record<string, CollectionKey | CollectionKey[]>
) {
  const schema: Record<string, any> = {};
  
  // Add parent field if hierarchical
  schema.parent = parentSchema(collection);
  
  // Add relation fields
  for (const [field, targetCollection] of Object.entries(relations)) {
    schema[field] = relationSchema(targetCollection);
  }
  
  return schema;
}

/**
 * Extract relation configuration from a schema
 */
export interface RelationConfig {
  field: string;
  targetCollections: CollectionKey[];
  isArray: boolean;
}

/**
 * Parse schema to extract relation metadata
 */
export function extractRelationConfig(
  data: Record<string, any>
): RelationConfig[] {
  const configs: RelationConfig[] = [];
  
  for (const [field, value] of Object.entries(data)) {
    if (!value) continue;
    
    // Check if it's a reference
    if (isCollectionReference(value)) {
      configs.push({
        field,
        targetCollections: [value.collection],
        isArray: false,
      });
    }
    // Check if it's an array of references
    else if (Array.isArray(value) && value.every(isCollectionReference)) {
      const collections = [...new Set(value.map(v => v.collection))];
      configs.push({
        field,
        targetCollections: collections,
        isArray: true,
      });
    }
  }
  
  return configs;
}

/**
 * Normalize reference value to array
 */
export function normalizeReference(
  value: any
): Array<{ collection: CollectionKey; id: string }> {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(isCollectionReference);
  if (isCollectionReference(value)) return [value];
  return [];
}

/**
 * Check if a field is a parent field
 */
export function isParentField(field: string): boolean {
  return field === 'parent' || field === 'parentId' || field === 'parentRef';
}

/**
 * Type guard helper - exported for use in other modules
 */
export function isCollectionReference(value: any): value is { collection: CollectionKey; id: string } {
  return (
    value &&
    typeof value === 'object' &&
    'collection' in value &&
    'id' in value &&
    typeof value.collection === 'string' &&
    typeof value.id === 'string'
  );
}