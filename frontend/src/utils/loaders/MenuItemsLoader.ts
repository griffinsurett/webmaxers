// src/utils/loaders/MenuItemsLoader.ts
import { file } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import { capitalize } from '@/utils/string';
import { parseContentPath, isMetaFile } from '@/utils/paths';
import { SimpleIdRegistry } from '@/utils/idRegistry';
import { parseFrontmatterFromString } from '@/utils/filesystem/frontmatter';
import { shouldItemHavePageData, shouldItemUseRootPathData } from '../pages/pageRules';
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const MENU_ITEMS_JSON_PATH = 'src/content/menu-items/menu-items.json';
const MENUS_COLLECTION = 'menus' as const;

const idRegistry = new SimpleIdRegistry();

function resolveParentReference(parent: any, store: any): string | null {
  if (!parent) return null;

  const candidates = Array.isArray(parent) ? parent : [parent];
  let fallback: string | null = null;

  const matchString = (value: string): string | null => {
    if (!value) return null;

    if (store.has(value)) return value;

    const normalized = value.toLowerCase();
    const normalizedPath = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    for (const [id, entry] of store.entries()) {
      const idMatch = id.toLowerCase() === normalized;
      const url = entry.data?.url;
      const normalizedUrl = typeof url === 'string' ? url.toLowerCase() : null;
      const normalizedUrlPath = normalizedUrl?.startsWith('/') ? normalizedUrl.slice(1) : normalizedUrl;

      if (idMatch) return id;

      if (normalizedUrl && (normalizedUrl === normalized || normalizedUrlPath === normalizedPath)) {
        return id;
      }
    }

    return null;
  };

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === 'object' && !Array.isArray(candidate)) {
      if (candidate.id) return String(candidate.id);

      if (candidate.slug) {
        const resolvedBySlug = matchString(String(candidate.slug));
        if (resolvedBySlug) return resolvedBySlug;
        if (!fallback) fallback = String(candidate.slug);
      }

      if (candidate.url) {
        const resolvedByUrl = matchString(String(candidate.url));
        if (resolvedByUrl) return resolvedByUrl;
        if (!fallback) fallback = String(candidate.url);
      }
    }

    if (typeof candidate === 'string') {
      const resolved = matchString(candidate);
      if (resolved) return resolved;
      if (!fallback) fallback = candidate;
    }
  }

  return fallback;
}

function getAncestorChain(parentRef: any, store: any): string[] {
  const ancestors: string[] = [];
  let current = parentRef;
  const visited = new Set<string>();
  
  while (current) {
    const resolvedId = resolveParentReference(current, store);
    const parentId = resolvedId ?? (
      typeof current === 'string'
        ? current
        : (current?.id || String(current))
    );
    
    if (visited.has(parentId)) {
      console.warn(`Circular parent reference detected: ${parentId}`);
      break;
    }
    visited.add(parentId);
    ancestors.push(parentId);
    
    const parentEntry = store.get(parentId);
    if (!parentEntry?.data?.parent) break;
    
    current = parentEntry.data.parent;
  }
  
  return ancestors;
}

function buildSemanticId(
  baseId: string,
  context: { parent?: any; menu?: any; includeMenu?: boolean },
  store: any
): string {
  const parts = [baseId];
  
  if (context.parent) {
    const ancestors = getAncestorChain(context.parent, store);
    parts.push(...ancestors.reverse());
  }
  
  if (context.includeMenu && context.menu) {
    const menuId = typeof context.menu === 'string'
      ? context.menu
      : Array.isArray(context.menu)
        ? (context.menu[0]?.id || String(context.menu[0]))
        : (context.menu.id || String(context.menu));
    parts.push(menuId);
  }
  
  return parts.join('-');
}

function getUniqueId(semanticId: string): string {
  return idRegistry.getUniqueId(semanticId);
}

function normalizeMenuReference(menu: any): any {
  if (!menu) return [];
  
  const normalizeOne = (m: any) =>
    typeof m === 'string' ? { collection: MENUS_COLLECTION, id: m } : m;
  
  return Array.isArray(menu) ? menu.map(normalizeOne) : [normalizeOne(menu)];
}

function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function getCollectionMetaFromModules(
  collectionName: string,
  modules: Record<string, any>
): any {
  const metaPath = Object.keys(modules).find(
    path => path.includes(`/${collectionName}/_meta.mdx`)
  );
  
  if (metaPath) {
    const data = modules[metaPath].frontmatter ?? {};
    return {
      title: data.title ?? capitalize(collectionName),
      description: data.description,
      hasPage: data.hasPage ?? false,
      itemsHasPage: data.itemsHasPage ?? true,
      itemsRootPath: data.itemsRootPath ?? false,
      ...data
    };
  }
  
  return {
    title: capitalize(collectionName),
    hasPage: false,
    itemsHasPage: true,
    itemsRootPath: false,
  };
}

function resolveAllParents(store: any, maxPasses: number = 5): void {
  let passCount = 0;
  let changesInLastPass = 0;
  
  do {
    passCount++;
    changesInLastPass = 0;
    
    const updates: Array<{ id: string; resolvedParent: string }> = [];
    
    for (const [id, entry] of store.entries()) {
      const parent = entry.data.parent;
      if (!parent || typeof parent !== 'string') continue;
      
      const resolved = resolveParentReference(parent, store);
      
      if (resolved && resolved !== parent) {
        updates.push({ id, resolvedParent: resolved });
        changesInLastPass++;
      }
    }
    
    for (const { id, resolvedParent } of updates) {
      const entry = store.get(id);
      if (entry) {
        store.set({
          id,
          data: { ...entry.data, parent: resolvedParent },
        });
      }
    }
  } while (changesInLastPass > 0 && passCount < maxPasses);
}

export function MenuItemsLoader(): Loader {
  return {
    name: 'menu-items-loader',
    
    async load(context: LoaderContext) {
      const { store, logger } = context;

      idRegistry.clear();
      store.clear();
      await file(MENU_ITEMS_JSON_PATH).load(context);

      for (const [id] of store.entries()) {
        idRegistry.getUniqueId(id);
      }

      const frontmatterModules: Record<string, any> = {};
      
      function walkDir(dir: string) {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && /\.(mdx?|md)$/.test(entry.name)) {
            try {
              const raw = readFileSync(fullPath, 'utf-8');
              const frontmatter = parseFrontmatterFromString(raw);
              
              const relativePath = relative(process.cwd(), fullPath)
                .replace(/\\/g, '/')
                .replace('src/', '../../');
              
              frontmatterModules[relativePath] = { frontmatter };
            } catch (error) {
              logger.warn(`Failed to read ${fullPath}: ${error}`);
            }
          }
        }
      }
      
      walkDir(join(process.cwd(), 'src/content'));

      await processCollectionMenus(frontmatterModules, store);
      resolveAllParents(store);
      await processItemMenus(frontmatterModules, store);
      resolveAllParents(store);

      logger.info(`Menu items loader: ${store.keys().length} items loaded`);
    },
  };
}

async function processItemMenus(
  modules: Record<string, any>,
  store: any
): Promise<void> {
  for (const [path, mod] of Object.entries(modules)) {
    if (isMetaFile(path)) continue;

    const data = mod.frontmatter ?? {};
    if (!data.addToMenu) continue;

    const { slug, collection } = parseContentPath(path);
    const configs = ensureArray(data.addToMenu);

    for (let i = 0; i < configs.length; i++) {
      const menuConfig = configs[i];
      const menus = normalizeMenuReference(menuConfig.menu);
      
      const baseId = menuConfig.id ||
        (configs.length > 1 && !menuConfig.parent ? `${slug}-${i}` : slug);
      
      const resolvedParent = resolveParentReference(menuConfig.parent, store);
      
      const semanticId = buildSemanticId(
        baseId,
        { parent: resolvedParent, menu: menuConfig.menu, includeMenu: false },
        store
      );
      const itemId = getUniqueId(semanticId);

      const meta = getCollectionMetaFromModules(collection, modules);
      const useRootPath = shouldItemUseRootPathData(data, meta);
      const itemUrl = useRootPath ? `/${slug}` : `/${collection}/${slug}`;

      store.set({
        id: itemId,
        data: {
          title: menuConfig.title ?? data.title ?? capitalize(slug),
          description: menuConfig.description ?? data.description,
          url: itemUrl,
          icon: menuConfig.icon ?? data.icon,
          menu: menus,
          parent: resolvedParent,
          openInNewTab: menuConfig.openInNewTab ?? false,
          order: data.order,
          tags: data.tags,
        },
      });
    }
  }
}

async function processCollectionMenus(
  modules: Record<string, any>,
  store: any
): Promise<void> {
  const metaModules = Object.entries(modules).filter(([path]) => isMetaFile(path));

  for (const [path, mod] of metaModules) {
    const data = mod.frontmatter ?? {};
    const collection = path.split('/').slice(-2)[0];

    if (!data.addToMenu && !data.itemsAddToMenu) continue;

    const meta = getCollectionMetaFromModules(collection, modules);

    if (data.addToMenu) {
      const configs = ensureArray(data.addToMenu);

      for (let i = 0; i < configs.length; i++) {
        const menuConfig = configs[i];
        const menus = normalizeMenuReference(menuConfig.menu);
        
        const baseId = menuConfig.id ||
          (configs.length > 1 && !menuConfig.parent ? `${collection}-${i}` : collection);
        
        const resolvedParent = resolveParentReference(menuConfig.parent, store);
        
        const semanticId = buildSemanticId(
          baseId,
          { parent: resolvedParent, menu: menuConfig.menu, includeMenu: false },
          store
        );
        const collectionId = getUniqueId(semanticId);

        const hasPage = meta.hasPage ?? false;
        const itemUrl = hasPage ? `/${collection}` : undefined;

        store.set({
          id: collectionId,
          data: {
            title: menuConfig.title ?? meta.title ?? capitalize(collection),
            description: menuConfig.description ?? meta.description,
            url: itemUrl,
            icon: menuConfig.icon,
            menu: menus,
            parent: resolvedParent,
            openInNewTab: menuConfig.openInNewTab ?? false,
            order: menuConfig.order,
          },
        });
      }
    }

    if (data.itemsAddToMenu) {
      // Build a lookup of which items have pages
      const itemsWithPages = new Set<string>();
      // Build a lookup of parent -> children relationships
      const parentToChildren = new Map<string, string[]>();

      for (const [itemPath, itemMod] of Object.entries(modules)) {
        if (!itemPath.includes(`content/${collection}/`)) continue;
        if (isMetaFile(itemPath)) continue;

        const itemData = itemMod.frontmatter ?? {};
        const { slug } = parseContentPath(itemPath);

        // Track which items have pages
        if (shouldItemHavePageData(itemData, meta)) {
          itemsWithPages.add(slug);
        }

        // Track parent -> children relationships
        const parents = itemData.parent;
        const parentList = Array.isArray(parents) ? parents : parents ? [parents] : [];

        for (const parent of parentList) {
          if (typeof parent === "string") {
            const children = parentToChildren.get(parent) ?? [];
            children.push(slug);
            parentToChildren.set(parent, children);
          }
        }
      }

      // Check if a slug has any descendants with pages (recursive)
      const hasDescendantWithPage = (slug: string, visited = new Set<string>()): boolean => {
        if (visited.has(slug)) return false; // Prevent cycles
        visited.add(slug);

        const children = parentToChildren.get(slug) ?? [];
        for (const child of children) {
          if (itemsWithPages.has(child)) return true;
          if (hasDescendantWithPage(child, visited)) return true;
        }
        return false;
      };

      const configs = ensureArray(data.itemsAddToMenu);

      for (const menuConfig of configs) {
        const menus = normalizeMenuReference(menuConfig.menu);

        const attachTo = menuConfig.attachTo === undefined || menuConfig.attachTo === true
          ? collection
          : menuConfig.attachTo;

        for (const [itemPath, itemMod] of Object.entries(modules)) {
          if (!itemPath.includes(`content/${collection}/`)) continue;
          if (isMetaFile(itemPath)) continue;

          const itemData = itemMod.frontmatter ?? {};
          const { slug } = parseContentPath(itemPath);

          const hasRenderablePage = shouldItemHavePageData(itemData, meta);
          const isParentContainer = parentToChildren.has(slug);
          const hasPageableDescendants = isParentContainer && hasDescendantWithPage(slug);

          // Skip items with no page unless they are parent containers with descendants that have pages
          if (!hasRenderablePage && !hasPageableDescendants) continue;

          const itemUrl = hasRenderablePage
            ? (shouldItemUseRootPathData(itemData, meta) ? `/${slug}` : `/${collection}/${slug}`)
            : undefined;

          let parent = attachTo;
          // If attachTo is the collection but no explicit collection parent exists in the store,
          // avoid creating an implicit menu item and instead drop to root.
          if (attachTo === collection && !store.has(collection)) {
            parent = null;
          }
          if (itemData.parent && menuConfig.respectHierarchy !== false) {
            parent = itemData.parent;
          }

          const resolvedParent = resolveParentReference(parent, store);

          const baseId = `${collection}-${slug}-auto`;
          const semanticId = buildSemanticId(
            baseId,
            { parent: resolvedParent, menu: menuConfig.menu, includeMenu: false },
            store
          );
          const menuItemId = getUniqueId(semanticId);

          store.set({
            id: menuItemId,
            data: {
              title: itemData.title ?? capitalize(slug),
              description: itemData.description,
              url: itemUrl,
              icon: menuConfig.icon ?? itemData.icon,
              menu: menus,
              parent: resolvedParent,
              openInNewTab: menuConfig.openInNewTab ?? false,
              order: itemData.order,
            },
          });
        }
      }
    }
  }
}
