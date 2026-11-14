// src/utils/pages/pageGeneration/itemPageHelpers.ts
/**
 * Item Page Generation Helpers
 *
 * Shared utilities for generating individual item pages.
 * Used by both root-level and collection-level page routes.
 */

import type { CollectionKey, CollectionEntry } from "astro:content";
import { render as renderEntry } from "astro:content";
import { getCollectionMeta, getPublishedCollection } from "@/utils/collections";
import { getFirstParentId } from "@/utils/query/helpers";
import { shouldProcessCollectionData } from "../pageRules";
import {
  shouldItemHavePage,
  shouldItemUseRootPath,
} from "@/utils/pages";
import { getPageCollections } from "@/utils/pages/pageGeneration";
import { buildItemSEOProps } from "@/utils/seo";
import {
  getLayoutPath,
  getLayoutComponent,
} from "@/layouts/collections/helpers/layoutUtils";
import type { MetaData } from "@/content/schema";

/**
 * Filter function type for determining which items to include
 */
export type ItemFilter = (
  entry: CollectionEntry<CollectionKey>,
  meta: MetaData,
  parent?: CollectionEntry<CollectionKey>
) => boolean;

/**
 * Path parameters for root-level items
 */
export interface RootLevelPathParams {
  id: string;
}

/**
 * Path parameters for collection-level items
 */
export interface CollectionLevelPathParams {
  collection: string;
  id: string;
}

/**
 * Props passed to item page components
 */
export interface ItemPageProps {
  entry: CollectionEntry<CollectionKey>;
  collectionMeta: MetaData;
  collectionName: CollectionKey;
}

/**
 * Generic static path entry
 */
export interface StaticPath<TParams> {
  params: TParams;
  props: ItemPageProps;
}

/**
 * Prepared page data ready for rendering
 */
export interface PreparedPageData {
  entry: CollectionEntry<CollectionKey>;
  collectionMeta: MetaData;
  collectionName: CollectionKey;
  LayoutComponent: any;
  Content: any;
  seoProps: any;
}

/**
 * Generate static paths for items matching a filter
 *
 * Generic function that handles path generation for both
 * root-level and collection-level routes.
 *
 * @param filter - Function to determine which items to include
 * @param buildParams - Function to build path params from entry
 * @returns Array of static path entries
 */

export async function generateItemPaths<TParams>(
  filter: ItemFilter,
  buildParams: (collection: string, id: string) => TParams
): Promise<StaticPath<TParams>[]> {
  const collections = getPageCollections();
  const paths: StaticPath<TParams>[] = [];

  for (const coll of collections) {
    const collectionKey = coll as CollectionKey;

    const meta = getCollectionMeta(collectionKey);
    const entries = (await getPublishedCollection(collectionKey)) as CollectionEntry<
      typeof collectionKey
    >[];
    if (!shouldProcessCollectionData(entries, meta)) continue;
    const entriesMap = new Map(entries.map((entry) => [entry.id, entry]));

    entries
      .filter((entry) => {
        const parentId = getFirstParentId((entry.data as any).parent);
        return filter(entry, meta, parentId ? entriesMap.get(parentId) : undefined);
      })
      .forEach((entry) => {
        const id = entry.id;
        paths.push({
          params: buildParams(collectionKey, id),
          props: {
            entry: entry as CollectionEntry<CollectionKey>,
            collectionMeta: meta,
            collectionName: collectionKey,
          },
        });
      });
  }

  return paths;
}

/**
 * Prepare all data needed to render an item page
 *
 * This function handles ALL the logic for preparing a page:
 * - Getting the layout component
 * - Rendering MDX content
 * - Building SEO props
 *
 * @param props - Props from getStaticPaths
 * @returns All data needed to render the page
 */
export async function prepareItemPageData(
  props: ItemPageProps
): Promise<PreparedPageData> {
  const { entry, collectionMeta, collectionName } = props;

  // Get the layout path from meta/item
  const layoutPath = getLayoutPath(collectionMeta, entry, true);

  // Get the actual layout component
  const LayoutComponent = await getLayoutComponent(layoutPath);

  // Prepare content if MDX
  let Content = null;
  try {
    const rendered = await renderEntry(entry as any);
    Content = rendered?.Content ?? null;
  } catch {
    Content = null;
  }

  // Build SEO props
  const seoProps = await buildItemSEOProps(entry, collectionMeta);

  return {
    entry,
    collectionMeta,
    collectionName,
    LayoutComponent,
    Content,
    seoProps,
  };
}

/**
 * Filter for root-level items
 * Items that should have a page AND use root path
 */
export const rootLevelFilter: ItemFilter = (entry, meta, parent) => {
  return shouldItemHavePage(entry, meta, parent) && shouldItemUseRootPath(entry, meta);
};

/**
 * Filter for collection-level items
 * Items that should have a page but NOT use root path
 */
export const collectionLevelFilter: ItemFilter = (entry, meta, parent) => {
  return shouldItemHavePage(entry, meta, parent) && !shouldItemUseRootPath(entry, meta);
};

/**
 * Build params for root-level paths
 */
export function buildRootLevelParams(
  _collection: string,
  id: string
): RootLevelPathParams {
  return { id };
}

/**
 * Build params for collection-level paths
 */
export function buildCollectionLevelParams(
  collection: string,
  id: string
): CollectionLevelPathParams {
  return { collection, id };
}
