// src/utils/query/menuQueries.ts
/**
 * Menu Query Utilities
 * 
 * Helper functions for querying and building menu structures at render time.
 */

import type { CollectionEntry } from 'astro:content';
import { query, sortBy } from '@/utils/query';


/**
 * Build hierarchical menu tree from flat items
 */
type MenuNode = Record<string, any> & { children: MenuNode[] };

const normalizeKey = (value?: string | null) => {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
};

const registerLookupKeys = (node: MenuNode, lookup: Map<string, MenuNode>) => {
  const addKey = (value?: string | null) => {
    const key = normalizeKey(value);
    if (!key || lookup.has(key)) return;
    lookup.set(key, node);
  };

  // Primary identifiers
  const primaryKey = node.id || node.slug || "";
  addKey(primaryKey);
  addKey(node.id);
  addKey(node.slug);

  const slugValue = typeof node.slug === 'string' ? node.slug : undefined;

  const slugTail =
    slugValue && slugValue.includes('/')
      ? slugValue.split('/').pop()
      : undefined;
  addKey(slugTail);

  if (slugValue && slugValue.includes('-auto')) {
    const beforeAuto = slugValue.slice(0, slugValue.indexOf('-auto'));
    const dashIndex = beforeAuto.indexOf('-');
    if (dashIndex !== -1) {
      const baseSlug = beforeAuto.slice(dashIndex + 1);
      addKey(baseSlug);
    }
  }

  const urlValue = typeof node.url === 'string' ? node.url.split('?')[0] : undefined;
  if (urlValue) {
    addKey(urlValue);
    const pathOnly = urlValue.replace(/^\/+/, '');
    addKey(pathOnly);
    const urlTail = pathOnly.split('/').pop();
    addKey(urlTail);
  }

  if (Array.isArray(node.aliases)) {
    node.aliases.forEach((alias: string) => {
      addKey(alias);
      if (typeof alias === 'string' && alias.includes('/')) {
        addKey(alias.split('/').pop());
      }
    });
  }
};

const resolveParentNode = (parentRef: any, lookup: Map<string, MenuNode>): MenuNode | undefined => {
  if (!parentRef) return undefined;

  const resolveFromValue = (value?: string | null) => {
    const key = normalizeKey(value);
    if (!key) return undefined;
    return lookup.get(key);
  };

  if (Array.isArray(parentRef)) {
    for (const candidate of parentRef) {
      const match = resolveParentNode(candidate, lookup);
      if (match) return match;
    }
    return undefined;
  }

  if (typeof parentRef === 'object') {
    // Already resolved node
    if (parentRef.children && Array.isArray(parentRef.children)) {
      return parentRef as MenuNode;
    }

    const slugTail =
      typeof parentRef?.slug === 'string' && parentRef.slug.includes('/')
        ? parentRef.slug.split('/').pop()
        : undefined;

    const collectionSlug =
      typeof parentRef?.collection === 'string' && typeof parentRef?.slug === 'string'
        ? `${parentRef.collection}/${parentRef.slug}`
        : undefined;

    return (
      resolveFromValue(parentRef.id) ||
      resolveFromValue(parentRef.slug) ||
      resolveFromValue(slugTail) ||
      resolveFromValue(parentRef.url) ||
      resolveFromValue(collectionSlug)
    );
  }

  return resolveFromValue(parentRef) ?? resolveBySegments(parentRef, lookup);
};

const resolveBySegments = (value?: string | null, lookup?: Map<string, MenuNode>) => {
  if (!lookup) return undefined;
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;

  let current = normalized;
  while (current.length > 0) {
    const match = lookup.get(current);
    if (match) return match;

    const hyphenIndex = current.lastIndexOf('-');
    const slashIndex = current.lastIndexOf('/');
    const cutIndex = Math.max(hyphenIndex, slashIndex);
    if (cutIndex === -1) break;
    current = current.slice(0, cutIndex);
  }

  return lookup.get(current);
};

export function buildMenuTree(items: any[]): MenuNode[] {
  const nodes: MenuNode[] = items.map((item) => ({ ...item, children: [] }));
  const lookup = new Map<string, MenuNode>();

  nodes.forEach((node) => registerLookupKeys(node, lookup));

  const roots: MenuNode[] = [];

  nodes.forEach((node) => {
    const parentNode = resolveParentNode(node.parent, lookup);

    if (parentNode && parentNode !== node) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (tree: MenuNode[]) => {
    tree.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    tree.forEach((node) => {
      if (node.children.length > 0) {
        sortTree(node.children);
      }
    });
  };

  sortTree(roots);
  return roots;
}

/**
 * Filter menu items by menu ID
 */
export function filterByMenu(menuId: string) {
  return (entry: CollectionEntry<'menu-items'>) => {
    const menus = entry.data.menu;
    if (Array.isArray(menus)) {
      return menus.some(m => m.id === menuId);
    }
    return menus?.id === menuId;
  };
}

/**
 * Get menu items with tree structure
 * 
 * @example
 * const items = await getMenuWithTree('main-menu');
 */
export async function getMenuWithTree(menuId: string) {
  const result = await query('menu-items')
    .where(filterByMenu(menuId))
    .orderBy(sortBy('order', 'asc'))
    .all();
  
  return buildMenuTree(result);
}
