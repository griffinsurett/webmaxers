import { siteData } from "@site/content/siteData";
import { absoluteWebUrl, canonicalWebUrl } from "@/utils/links/linkBehavior";
import { getCollectionMeta, prepareEntry } from "@/utils/collections";

/** Consume the existing preparation/routing contract; never rebuild item paths here. */
export async function prepareSchemaEntry(entry: Record<string, any> = {}): Promise<Record<string, any>> {
  if (entry.data && entry.collection && entry.id) {
    return prepareEntry(entry as any, entry.collection, getCollectionMeta(entry.collection));
  }
  return entry.data ? { ...entry.data, id: entry.id, collection: entry.collection } : entry;
}

/** A page subject keeps its established #kind ID; embedded entries have their own identities. */
export function itemIdentity(kind: string, data: Record<string, any>, pageUrl: string, pageSubject = false) {
  if (pageSubject) return { id: `${pageUrl}#${kind}`, url: pageUrl };
  const canonical = data.canonicalUrl ?? data.seo?.canonicalUrl;
  if (canonical) {
    const url = canonicalWebUrl("/", siteData.url, canonical);
    return { id: `${url}#${kind}`, url };
  }
  const url = absoluteWebUrl(data.url, pageUrl);
  if (!data.id) {
    throw new Error(`[schema] Embedded ${kind} on ${pageUrl} needs an entry ID or canonical URL.`);
  }
  // Collection identity stays stable even when there is no public item page.
  const base = data.collection ? canonicalWebUrl("/", siteData.url) : pageUrl;
  const key = [kind, data.collection, data.id].filter(Boolean).map((part) => encodeURIComponent(String(part))).join("/");
  return { id: `${base}#item/${key}`, url };
}
