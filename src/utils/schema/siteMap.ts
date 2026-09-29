// src/utils/schema/siteMap.ts
/**
 * This site's structured-data field mapping — layer 2 of 4 (see
 * src/utils/schema/README.md). Empty when the content uses Greastro's standard
 * field names; add a kind only where this site differs.
 *
 * The special key `business` adjusts the site-wide business node the same way
 * (e.g. a multi-site brand adding `brand`, or `areaServed: false`).
 *
 * @example
 *   export const schemaMap: SchemaMap = {
 *     service: {
 *       offers: { from: ["cost", "billing"], as: "offer" }, // renamed fields
 *       award: { from: "certifications" },                  // extra property
 *       areaServed: false,                                  // leave it out
 *     },
 *     course: {
 *       // Offers that live in a related collection:
 *       offers: {
 *         resolve: async ({ data, url }) => {
 *           const plans = await query("pricing").where((p) => p.data.part === data.id).all();
 *           return plans.map((p) => buildOffer({ name: p.data.title, price: p.data.price, length: p.data.length }, url));
 *         },
 *       },
 *     },
 *   };
 */
import type { SchemaMap } from "@/utils/schema/types";

export const schemaMap: SchemaMap = {};
