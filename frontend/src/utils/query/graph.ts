// src/utils/query/graph.ts
/**
 * Relationship Graph Builder - FULLY LAZY WITH COMPLETE FUNCTIONALITY
 *
 * Builds a complete relationship graph for all content collections.
 * Handles direct references, hierarchical relations, and indirect connections.
 * ALL astro:content imports are lazy to prevent circular dependencies.
 */

import type { CollectionEntry, CollectionKey } from "astro:content";
import {
  type RelationshipGraph,
  type RelationMap,
  type Relation,
  type GraphBuildOptions,
  getEntryKey,
  parseEntryKey,
} from "./types";
import { getQueryKey, normalizeId } from "./helpers";

// ❌ NO module-level imports of astro:content or anything that imports it

const _graphCache: Map<string, RelationshipGraph> = new Map();

function getGraphCacheKey(options: GraphBuildOptions = {}): string {
  const {
    collections,
    includeIndirect = true,
    maxIndirectDepth = 3,
  } = options;
  
  const collKey = collections
    ? [...collections].sort().join(',')
    : 'all';
  
  return [
    collKey,
    `indirect:${includeIndirect}`,
    includeIndirect ? `depth:${maxIndirectDepth}` : 'depth:0',
  ].join('|');
}

/**
 * Get or build the relationship graph
 */
export async function getOrBuildGraph(
  options?: GraphBuildOptions
): Promise<RelationshipGraph> {
  const cacheKey = getGraphCacheKey(options ?? {});
  
  if (options?.cache !== false) {
    const cached = _graphCache.get(cacheKey);
    if (cached) return cached;
  }

  const graph = await buildRelationshipGraph(options);
  
  if (options?.cache !== false) {
    _graphCache.set(cacheKey, graph);
  }
  
  return graph;
}

/**
 * Clear cached graph
 */
export function clearGraphCache(): void {
  _graphCache.clear();
}

/**
 * Build the complete relationship graph
 */
export async function buildRelationshipGraph(
  options: GraphBuildOptions = {}
): Promise<RelationshipGraph> {
  // ✅ Lazy import everything - use getPublishedCollection to exclude drafts
  const { getPublishedCollection } = await import("@/utils/collections");
  const { extractRelationConfig, normalizeReference, isParentField } =
    await import("./schema");

  // Get collection names without importing collections utilities that might have circular deps
  const { collections } = await import("@/content.config");
  // Include all collections in the relationship graph (menus/menu-items included)
  const allCollections = Object.keys(collections) as CollectionKey[];

  const {
    collections: requestedCollections = allCollections,
    includeIndirect = true,
    maxIndirectDepth = 3,
  } = options;

  // Initialize graph
  const graph: RelationshipGraph = {
    nodes: new Map(),
    indexes: {
      byCollection: new Map(),
      byParent: new Map(),
      byReference: new Map(),
    },
    collections: requestedCollections,
    totalEntries: 0,
  };

  // Phase 1: Load all entries and create base nodes
  const verbose = options.verbose ?? false;
  if (verbose) console.log("📊 Building relationship graph...");
  await loadAllEntries(graph, requestedCollections, getPublishedCollection);

  // Phase 2: Build direct references
  if (verbose) console.log("🔗 Mapping direct references...");
  await buildDirectReferences(
    graph,
    extractRelationConfig,
    normalizeReference,
    isParentField
  );

  // Phase 3: Build hierarchical relationships
  if (verbose) console.log("🌲 Building hierarchy...");
  await buildHierarchy(graph, normalizeReference);

  // Phase 4: Build indirect relationships
  if (includeIndirect) {
    if (verbose) console.log("🔄 Finding indirect relations...");
    await buildIndirectRelations(graph, maxIndirectDepth);
  }

  if (verbose) {
    console.log(
      `✅ Graph built: ${graph.totalEntries} entries, ${graph.collections.length} collections`
    );
  }

  return graph;
}

/**
 * Phase 1: Load all entries and create base relation maps
 */
async function loadAllEntries(
  graph: RelationshipGraph,
  collections: CollectionKey[],
  getPublishedCollection: (collection: CollectionKey) => Promise<any[]>
): Promise<void> {
  for (const collection of collections) {
    const entries = await getPublishedCollection(collection);
    const collectionMap = new Map<string, RelationMap>();
    const idSet = new Set<string>();

    for (const entry of entries) {
      // Use getQueryKey for consistent ID handling
      const id = getQueryKey(entry);

      // Create base relation map with full structure
      const relationMap: RelationMap = {
        entry,
        references: [],
        referencedBy: [],
        parent: undefined,
        parents: [],
        children: [],
        siblings: [],
        ancestors: [],
        descendants: [],
        indirect: [],
        depth: 0,
        hasChildren: false,
        isRoot: true,
        isLeaf: true,
      };

      collectionMap.set(id, relationMap);
      idSet.add(id);
      graph.totalEntries++;
    }

    graph.nodes.set(collection, collectionMap);
    graph.indexes.byCollection.set(collection, idSet);
  }
}

/**
 * Phase 2: Build direct reference relationships
 */
async function buildDirectReferences(
  graph: RelationshipGraph,
  extractRelationConfig: any,
  normalizeReference: any,
  isParentField: any
): Promise<void> {
  for (const [collection, collectionMap] of graph.nodes) {
    for (const [id, relationMap] of collectionMap) {
      const entry = relationMap.entry;
      const data = entry.data as any;

      // Extract all relation fields
      const relationConfigs = extractRelationConfig(data);

      for (const config of relationConfigs) {
        // Skip parent fields (handled in hierarchy phase)
        if (isParentField(config.field)) continue;

        const refs = normalizeReference(data[config.field]);

        for (const ref of refs) {
          // Normalize the reference ID
          const refId = normalizeId(ref.id);

          // Add forward reference
          relationMap.references.push({
            type: "reference",
            collection: ref.collection,
            id: refId,
            field: config.field,
          });

          // Add reverse reference
          const targetMap = graph.nodes.get(ref.collection)?.get(refId);
          if (targetMap) {
            targetMap.referencedBy.push({
              type: "referenced-by",
              collection: collection as CollectionKey,
              id,
              field: config.field,
            });
          }

          // Index reference
          const refKey = getEntryKey(ref.collection, refId);
          const entryKey = getEntryKey(collection as CollectionKey, id);

          if (!graph.indexes.byReference.has(refKey)) {
            graph.indexes.byReference.set(refKey, new Set());
          }
          graph.indexes.byReference.get(refKey)!.add(entryKey);
        }
      }
    }
  }
}

/**
 * Phase 3: Build hierarchical relationships (parent-child)
 */
async function buildHierarchy(
  graph: RelationshipGraph,
  normalizeReference: any
): Promise<void> {
  // First pass: establish parent-child links
  for (const [collection, collectionMap] of graph.nodes) {
    for (const [id, relationMap] of collectionMap) {
      const data = relationMap.entry.data as any;
      const parentRefs = normalizeReference(data.parent);

      // Support multiple parents; guard against duplicate/invalid references
      for (const parentRef of parentRefs) {
        if (parentRef.collection !== collection) continue;
        const parentId = normalizeId(parentRef.id);
        const parentMap = collectionMap.get(parentId);

        if (!parentMap) continue;

        const parentRelation: Relation = {
          type: "parent",
          collection: collection as CollectionKey,
          id: parentId,
        };
        const hasParentAlready = relationMap.parents.some(
          (rel) => rel.collection === parentRelation.collection && rel.id === parentRelation.id
        );
        if (!hasParentAlready) {
          relationMap.parents.push(parentRelation);
        }

        // Set primary parent (first valid one) for depth calculations if not already set
        if (!relationMap.parent) {
          relationMap.parent = parentRelation;
          relationMap.isRoot = false;
        }

        // Add child to each valid parent
        parentMap.children.push({
          type: "child",
          collection: collection as CollectionKey,
          id,
        });

        parentMap.hasChildren = true;
        parentMap.isLeaf = false;

        // Index parent relationship
        const parentKey = getEntryKey(collection as CollectionKey, parentId);
        if (!graph.indexes.byParent.has(parentKey)) {
          graph.indexes.byParent.set(parentKey, new Set());
        }
        graph.indexes.byParent.get(parentKey)!.add(id);
      }
    }
  }

  // Second pass: calculate depth and find ancestors/descendants
  for (const [collection, collectionMap] of graph.nodes) {
    for (const [id, relationMap] of collectionMap) {
      // Calculate depth and ancestors (supports multi-parent)
      calculateAncestors(relationMap, collectionMap);

      // Calculate descendants
      calculateDescendants(relationMap, collectionMap);

      // Find siblings across all parents
      if (relationMap.parents.length > 0) {
        const siblingSet = new Map<string, Relation>();
        for (const parentRel of relationMap.parents) {
          const parentMap = collectionMap.get(parentRel.id);
          if (!parentMap) continue;
          for (const child of parentMap.children) {
            if (child.id === id) continue;
            const key = `${child.collection}:${child.id}`;
            if (!siblingSet.has(key)) {
              siblingSet.set(key, child);
            }
          }
        }
        relationMap.siblings = Array.from(siblingSet.values());
      }
    }
  }
}

/**
 * Calculate ancestors and depth
 */
function calculateAncestors(
  relationMap: RelationMap,
  collectionMap: Map<string, RelationMap>
): void {
  const ancestors: Relation[] = [];
  const visited = new Set<string>();
  const queue: Array<{ rel: Relation; depth: number }> = relationMap.parents.map((rel) => ({ rel, depth: 1 }));
  let minDepth = relationMap.parents.length === 0 ? 0 : Infinity;

  while (queue.length > 0) {
    const { rel, depth } = queue.shift()!;
    const key = `${rel.collection}:${rel.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    ancestors.push({
      ...rel,
      type: "ancestor",
      depth,
    });

    const parentMap = collectionMap.get(rel.id);
    if (parentMap && parentMap.parents.length > 0) {
      for (const parentRel of parentMap.parents) {
        queue.push({ rel: parentRel, depth: depth + 1 });
      }
    } else {
      minDepth = Math.min(minDepth, depth);
    }
  }

  relationMap.ancestors = ancestors;
  relationMap.depth = minDepth === Infinity ? 0 : minDepth;
  relationMap.isRoot = relationMap.parents.length === 0;
}

/**
 * Calculate descendants recursively
 */
function calculateDescendants(
  relationMap: RelationMap,
  collectionMap: Map<string, RelationMap>
): void {
  const descendants: Relation[] = [];
  const visited = new Set<string>();

  function traverse(childIds: Relation[], depth: number): void {
    for (const child of childIds) {
      const key = `${child.collection}:${child.id}`;
      if (visited.has(key)) continue;
      visited.add(key);

      descendants.push({
        ...child,
        type: "descendant",
        depth,
      });

      const childMap = collectionMap.get(child.id);
      if (childMap && childMap.children.length > 0) {
        traverse(childMap.children, depth + 1);
      }
    }
  }

  traverse(relationMap.children, 1);
  relationMap.descendants = descendants;
}

/**
 * Phase 4: Build indirect relationships (multi-hop)
 */
async function buildIndirectRelations(
  graph: RelationshipGraph,
  maxDepth: number
): Promise<void> {
  for (const [collection, collectionMap] of graph.nodes) {
    for (const [id, relationMap] of collectionMap) {
      const entryKey = getEntryKey(collection as CollectionKey, id);
      const visited = new Set<string>([entryKey]);
      const indirect: Relation[] = [];

      // BFS to find indirect relations
      const queue: Array<{ key: string; path: string[]; depth: number }> = [];

      // Start with direct references
      for (const ref of relationMap.references) {
        const refKey = getEntryKey(ref.collection, ref.id);
        queue.push({
          key: refKey,
          path: [collection as string, ref.collection],
          depth: 1,
        });
      }

      while (queue.length > 0) {
        const { key, path, depth } = queue.shift()!;

        if (depth >= maxDepth) continue;
        if (visited.has(key)) continue;

        visited.add(key);
        const { collection: currentColl, id: currentId } = parseEntryKey(key);
        const currentMap = graph.nodes.get(currentColl)?.get(currentId);

        if (!currentMap) continue;

        // Add as indirect relation
        if (depth > 1) {
          indirect.push({
            type: "indirect",
            collection: currentColl,
            id: currentId,
            depth,
            path,
          });
        }

        // Queue next level
        for (const ref of currentMap.references) {
          const refKey = getEntryKey(ref.collection, ref.id);
          if (!visited.has(refKey)) {
            queue.push({
              key: refKey,
              path: [...path, ref.collection],
              depth: depth + 1,
            });
          }
        }
      }

      relationMap.indirect = indirect;
    }
  }
}

/**
 * Get relation map for a specific entry
 */
export function getRelationMap(
  graph: RelationshipGraph,
  collection: CollectionKey,
  id: string
): RelationMap | undefined {
  const cleanId = normalizeId(id);
  return graph.nodes.get(collection)?.get(cleanId);
}

/**
 * Get all entries in a collection
 */
export function getCollectionEntries(
  graph: RelationshipGraph,
  collection: CollectionKey
): CollectionEntry<CollectionKey>[] {
  const collectionMap = graph.nodes.get(collection);
  if (!collectionMap) return [];

  return Array.from(collectionMap.values()).map((rm) => rm.entry);
}
