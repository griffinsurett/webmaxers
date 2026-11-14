// src/utils/schema/transforms.ts
/**
 * Reusable value transforms, referenced by name from field maps
 * (`{ from: "featuredImage", as: "image" }`). Each receives the values of the
 * spec's `from` fields, in order, and returns the schema value (undefined =
 * leave the property out).
 *
 * Adding a new kind of value (dates, SKUs, durations…) means adding one
 * function here; every kind and every site map can then use it.
 */
import { siteData } from "@site/content/siteData";
import { getImageUrl } from "@/utils/images";
import { resolveAuthorId } from "@/utils/seo";
import { BUSINESS_ID, buildAreaServed, buildPersonSchema } from "./identity";
import { find, normalizeReference } from "@/utils/query";
import { getCollectionMeta, prepareEntry } from "@/utils/collections";
import type { SchemaContext } from "./types";
import { absoluteWebUrl } from "@/utils/links/linkBehavior";
import { itemIdentity } from "./itemIdentity";

type Transform = (values: unknown[], ctx: SchemaContext) => unknown | Promise<unknown>;

const present = (v: unknown) =>
  v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
const first = (values: unknown[]) => values.find(present);

const absoluteUrl = (src?: string) => absoluteWebUrl(src, siteData.url);

export { parsePrice } from "./numbers";
import { parsePrice, ratingValue } from "./numbers";

const UNIT_CODES: Record<string, string> = { day: "DAY", week: "WEE", month: "MON", year: "ANN" };

/** "15 Days of Access" → QuantitativeValue { 15, DAY }. */
export function parsePeriod(length: unknown) {
  const m = String(length ?? "").match(/(\d+)\s*(day|week|month|year)s?/i);
  if (!m) return undefined;
  return { "@type": "QuantitativeValue", value: Number(m[1]), unitCode: UNIT_CODES[m[2].toLowerCase()] };
}

/**
 * An Offer from a price and a length. "Per Month" / "Monthly"
 * reads as a subscription billed monthly; "N days/months of access" as a
 * one-time price for that period.
 */
export function buildOffer(
  input: { name?: string; price?: unknown; length?: unknown },
  url: string,
): Record<string, any> | undefined {
  const price = parsePrice(input.price, siteData.currency);
  if (!price) return undefined;
  const currency = siteData.currency;
  const length = String(input.length ?? "");
  const monthly = /per month|monthly/i.test(length);
  const period = monthly ? undefined : parsePeriod(length);
  return {
    "@type": "Offer",
    ...(input.name && { name: input.name }),
    price,
    priceCurrency: currency,
    url,
    ...(monthly && {
      category: "Subscription",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: currency,
        billingDuration: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
    }),
    ...(period && { eligibleDuration: period }),
  };
}

export const transforms: Record<string, Transform> = {
  /** Plain text, whitespace collapsed. */
  text: (values) => {
    const v = first(values);
    return present(v) ? String(v).replace(/\s+/g, " ").trim() : undefined;
  },

  /** An image field (string or Astro image) → absolute URL. */
  image: (values) => {
    const v = first(values);
    return v ? absoluteUrl(getImageUrl(v as any, "")) : undefined;
  },

  /** [price, length] → Offer (see buildOffer). */
  offer: (values, ctx) =>
    buildOffer({ name: ctx.data.title, price: values[0], length: values[1] }, ctx.url),

  /** A date field → ISO 8601 string. */
  date: (values) => {
    const v = first(values);
    if (!present(v)) return undefined;
    const d = v instanceof Date ? v : new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  },

  /** An `authors` reference (or id) → the person node's @id. */
  person: async (values) => {
    const id = resolveAuthorId(first(values));
    if (!id) return undefined;
    const person = await buildPersonSchema(id);
    if (!person) throw new Error(`[schema] Author/instructor reference "${id}" has no published author identity.`);
    return person;
  },

  /** Explicit typed references use the existing query and page preparation rules. */
  reviewTarget: async (values, ctx) => {
    if (!first(values)) return undefined;
    const refs = normalizeReference(first(values));
    if (refs.length !== 1 || !refs[0].collection) throw new Error(`[schema] Review on ${ctx.url} needs exactly one typed reviewedItem reference.`);
    const ref = refs[0];
    const entry = await find(ref.collection, ref.id) as { id: string; data: Record<string, any> } | undefined;
    if (!entry) throw new Error(`[schema] Review on ${ctx.url} references missing/unpublished ${ref.collection}/${ref.id}.`);
    const meta = getCollectionMeta(ref.collection);
    const prepared = await prepareEntry(entry as any, ref.collection, meta);
    const { getLayoutPath, getLayoutSchemaKind } = await import("@/layouts/collections/helpers/layoutUtils");
    const kindName = getLayoutSchemaKind(getLayoutPath(meta, entry, true));
    const { kinds } = await import("./kinds");
    const kind = kindName ? kinds[kindName as keyof typeof kinds] : undefined;
    if (!kind || kind.mode !== "item") {
      throw new Error(`[schema] The selected layout for ${ref.collection}/${ref.id} must export a registered item schemaKind before it can be a reviewedItem.`);
    }
    const identity = itemIdentity(kindName!, prepared, ctx.url);
    return {
      "@id": identity.id,
      "@type": kind.type,
      name: entry.data.title,
      ...(identity.url && { url: identity.url }),
    };
  },

  /** The site's business entity, by @id. Ignores content. */
  business: () => ({ "@id": BUSINESS_ID }),

  /** Local businesses: the `service-areas` collection. Online: nothing. */
  serviceAreas: async () => {
    const areas = await buildAreaServed();
    return areas.length > 0 ? areas : undefined;
  },

  /** A 1–5 number → Rating. Missing stays missing (never invented). */
  rating: (values) => {
    const n = ratingValue(first(values));
    return n !== undefined
      ? { "@type": "Rating", ratingValue: n, bestRating: 5, worstRating: 1 }
      : undefined;
  },

  /** The item URL is supplied by preparation; page-less items can omit it. */
  url: (_values, ctx) => ctx.entityUrl,

  /** The site's language (siteData.language). */
  language: () => siteData.language,
};
