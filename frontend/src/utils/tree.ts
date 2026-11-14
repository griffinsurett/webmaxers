// src/utils/tree.ts
/**
 * Tree Building Utilities
 * 
 * Transforms flat arrays with parent references into hierarchical trees.
 * Used by MenuVariant and any other component that needs hierarchy.
 */



/**
 * Build hierarchical tree from flat items with parent references
 * 
 * @param items - Flat array of items with optional parent field
 * @param options - Configuration for tree building
 * @returns Array of root-level items with nested children
 * 
 * @example
 * const flatItems = [
 *   { id: 'home', parent: null },
 *   { id: 'services', parent: null },
 *   { id: 'web-dev', parent: 'services' }
 * ];
 * const tree = buildTree(flatItems);
 * // Returns: [{ id: 'home', children: [] }, { id: 'services', children: [{ id: 'web-dev', children: [] }] }]
 */
export function buildTree<T extends { parent?: any; order?: number }>(
  items: T[],
  options: {
    parentField?: keyof T;  // Field that references parent (default: 'parent')
    sortBy?: keyof T;       // Field to sort by (default: 'order')
    sortDirection?: 'asc' | 'desc';
  } = {}
): Array<T & { children: Array<T & { children: any[] }> }> {
  const {
    parentField = 'parent' as keyof T,
    sortBy = 'order' as keyof T,
    sortDirection = 'asc'
  } = options;

  type TreeNode = T & { children: TreeNode[] };
  
  const itemMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  
  // First pass: create nodes with children arrays
  items.forEach(item => {
    const id = (item as any).id || (item as any).slug || "";
    if (id) {
      itemMap.set(id, { ...item, children: [] });
    }
  });

  // Second pass: build hierarchy
  items.forEach(item => {
    const id = (item as any).id || (item as any).slug || "";
    if (!id) return;

    const node = itemMap.get(id)!;
    const parent = item[parentField];

    if (parent) {
      // Extract parent ID (handle both string and object references)
      const parentId = typeof parent === 'string' ? parent :
                       ((parent as any).id || (parent as any).slug || "");
      const parentNode = itemMap.get(parentId);
      
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        // Parent not found - treat as root
        roots.push(node);
      }
    } else {
      // No parent - root level
      roots.push(node);
    }
  });
  
  // Sort recursively
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aVal = a[sortBy] ?? Infinity;
      const bVal = b[sortBy] ?? Infinity;
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortTree(node.children);
      }
    });
  };
  
  sortTree(roots);
  return roots;
}

/**
 * Flatten a tree back to an array (useful for searching/filtering)
 * 
 * @param tree - Hierarchical tree structure
 * @param includeDepth - Add depth property to each item
 * @returns Flat array of all items
 */
export function flattenTree<T extends { children?: any[] }>(
  tree: T[],
  includeDepth: boolean = false
): Array<T & { depth?: number }> {
  const result: Array<T & { depth?: number }> = [];
  
  const traverse = (nodes: T[], depth: number = 0) => {
    for (const node of nodes) {
      const { children, ...item } = node;
      result.push(includeDepth ? { ...item as T, depth } : item as T);
      
      if (children && children.length > 0) {
        traverse(children, depth + 1);
      }
    }
  };
  
  traverse(tree);
  return result;
}

/**
 * Find a node in a tree by predicate
 */
export function findInTree<T extends { children?: T[] }>(
  tree: T[],
  predicate: (node: T) => boolean
): T | undefined {
  for (const node of tree) {
    if (predicate(node)) return node;
    
    if (node.children && node.children.length > 0) {
      const found = findInTree(node.children, predicate);
      if (found) return found;
    }
  }
  
  return undefined;
}

/**
 * Get all ancestors of a node (breadcrumb path)
 */
export function getAncestors<T extends { parent?: any }>(
  items: T[],
  targetId: string,
  options: {
    parentField?: keyof T;
  } = {}
): T[] {
  const { parentField = 'parent' as keyof T } = options;
  const ancestors: T[] = [];
  
  const itemMap = new Map<string, T>();
  items.forEach(item => {
    const id = (item as any).id || (item as any).slug || "";
    if (id) {
      itemMap.set(id, item);
    }
  });

  // Walk up the tree
  let current = itemMap.get(targetId);
  while (current) {
    const parent = current[parentField];
    if (!parent) break;

    const parentId = typeof parent === 'string' ? parent : ((parent as any).id || (parent as any).slug || "");
    const parentItem = itemMap.get(parentId);
    
    if (!parentItem) break;
    ancestors.unshift(parentItem); // Add to beginning
    current = parentItem;
  }
  
  return ancestors;
}