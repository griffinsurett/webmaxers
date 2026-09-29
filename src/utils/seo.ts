// src/utils/seo.ts
/**
 * SEO Props Builder
 *
 * Builds SEO metadata objects for pages from collection entries.
 * Handles:
 * - Resolving author references to display names
 * - Merging item and collection SEO settings
 * - Building complete SEO props for layout components
 *
 * Used by dynamic page routes to generate proper meta tags.
 */

import type { CollectionEntry, CollectionKey } from "astro:content";
import type { SEOData, MetaData, ImageInput } from "@/content/schema";
import { find, normalizeId } from "@/utils/query";
import { siteData } from "@site/content/siteData";
import { canonicalWebUrl } from "@/utils/links/linkBehavior";

const pageUrlKey = Symbol("greastro.canonicalUrl");
type PageLocals = Record<string | symbol, any>;

/** Shared by layouts, SEO and schema; store only this page's canonical context. */
export function setPageCanonicalUrl(locals: PageLocals, pathname: string, seo?: SEOData): string {
  const url = canonicalWebUrl(pathname, siteData.url, seo?.canonicalUrl);
  const previous = locals[pageUrlKey];
  if (previous && previous !== url) {
    throw new Error(`[seo] Conflicting canonical URLs for ${pathname}: ${previous} and ${url}. Pass the same SEO props to the subject resolver and BaseLayout.`);
  }
  locals[pageUrlKey] = url;
  return url;
}

export function getPageCanonicalUrl(locals: PageLocals, pathname: string): string {
  return locals[pageUrlKey] ?? canonicalWebUrl(pathname, siteData.url);
}

export function mergeItemSEO(data: { seo?: SEOData }, meta?: { seo?: SEOData }): SEOData {
  // Collection seo describes the index page. Inherit its general policy, but
  // never make every item share the index's title, image or canonical identity.
  const {
    metaTitle: _metaTitle,
    metaDescription: _metaDescription,
    ogTitle: _ogTitle,
    ogDescription: _ogDescription,
    ogImage: _ogImage,
    canonicalUrl: _canonicalUrl,
    twitterTitle: _twitterTitle,
    twitterDescription: _twitterDescription,
    twitterImage: _twitterImage,
    ...policy
  } = meta?.seo ?? {};
  return { ...policy, ...data.seo };
}

/**
 * SEO props interface for page metadata
 * Passed to SEO.astro component for meta tag generation
 */
export interface SEOProps {
  title?: string; // Page title
  description?: string; // Page description
  image?: ImageInput; // Featured/OG image
  author?: string; // Author name (resolved from reference)
  authorId?: string; // `authors` entry id (links the schema author node)
  publishDate?: Date | string; // Publication date
  seo?: SEOData; // Additional SEO overrides
  siteName?: string; // Site name for OG tags
  addToLLMs?: boolean; // Whether this page appears in llms.txt (default: true)
}

/**
 * Resolve an author reference to a display name
 *
 * Handles multiple author formats:
 * - String IDs: 'jane-doe'
 * - Reference objects: { collection: 'authors', id: 'jane-doe' }
 * - Arrays of references (gets first)
 * - Objects with an author ID: { id: 'jane-doe' }
 *
 * @param author - Author in any supported format
 * @returns Author display name or undefined
 */
export async function resolveAuthor(author: any): Promise<string | undefined> {
  const entry = await resolveAuthorEntry(author);
  return entry?.data.title;
}

/** One published-author lookup for bylines, SEO and structured person nodes. */
export async function resolveAuthorEntry(author: any) {
  const id = resolveAuthorId(author);
  if (!id) return undefined;
  const { getCollectionNames } = await import("@/utils/collections");
  if (!getCollectionNames().includes("authors")) return undefined;
  return find("authors", id);
}

/** The `authors` entry id behind an author reference, if it is one. */
export function resolveAuthorId(author: any): string | undefined {
  const ref = Array.isArray(author) ? author[0] : author;
  if (!ref) return undefined;
  if (typeof ref === "object" && ref.collection && ref.collection !== "authors") return undefined;
  const id = typeof ref === "string" ? ref : ref.id;
  return typeof id === "string" ? normalizeId(id) || undefined : undefined;
}

/**
 * Build SEO props from a collection item entry
 *
 * Combines item data with collection defaults:
 * - Item's own SEO settings take precedence
 * - Falls back to collection's SEO settings
 * - Resolves author reference if present
 *
 * @param item - Collection entry to build SEO for
 * @param collectionMeta - Optional collection metadata for defaults
 * @returns Complete SEO props object for layout
 */
export async function buildItemSEOProps(
  item: CollectionEntry<CollectionKey>,
  collectionMeta?: MetaData
): Promise<SEOProps> {
  const itemData = item.data as any;

  // Resolve author to display name
  const authorName = itemData.author
    ? await resolveAuthor(itemData.author)
    : undefined;

  const collectionItemsAddToLLMs = collectionMeta?.llms?.itemsAddToLLMs;
  const itemAddToLLMs = itemData.llms?.addToLLMs;
  const addToLLMs = itemAddToLLMs !== undefined ? itemAddToLLMs : collectionItemsAddToLLMs;

  return {
    title: itemData.title,
    description: itemData.description,
    image: itemData.featuredImage || collectionMeta?.featuredImage,
    author: authorName,
    authorId: resolveAuthorId(itemData.author),
    publishDate: itemData.publishDate,
    addToLLMs,
    seo: mergeItemSEO(itemData, collectionMeta),
  };
}

/**
 * Build SEO props for collection index pages
 *
 * Uses collection metadata with sensible defaults.
 *
 * @param collectionMeta - Collection metadata from _meta.mdx
 * @param collectionName - Collection name for fallback title
 * @returns SEO props for collection index page
 */
export function buildCollectionSEOProps(
  collectionMeta: MetaData,
  collectionName: string
): SEOProps {
  // Capitalize collection name for fallback title
  const title =
    collectionMeta.title ||
    collectionName.charAt(0).toUpperCase() + collectionName.slice(1);

  const description =
    collectionMeta.description || `Browse our ${collectionName} collection`;

  return {
    title,
    description,
    image: collectionMeta.featuredImage,
    addToLLMs: collectionMeta.llms?.addToLLMs,
    seo: collectionMeta.seo || {},
  };
}
