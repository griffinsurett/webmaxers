/**
 * Shared navigation data for breadcrumb UI, JSON-LD and other consumers.
 * Page relationships and URLs come from query/prepareEntry, never URL segments.
 * Rendering is optional. Displayed trails replace the automatic schema fallback.
 */
import type { CollectionEntry, CollectionKey } from "astro:content";
import { siteData } from "@site/content/siteData";
import { absoluteWebUrl, canonicalWebUrl } from "@/utils/links/linkBehavior";
import { getPageCanonicalUrl } from "@/utils/seo";
import { humanizeSlug } from "@/utils/string";

export interface BreadcrumbItem {
  label: string;
  /** Navigation destination. The current item is rendered as text by the UI. */
  url?: string;
  /** Absolute page identity; may differ from the navigation URL. */
  canonicalUrl?: string;
}
export type BreadcrumbInput = BreadcrumbItem & { href?: string };
export interface BreadcrumbOptions {
  items?: readonly BreadcrumbInput[] | false;
  entry?: CollectionEntry<CollectionKey>;
  collection?: CollectionKey;
  title?: string;
  includeHome?: boolean;
  includeCollection?: boolean;
  homeLabel?: string;
  /** Compatibility for a design that displays short slug labels. */
  labelStyle?: "title" | "slug";
}
type Page = { locals: Record<string | symbol, any>; url: URL };
const key = Symbol("greastro.breadcrumbs");
type State = { fallback?: Promise<BreadcrumbItem[]>; displayed: Map<string, BreadcrumbItem[]> };
function state(locals: Page["locals"]): State {
  return locals[key] ??= { displayed: new Map() };
}
function pathOf(value: string): string {
  return new URL(value, siteData.url).pathname.replace(/\/+$/, "") || "/";
}
function slugLabel(value: string): string {
  try { return humanizeSlug(decodeURIComponent(value)); }
  catch { return humanizeSlug(value); }
}

/** Normalize once for every consumer; non-page intermediate groups are omitted. */
export function normalizeBreadcrumbs(items: readonly BreadcrumbInput[], currentUrl: string): BreadcrumbItem[] {
  const result: BreadcrumbItem[] = [];
  for (const [index, item] of items.entries()) {
    const label = item.label?.trim();
    if (!label) throw new Error("[breadcrumbs] Every item needs a label.");
    const last = index === items.length - 1;
    const url = item.url ?? item.href;
    if (!last && !url) continue;
    const canonicalUrl = last ? currentUrl : absoluteWebUrl(item.canonicalUrl ?? url, currentUrl);
    if (!canonicalUrl || (url && !absoluteWebUrl(url, currentUrl))) {
      throw new Error(`[breadcrumbs] Invalid web-page URL for ${label}.`);
    }
    if (new URL(canonicalUrl).hash || (url && new URL(url, currentUrl).hash)) {
      throw new Error(`[breadcrumbs] ${label} points to a section, not a page.`);
    }
    // UI keeps its local navigation URL; schema uses the same page's canonical identity.
    const crumb = { label, url: last ? currentUrl : url, canonicalUrl };
    if (result.at(-1)?.canonicalUrl === canonicalUrl) result[result.length - 1] = crumb;
    else result.push(crumb);
  }
  return result;
}

export async function resolveBreadcrumbs(
  pathname: string,
  currentUrl: string,
  options: BreadcrumbOptions = {},
): Promise<BreadcrumbItem[]> {
  if (options.items !== undefined) return options.items === false ? [] : normalizeBreadcrumbs(options.items, currentUrl);
  const path = pathOf(pathname);
  if (path === "/") return [];
  const { getCollectionNames, getCollectionMeta, prepareEntry } = await import("@/utils/collections");
  const { find, getBreadcrumbs } = await import("@/utils/query");
  const { shouldCollectionHavePage } = await import("@/utils/pages");
  const names = getCollectionNames() as CollectionKey[];
  const home = options.includeHome === false ? [] : [{ label: options.homeLabel ?? "Home", url: "/" }];
  const labelFor = (id: string, title?: string) => options.labelStyle === "slug" ? slugLabel(id) : title || slugLabel(id);
  let entry = options.entry;
  let collection = options.collection ?? entry?.collection;
  // Match existing generated page URLs, including an item's own rootPath override.
  // This lookup does not infer a parent from the number of URL segments.
  if (!entry) {
    for (const name of collection ? [collection] : names) {
      const meta = getCollectionMeta(name);
      if (path === `/${name}` && shouldCollectionHavePage(meta)) {
        return normalizeBreadcrumbs([...home, { label: labelFor(name, meta.title), url: path }], currentUrl);
      }
      const id = path.startsWith(`/${name}/`) ? path.slice(name.length + 2) : path.slice(1);
      const candidate = await find(name, id);
      if (!candidate) continue;
      const prepared = await prepareEntry(candidate, name, meta);
      if (prepared.pageUrl && pathOf(prepared.pageUrl) === path) { entry = candidate; collection = name; break; }
    }
  }
  if (!entry || !collection) {
    // Hand-written routes can pass items explicitly. Do not invent intermediate routes.
    return normalizeBreadcrumbs([...home, { label: options.title || slugLabel(path.split("/").at(-1)!), url: path }], currentUrl);
  }
  const meta = getCollectionMeta(collection);
  if (!(await prepareEntry(entry, collection, meta)).pageUrl) return [];
  const result: BreadcrumbItem[] = [...home];
  if (options.includeCollection !== false && shouldCollectionHavePage(meta)) {
    const url = `/${collection}`;
    result.push({ label: labelFor(collection, meta.title), url, canonicalUrl: canonicalWebUrl(url, siteData.url, meta.seo?.canonicalUrl) });
  }
  for (const relation of await getBreadcrumbs(collection, entry.id, true)) {
    if (!relation.entry) continue;
    const prepared = await prepareEntry(relation.entry, collection, meta);
    if (!prepared.pageUrl) continue; // No drafts, disabled pages, card links or section anchors.
    result.push({ label: labelFor(relation.id, prepared.title), url: prepared.pageUrl, canonicalUrl: prepared.canonicalUrl });
  }
  return normalizeBreadcrumbs(result, currentUrl);
}

/** BaseLayout establishes the automatic trail; no breadcrumb UI is required. */
export async function initializeBreadcrumbs(page: Page, options: BreadcrumbOptions = {}): Promise<BreadcrumbItem[]> {
  const data = state(page.locals);
  data.fallback ??= resolveBreadcrumbs(page.url.pathname, getPageCanonicalUrl(page.locals, page.url.pathname), options);
  return data.fallback;
}

/** Call from breadcrumb UI (including custom designs); return AND register the same data. */
export async function useBreadcrumbs(page: Page, options?: BreadcrumbOptions): Promise<BreadcrumbItem[]> {
  const items = options
    ? await resolveBreadcrumbs(page.url.pathname, getPageCanonicalUrl(page.locals, page.url.pathname), options)
    : await initializeBreadcrumbs(page);
  state(page.locals).displayed.set(JSON.stringify(items), items);
  return items;
}

/** After the body renders, prefer displayed trails and dedupe repeated UI instances. */
export async function getBreadcrumbTrails(locals: Page["locals"]): Promise<BreadcrumbItem[][]> {
  const data = state(locals);
  return data.displayed.size ? [...data.displayed.values()] : [await data.fallback ?? []];
}
