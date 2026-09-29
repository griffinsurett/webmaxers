// src/layouts/collections/helpers/layoutUtils.ts
/**
 * Layout Discovery and Selection Utilities
 *
 * Handles:
 * - Dynamic import of layout components from full paths
 * - Layout selection based on collection/item config
 * - Fallback to default layout
 */

import { getItemProperty } from '@/utils/pages/pageRules';

/**
 * All layout components loaded eagerly
 * This allows us to use dynamic paths without issues
 */
const allLayouts = import.meta.glob('../*.astro', { eager: true });

/**
 * Cache for resolved layout components
 */
const layoutCache = new Map<string, any>();

/**
 * Default layout paths
 */
const DEFAULT_ITEM_LAYOUT_PATH = '@/layouts/collections/CollectionLayout.astro';
const DEFAULT_INDEX_LAYOUT_PATH = '@/layouts/collections/CollectionIndexLayout.astro';

/**
 * Resolve a layout path to the actual module
 *
 * Supports:
 * - @/layouts/collections/BlogLayout.astro
 * - /src/layouts/collections/BlogLayout.astro
 * - ../BlogLayout.astro
 *
 * @param layoutPath - Layout path from frontmatter
 * @returns Layout component module
 */
function resolveLayoutModule(layoutPath: string): any {
  // Extract just the filename
  const filename = layoutPath.split('/').pop() || 'CollectionLayout.astro';

  // Find in glob imports (they're relative paths like ../BlogLayout.astro)
  const relativePath = `../${filename}`;

  const module = allLayouts[relativePath];

  if (!module || typeof module !== 'object' || !('default' in module)) {
    const available = Object.keys(allLayouts).map(p => p.replace('../', '')).join(', ');
    throw new Error(
      `Layout "${filename}" not found in src/layouts/collections/.\n` +
      `Available layouts: ${available}\n` +
      `Make sure the file exists and has a default export.`
    );
  }

  return module;
}

/** The selected layout owns its subject kind, regardless of collection name. */
export function getLayoutSchemaKind(layoutPath?: string): string | undefined {
  const module = resolveLayoutModule(layoutPath || DEFAULT_ITEM_LAYOUT_PATH);
  return typeof module.schemaKind === "string" ? module.schemaKind : undefined;
}

/**
 * Get layout component from path
 *
 * @param layoutPath - Full path to layout (e.g., "@/layouts/collections/BlogLayout.astro")
 * @returns Layout component
 * @throws Error if layout cannot be imported
 */
export async function getLayoutComponent(layoutPath?: string) {
  const path = layoutPath || DEFAULT_ITEM_LAYOUT_PATH;

  // Check cache first
  if (layoutCache.has(path)) {
    return layoutCache.get(path);
  }

  try {
    const component = resolveLayoutModule(path).default;

    // Cache the component
    layoutCache.set(path, component);
    return component;
  } catch (error) {
    throw new Error(
      `Failed to import layout from "${path}".\n` +
      `${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Determine which layout path to use for a collection/item
 *
 * Uses override pattern:
 * - Item pages use itemLayout or itemsLayout or CollectionLayout
 *
 * @param meta - Collection metadata
 * @param item - Item data (optional)
 * @param isItemPage - Whether this is an item page
 * @returns Layout path to use
 */
export function getLayoutPath(
  meta: any,
  item?: any,
  isItemPage: boolean = false
): string | undefined {
  // For item pages, use the override pattern
  return getItemProperty(
    item?.data,
    meta,
    'itemLayout',          // item-level property
    'itemsLayout',         // collection-level property
    undefined              // default (will use CollectionLayout)
  );
}

/**
 * Get layout path for collection index pages
 *
 * Uses the indexLayout field from _meta.mdx
 * Defaults to CollectionIndexLayout if not specified
 *
 * @param meta - Collection metadata
 * @returns Layout path to use
 */
export function getCollectionIndexLayoutPath(meta: any): string {
  return meta.indexLayout || DEFAULT_INDEX_LAYOUT_PATH;
}
