// src/utils/filesystem/pageLogic.ts
/**
 * Node.js-Compatible Page Logic
 * 
 * ⚠️ IMPORTANT: Thin wrappers around shared pageRules helpers so they can
 * be used in Node-only contexts (astro.config.mjs, loaders, build scripts).
 * 
 * WHY THESE DUPLICATES EXIST:
 * - This file runs in pure Node.js context (astro.config.mjs, loaders, build scripts)
 * - The main pages.ts file imports from 'astro:content' which is a virtual module
 * - Virtual modules only exist AFTER Astro initializes, not during config/build time
 * - Therefore, we need Node.js-compatible versions that work with raw frontmatter data
 * 
 * WHEN TO USE THIS FILE:
 * - ✅ In astro.config.mjs
 * - ✅ In custom loaders
 * - ✅ In build scripts that run before Astro
 * - ✅ In redirect collectors
 * - ❌ In Astro page files (.astro)
 * - ❌ In components that run during build
 * 
 * MAINTENANCE NOTE:
 * - Core logic lives in src/utils/pages/pageRules.ts
 * - Keep imports aligned if you change override behavior
 */

import {
  shouldItemHavePageData,
  shouldItemUseRootPathData,
} from "../pages/pageRules";

/**
 * Determine if an item should have a page (Node.js version)
 * 
 * Uses override pattern:
 * - Item's hasPage field (if present)
 * - Collection's itemsHasPage setting from _meta.mdx
 * - Default: true (most items should have pages)
 * 
 * @param itemData - Item frontmatter (plain object from parseFrontmatter)
 * @param metaData - Collection meta (plain object from parseFrontmatter)
 * @returns True if item should have a page
 */
export function shouldItemHavePage(itemData: any, metaData: any): boolean {
  return shouldItemHavePageData(itemData, metaData, true);
}

/**
 * Determine if an item should use root path (Node.js version)
 * 
 * Uses override pattern:
 * - Item's rootPath field (if present)
 * - Collection's itemsRootPath setting from _meta.mdx
 * - Default: false (most items use collection paths)
 * 
 * When true, item is accessible at /slug instead of /collection/slug
 * 
 * @param itemData - Item frontmatter (plain object from parseFrontmatter)
 * @param metaData - Collection meta (plain object from parseFrontmatter)
 * @returns True if item should use root path
 */
export function shouldItemUseRootPath(itemData: any, metaData: any): boolean {
  return shouldItemUseRootPathData(itemData, metaData, false);
}
