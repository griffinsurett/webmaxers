// src/utils/query/hierarchy.ts
/**
 * Hierarchical Query Utilities - FULLY LAZY
 * 
 * Functions for querying parent-child relationships and tree structures.
 * ALL astro:content imports are lazy to prevent circular dependencies.
 */

import type { CollectionEntry, CollectionKey } from 'astro:content';
import type { Relation, RelationMap } from './types';
import { getRelations, resolveRelations } from './relations';
import { getOrBuildGraph, getRelationMap } from './graph';
import { normalizeId, getFirstParentId } from './helpers';

// ❌ NO module-level imports of astro:content

/**
 * Get parent entry
 */
export async function getParent<T extends CollectionKey>(
  collection: T,
  id: string,
  resolve: boolean = false
): Promise<Relation | undefined> {
  const cleanId = normalizeId(id);
  const relationMap = await getRelations(collection, cleanId, ['parent']);
  const parent = relationMap.parent;
  
  if (parent && resolve && !parent.entry) {
    // ✅ Lazy import
    const { getEntry } = await import('astro:content');
    try {
      parent.entry = await getEntry(parent.collection, normalizeId(parent.id));
    } catch (error) {
      console.warn(`Failed to resolve parent ${parent.collection}/${parent.id}`);
    }
  }
  
  return parent;
}

/**
 * Get all children entries
 */
export async function getChildren<T extends CollectionKey>(
  collection: T,
  id: string,
  options: {
    resolve?: boolean;
    recursive?: boolean;
    maxDepth?: number;
  } = {}
): Promise<Relation[]> {
  const { resolve = false, recursive = false, maxDepth = Infinity } = options;
  const cleanId = normalizeId(id);
  
  if (recursive) {
    return getDescendants(collection, cleanId, { resolve, maxDepth });
  }
  
  const relationMap = await getRelations(collection, cleanId, ['child']);
  const children = relationMap.children;
  
  if (resolve) {
    await resolveRelations(children);
  }
  
  return children;
}

/**
 * Get all ancestors (parents up the tree)
 */
export async function getAncestors<T extends CollectionKey>(
  collection: T,
  id: string,
  options: {
    resolve?: boolean;
    includeRoot?: boolean;
  } = {}
): Promise<Relation[]> {
  const { resolve = false, includeRoot = true } = options;
  const cleanId = normalizeId(id);
  const relationMap = await getRelations(collection, cleanId, ['ancestor']);
  
  let ancestors = relationMap.ancestors;
  
  if (!includeRoot) {
    // Exclude the root node (highest ancestor)
    const maxDepth = Math.max(...ancestors.map(a => a.depth || 0));
    ancestors = ancestors.filter(a => (a.depth || 0) < maxDepth);
  }
  
  if (resolve) {
    await resolveRelations(ancestors);
  }
  
  return ancestors;
}

/**
 * Get all descendants (children down the tree)
 */
export async function getDescendants<T extends CollectionKey>(
  collection: T,
  id: string,
  options: {
    resolve?: boolean;
    maxDepth?: number;
  } = {}
): Promise<Relation[]> {
  const { resolve = false, maxDepth = Infinity } = options;
  const cleanId = normalizeId(id);
  const relationMap = await getRelations(collection, cleanId, ['descendant']);
  
  let descendants = relationMap.descendants;
  
  // Filter by max depth
  if (maxDepth < Infinity) {
    descendants = descendants.filter(d => (d.depth || 0) <= maxDepth);
  }
  
  if (resolve) {
    await resolveRelations(descendants);
  }
  
  return descendants;
}

/**
 * Get siblings (entries with same parent)
 */
export async function getSiblings<T extends CollectionKey>(
  collection: T,
  id: string,
  resolve: boolean = false
): Promise<Relation[]> {
  const cleanId = normalizeId(id);
  const relationMap = await getRelations(collection, cleanId, ['sibling']);
  const siblings = relationMap.siblings;
  
  if (resolve) {
    await resolveRelations(siblings);
  }
  
  return siblings;
}

/**
 * Get root entries (entries with no parent)
 */
export async function getRoots<T extends CollectionKey>(
  collection: T,
  resolve: boolean = false
): Promise<CollectionEntry<T>[]> {
  const graph = await getOrBuildGraph();
  const collectionMap = graph.nodes.get(collection);
  
  if (!collectionMap) return [];
  
  const roots: CollectionEntry<T>[] = [];
  
  for (const relationMap of collectionMap.values()) {
    if (relationMap.isRoot) {
      roots.push(relationMap.entry as CollectionEntry<T>);
    }
  }
  
  return roots;
}

/**
 * Get leaf entries (entries with no children)
 */
export async function getLeaves<T extends CollectionKey>(
  collection: T
): Promise<CollectionEntry<T>[]> {
  const graph = await getOrBuildGraph();
  const collectionMap = graph.nodes.get(collection);
  
  if (!collectionMap) return [];
  
  const leaves: CollectionEntry<T>[] = [];
  
  for (const relationMap of collectionMap.values()) {
    if (relationMap.isLeaf) {
      leaves.push(relationMap.entry as CollectionEntry<T>);
    }
  }
  
  return leaves;
}

/**
 * Tree node structure
 */
export interface TreeNode<T extends CollectionKey = CollectionKey> {
  entry: CollectionEntry<T>;
  children: TreeNode<T>[];
  depth: number;
  hasChildren: boolean;
  isLeaf: boolean;
}

/**
 * Get full tree structure starting from a node
 */
export async function getTree<T extends CollectionKey>(
  collection: T,
  id: string,
  maxDepth: number = Infinity
): Promise<TreeNode<T>> {
  const cleanId = normalizeId(id);
  const graph = await getOrBuildGraph();
  const relationMap = getRelationMap(graph, collection, cleanId);
  
  if (!relationMap) {
    throw new Error(`Entry not found: ${collection}/${cleanId}`);
  }
  
  return buildTreeNode(relationMap, graph, 0, maxDepth);
}

/**
 * Build tree node recursively
 */
function buildTreeNode<T extends CollectionKey>(
  relationMap: RelationMap,
  graph: any,
  currentDepth: number,
  maxDepth: number
): TreeNode<T> {
  const node: TreeNode<T> = {
    entry: relationMap.entry as CollectionEntry<T>,
    children: [],
    depth: currentDepth,
    hasChildren: relationMap.hasChildren,
    isLeaf: relationMap.isLeaf,
  };
  
  // Stop if max depth reached
  if (currentDepth >= maxDepth) {
    return node;
  }
  
  // Build children recursively
  const collectionMap = graph.nodes.get(relationMap.entry.collection);
  
  for (const child of relationMap.children) {
    const childId = normalizeId(child.id);
    const childMap = collectionMap?.get(childId);
    if (childMap) {
      node.children.push(buildTreeNode(childMap, graph, currentDepth + 1, maxDepth));
    }
  }
  
  return node;
}

/**
 * Get breadcrumb path from root to entry
 */
export async function getBreadcrumbs<T extends CollectionKey>(
  collection: T,
  id: string,
  resolve: boolean = true
): Promise<Relation[]> {
  const { find } = await import('./query');
  const breadcrumbs: Relation[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = normalizeId(id);
  while (currentId) {
    if (visited.has(currentId)) throw new Error(`[breadcrumbs] Cyclic parent relationship in ${collection}/${currentId}.`);
    visited.add(currentId);
    const entry = await find(collection, currentId);
    if (!entry) break; // Published query excludes draft/missing ancestors.
    breadcrumbs.unshift({ type: breadcrumbs.length ? 'ancestor' : 'child', collection, id: currentId, ...(resolve ? { entry } : {}) });
    currentId = getFirstParentId((entry.data as any).parent);
  }
  return breadcrumbs;
}

/**
 * Check if entry is ancestor of another
 */
export async function isAncestorOf(
  collection: CollectionKey,
  ancestorId: string,
  descendantId: string
): Promise<boolean> {
  const cleanAncestorId = normalizeId(ancestorId);
  const cleanDescendantId = normalizeId(descendantId);
  const ancestors = await getAncestors(collection, cleanDescendantId);
  return ancestors.some(a => normalizeId(a.id) === cleanAncestorId);
}

/**
 * Check if entry is descendant of another
 */
export async function isDescendantOf(
  collection: CollectionKey,
  descendantId: string,
  ancestorId: string
): Promise<boolean> {
  return isAncestorOf(collection, ancestorId, descendantId);
}

/**
 * Get level in hierarchy (0 = root)
 */
export async function getLevel(
  collection: CollectionKey,
  id: string
): Promise<number> {
  const cleanId = normalizeId(id);
  const relationMap = await getRelations(collection, cleanId);
  return relationMap.depth;
}