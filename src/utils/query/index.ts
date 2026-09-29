// src/utils/query/index.ts
/**
 * Query System - Public API
 * Everything is lazy-loaded, safe for MDX
 */

// Core types
export type {
  RelationType,
  Relation,
  RelationMap,
  FilterFn,
  SortFn,
  SortConfig,
  QueryOptions,
  QueryResult,
  RelationshipGraph,
  EntryReference,
} from './types';

export {
  getEntryKey,
  parseEntryKey,
  isCollectionReference,
} from './types';

// Helpers
export {
  getQueryKey,
  normalizeId,
  getFirstParentId,
  entryExists,
  safeGetEntry,
} from './helpers';

// Schema helpers
export {
  relationSchema,
  parentSchema,
  createRelationalSchema,
  extractRelationConfig,
  normalizeReference,
  isParentField,
} from './schema';

// Graph operations
export {
  buildRelationshipGraph,
  getRelationMap,
  getCollectionEntries,
  getOrBuildGraph,
  clearGraphCache,
} from './graph';

// Relations
export {
  getRelations,
  getReferencedEntries,
  getReferencingEntries,
  getAllRelatedEntries,
  resolveRelations,
} from './relations';

// Hierarchy
export {
  getParent,
  getChildren,
  getAncestors,
  getDescendants,
  getSiblings,
  getRoots,
  getLeaves,
  getTree,
  getBreadcrumbs,
  isAncestorOf,
  isDescendantOf,
  getLevel,
  type TreeNode,
} from './hierarchy';

// Filters
export {
  whereEquals,
  whereExists,
  whereIn,
  whereContains,
  whereStartsWith,
  whereGreaterThan,
  whereLessThan,
  whereBetween,
  whereAfter,
  whereBefore,
  whereArrayContains,
  whereArrayContainsAny,
  whereNoParent,
  and,
  or,
  not,
  applyFilters,
} from './filters';

// Sorting
export {
  sortBy,
  sortByDate,
  sortByTitle,
  sortByOrder,
  sortByMultiple,
  createSortFn,
  applySorting,
} from './sorting';

// Query builder
export {
  Query,
  query,
  find,
  findWhere,
  findAll,
} from './query';

// Query snippets (pre-built patterns)
export {
  byTag,
  byItemKeys,
  roots,
  leaves,
  children,
  parent,
  siblings,
  related,
  relatedRoots,
  withReferencesTo,
} from './snippets';
