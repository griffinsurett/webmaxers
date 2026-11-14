// src/components/ContentRenderer/utils/variantId.ts
/**
 * Variant ID Generation Utility
 *
 * ID Format:
 * - Single collection: {collection}-{page-slug} (e.g., "blog-home")
 * - Single collection DUPLICATE: {collection}-{page-slug}-{counter} (e.g., "blog-home-1")
 * - Multi-collection: {coll1-coll2}-{page-slug} (NO counter, ever)
 * - Manual ID: Uses provided ID as-is
 *
 * CRITICAL: Numbers ONLY for duplicate single-collection queries on same page
 */

import type { AstroGlobal } from "astro";
import type { Query } from "@/utils/query";
import type { CollectionKey } from "astro:content";
import { getQueryCollection } from "./queryIntrospection";
import { ScopedIdRegistry } from "@/utils/idRegistry";

// Use shared scoped ID registry
const idRegistry = new ScopedIdRegistry();

// Track multi-collection IDs (never get numbers)
const multiCollectionIds = new Set<string>();

// Track last page and access times
let lastPagePath: string | null = null;
const pageAccessTimes = new Map<string, number>();

// If 100ms passes between accesses, we're in a new render cycle
const RESET_THRESHOLD_MS = 100;

interface IdGenerationOptions {
  query?: Query<CollectionKey>;
  manualId?: string;
}

/**
 * Reset registry when switching pages or detecting new render cycle
 * This prevents Astro's multiple render passes from causing incorrect numbering
 */
function checkAndResetIfNeeded(pagePath: string): void {
  const now = Date.now();
  const lastAccess = pageAccessTimes.get(pagePath) || 0;
  const timeSinceLastAccess = now - lastAccess;

  // Switching to different page - clean up old page
  if (lastPagePath !== null && lastPagePath !== pagePath) {
    idRegistry.clearScope(lastPagePath);
    pageAccessTimes.delete(lastPagePath);

    multiCollectionIds.forEach((key) => {
      if (key.startsWith(`${lastPagePath}:`)) {
        multiCollectionIds.delete(key);
      }
    });
  }

  // New render cycle for same page (100ms+ gap) - reset counter
  if (
    timeSinceLastAccess > RESET_THRESHOLD_MS &&
    idRegistry.has(pagePath, "")
  ) {
    idRegistry.clearScope(pagePath);

    multiCollectionIds.forEach((key) => {
      if (key.startsWith(`${pagePath}:`)) {
        multiCollectionIds.delete(key);
      }
    });
  }

  lastPagePath = pagePath;
  pageAccessTimes.set(pagePath, now);
}

function getPageSlug(pathname: string): string {
  const segments = pathname.replace(/^\/|\/$/g, "").split("/");
  const slug = segments[segments.length - 1] || "home";
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCollectionPart(query?: Query<CollectionKey>): string | null {
  if (!query) return null;

  const collection = getQueryCollection(query);
  if (collection) return collection;

  const collections = (query as any)._collection;
  if (Array.isArray(collections)) {
    return collections.sort().join("-");
  }

  return null;
}

function isMultiCollection(query?: Query<CollectionKey>): boolean {
  if (!query) return false;
  return getQueryCollection(query) === null;
}

function generateBaseId(collectionPart: string, pageSlug: string): string {
  return `${collectionPart}-${pageSlug}`;
}

/**
 * Register ID and get counter using shared registry
 * - Multi-collection: ALWAYS returns 0 (no numbers)
 * - Single-collection first time: returns 0
 * - Single-collection duplicate: returns 1, 2, 3...
 */
function registerAndGetCounter(
  pagePath: string,
  baseId: string,
  isMulti: boolean
): number {
  checkAndResetIfNeeded(pagePath);

  // Multi-collection NEVER gets numbers
  if (isMulti) {
    multiCollectionIds.add(`${pagePath}:${baseId}`);
    return 0;
  }

  // Use shared scoped registry
  return idRegistry.register(pagePath, baseId);
}

function formatFinalId(baseId: string, counter: number): string {
  return counter === 0 ? baseId : `${baseId}-${counter}`;
}

/**
 * Generate unique section ID
 *
 * @example
 * // First blog section
 * generateIdFromAstro(Astro, { query: query('blog') })
 * // → 'blog-home'
 *
 * // Second blog section (DUPLICATE!)
 * generateIdFromAstro(Astro, { query: query('blog') })
 * // → 'blog-home-1'
 *
 * // Multi-collection (never gets number)
 * generateIdFromAstro(Astro, { query: query(['blog', "projects"]) })
 * // → 'blog-portfolio-home' (always the same)
 */
export function generateIdFromAstro(
  Astro: AstroGlobal,
  options: IdGenerationOptions = {}
): string {
  const { query, manualId } = options;

  if (manualId) return manualId;

  const pagePath = Astro.url.pathname;
  const pageSlug = getPageSlug(pagePath);
  const collectionPart = getCollectionPart(query);

  if (!collectionPart) return pageSlug;

  const baseId = generateBaseId(collectionPart, pageSlug);
  const isMulti = isMultiCollection(query);
  const counter = registerAndGetCounter(pagePath, baseId, isMulti);

  return formatFinalId(baseId, counter);
}

export function clearIdRegistry(): void {
  idRegistry.clear();
  multiCollectionIds.clear();
  pageAccessTimes.clear();
  lastPagePath = null;
}

export function getIdRegistry(): ScopedIdRegistry {
  return idRegistry;
}

export function isMultiCollectionId(pagePath: string, baseId: string): boolean {
  return multiCollectionIds.has(`${pagePath}:${baseId}`);
}
