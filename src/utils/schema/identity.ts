// src/utils/schema/identity.ts
/**
 * Site-wide identity schema — who is behind the site. Emitted on every page by
 * SEO.astro; everything else (the page subject, reviews, posts) attaches to
 * these by @id, so search engines see one coherent graph.
 *
 *   business  siteData (legalName, schemaType, foundingDate, …) + contact-us +
 *             social-media (+ service-areas and hours for local businesses)
 *   people    the `authors` collection, by entry id
 *   website   this domain, published by the business
 */
import { siteData as activeSiteData } from "@site/content/siteData";
import type { SiteSchemaSettings } from "@/utils/schema/types";
const siteData: SiteSchemaSettings = activeSiteData;
import { query, sortByOrder, byTag as queryByTag } from "@/utils/query";
import { formatPhoneNumber } from "@/utils/string";
import { canonicalWebUrl } from "@/utils/links/linkBehavior";
import { resolveAuthorEntry } from "@/utils/seo";

/** The company's home — a parent URL for multi-site brands, else this site. */
export const BUSINESS_URL = canonicalWebUrl(siteData.parentUrl ?? siteData.url, siteData.url);
export const BUSINESS_ID = `${BUSINESS_URL}#business`;
export const BUSINESS_TYPE = siteData.schemaType;
export const BUSINESS_NAME = siteData.legalName ?? siteData.title;
export const WEBSITE_ID = `${canonicalWebUrl("/", siteData.url)}#website`;

/** A person's @id, keyed by their `authors` entry id. */
export const personId = (authorId: string) => `${BUSINESS_URL}#person-${encodeURIComponent(authorId)}`;

/**
 * Types with no physical location. Anything else is treated as local and gets
 * the address, hours and service area. EducationalOrganization is deliberately
 * NOT here: schema.org files it under Place, so Google reads it as local — use
 * OnlineBusiness for online education.
 */
const ONLINE_TYPES = new Set(["OnlineBusiness", "OnlineStore", "Organization", "Corporation", "NGO"]);
export const IS_ONLINE_BUSINESS = ONLINE_TYPES.has(BUSINESS_TYPE);

/** A collection that doesn't exist on this site reads as empty. */
export async function entriesOf(collection: string): Promise<any[]> {
  const { getCollectionNames } = await import("@/utils/collections");
  if (!getCollectionNames().includes(collection)) return [];
  try {
    return await query(collection as any).orderBy(sortByOrder()).all();
  } catch (cause) {
    throw new Error(`[schema] Failed to load configured collection "${collection}".`, { cause });
  }
}

/** Service areas (local businesses), from the `service-areas` collection. */
export async function buildAreaServed() {
  if (IS_ONLINE_BUSINESS) return [];
  const areas = await entriesOf("service-areas");
  return areas
    .filter((a) => a.data?.title)
    .map((a) => ({ "@type": a.data?.areaType ?? "Place", name: a.data.title }));
}

/** Founders are explicit author tags, independent of page generation and authorship. */
export async function founderIds(): Promise<string[]> {
  const { getCollectionNames } = await import("@/utils/collections");
  if (!getCollectionNames().includes("authors")) return [];
  const founders = await queryByTag("authors", "founder").all();
  return founders.filter((entry) => "title" in entry.data && entry.data.title).map((entry) => entry.id);
}

const byTag = (entries: any[], tag: string) => entries.find((e) => e.data?.tags?.includes(tag));
const contactValue = (entry: any) =>
  String(entry?.data?.value ?? entry?.data?.description ?? "").trim();

/** Phone from its contact entry, with that entry's own country code. */
function buildPhone(entry: any): string | undefined {
  const digits = contactValue(entry).replace(/\D/g, "");
  if (!digits) return undefined;
  const cc = String(entry?.data?.phoneCountryCode ?? "1");
  return digits.length === 10 ? `+${cc}-${formatPhoneNumber(digits)}` : `+${digits}`;
}

/** PostalAddress from the address contact entry's structured fields. */
function buildAddress(entry: any) {
  const d = entry?.data;
  if (!d?.streetAddress) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: d.streetAddress,
    ...(d.addressLocality && { addressLocality: d.addressLocality }),
    ...(d.addressRegion && { addressRegion: d.addressRegion }),
    ...(d.postalCode && { postalCode: d.postalCode }),
    ...(d.addressCountry && { addressCountry: d.addressCountry }),
  };
}

export async function buildBusinessSchema(
  options: { logoUrl?: string } = {},
): Promise<Record<string, any>> {
  const [contacts, socials, areaServed, founders] = await Promise.all([
    entriesOf("contact-us"),
    entriesOf("social-media"),
    buildAreaServed(),
    founderIds(),
  ]);

  const telephone = buildPhone(byTag(contacts, "phone"));
  const email = contactValue(byTag(contacts, "email")) || undefined;
  const address = IS_ONLINE_BUSINESS ? undefined : buildAddress(byTag(contacts, "address"));
  const hours = IS_ONLINE_BUSINESS
    ? []
    : (contacts.find((c) => c.data?.hours?.length)?.data.hours ?? []).map((h: any) => ({
        "@type": "OpeningHoursSpecification",
        ...h,
      }));
  const sameAs = socials
    .map((s) => s.data?.link)
    .filter((l): l is string => typeof l === "string" && l.startsWith("http"));

  return {
    "@type": BUSINESS_TYPE,
    "@id": BUSINESS_ID,
    name: BUSINESS_NAME,
    ...(siteData.title !== BUSINESS_NAME && { alternateName: siteData.title }),
    ...(siteData.description && { description: siteData.description }),
    url: BUSINESS_URL,
    ...(options.logoUrl && { logo: options.logoUrl, image: options.logoUrl }),
    ...(siteData.foundingDate && { foundingDate: siteData.foundingDate }),
    ...(founders.length && { founder: founders.map((id) => ({ "@id": personId(id) })) }),
    ...(telephone && { telephone }),
    ...(email && { email }),
    ...(address && { address }),
    ...(areaServed.length > 0 && { areaServed }),
    ...(hours.length > 0 && { openingHoursSpecification: hours }),
    ...(sameAs.length > 0 && { sameAs }),
  };
}

/**
 * A Person node from an `authors` entry: name, job title, profile links from
 * its `social` block. Null when the entry doesn't exist, so a stray id never
 * yields a half-empty person.
 */
export async function buildPersonSchema(authorId: string): Promise<Record<string, any> | null> {
  const author = await resolveAuthorEntry(authorId);
  if (!author?.data?.title) return null;
  const sameAs = Object.values(author.data.social ?? {}).filter(
    (v): v is string => typeof v === "string" && v.startsWith("http"),
  );
  return {
    "@type": "Person",
    "@id": personId(author.id),
    name: author.data.title,
    ...(author.data.role && { jobTitle: author.data.role }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(author.data.description && { description: author.data.description }),
  };
}

/** This domain as a WebSite, published by the business. */
export function buildWebSiteSchema(): Record<string, any> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: siteData.url,
    name: siteData.title,
    ...(siteData.description && { description: siteData.description }),
    inLanguage: siteData.language,
    publisher: { "@id": BUSINESS_ID },
  };
}
