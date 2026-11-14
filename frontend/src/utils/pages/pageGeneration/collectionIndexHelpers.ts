// src/utils/pages/pageGeneration/collectionIndexHelpers.ts
/**
 * Collection Index Page Generation Helpers
 *
 * Helpers for generating collection index pages (e.g., /blog, /services).
 * Follows the same pattern as itemPageHelpers but for collection index pages.
 */

import type { CollectionKey } from "astro:content";
import { getCollectionMeta } from "@/utils/collections";
import { shouldCollectionHavePage } from "@/utils/pages";
import { getPageCollections } from "@/utils/pages/pageGeneration";
import { buildCollectionSEOProps } from "@/utils/seo";
import { getCollectionMetaMDX } from "@/utils/content";
import {
  getLayoutComponent,
  getCollectionIndexLayoutPath,
} from "@/layouts/collections/helpers/layoutUtils";
import type { MetaData } from "@/content/schema";

/**
 * Path parameters for collection index pages
 */
export interface CollectionIndexParams {
  collection: string;
}

/**
 * Props passed to collection index page components
 */
export interface CollectionIndexProps {
  meta: MetaData;
}

/**
 * Static path entry for collection index
 */
export interface CollectionIndexStaticPath {
  params: CollectionIndexParams;
  props: CollectionIndexProps;
}

/**
 * Prepared data ready for rendering a collection index page
 */
export interface PreparedCollectionIndexData {
  LayoutComponent: any;
  Content: any;
  collectionName: CollectionKey;
  collectionMeta: MetaData;
  seoProps: any;
  hasContent: boolean;
}

/**
 * Generate static paths for collection index pages
 */
export async function generateCollectionIndexPaths(): Promise<
  CollectionIndexStaticPath[]
> {
  const names = getPageCollections();
  const paths: CollectionIndexStaticPath[] = [];

  for (const coll of names) {
    const meta = getCollectionMeta(coll);

    if (shouldCollectionHavePage(meta)) {
      paths.push({
        params: { collection: coll },
        props: { meta },
      });
    }
  }

  return paths;
}

/**
 * Prepare all data needed to render a collection index page
 *
 * Works just like prepareItemPageData but for collection index pages.
 * Gets the layout component from meta.indexLayout field
 * and the MDX content from _meta.mdx body.
 */
export async function prepareCollectionIndexData(
  params: CollectionIndexParams,
  props: CollectionIndexProps
): Promise<PreparedCollectionIndexData> {
  const { collection } = params;
  const { meta } = props;

  // Get layout path from meta or use default
  const layoutPath = getCollectionIndexLayoutPath(meta);
  const LayoutComponent = await getLayoutComponent(layoutPath);

  // Get MDX content from _meta.mdx body
  const mdxResult = await getCollectionMetaMDX(collection as CollectionKey);
  const Content = mdxResult?.hasContent ? mdxResult.Component : null;
  const hasContent = !!mdxResult?.hasContent;

  // Build SEO props
  const seoProps = buildCollectionSEOProps(meta, collection);

  return {
    LayoutComponent,
    Content,
    collectionName: collection as CollectionKey,
    collectionMeta: meta,
    seoProps,
    hasContent,
  };
}
