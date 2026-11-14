// src/utils/schema/kinds/offerings.ts
/**
 * Page-subject kinds — what an item page is about. A layout declares one
 * (`resolveSubject(Astro, { kind: "service", entry })`); review sections on
 * that page then attach to it.
 *
 * Each is a field map over Greastro's standard item fields. A site whose
 * content names things differently remaps them in src/utils/schema/siteMap.ts.
 */
import { siteData as activeSiteData } from "@site/content/siteData";
import type { SiteSchemaSettings } from "@/utils/schema/types";
const siteData: SiteSchemaSettings = activeSiteData;
import type { FieldMap, ItemKind } from "../types";

/** Fields every offering shares. */
const common: FieldMap = {
  name: { from: "title", as: "text" },
  description: { from: "description", as: "text" },
  url: { as: "url" },
  image: { from: "featuredImage", as: "image" },
  offers: { from: ["price", "length"], as: "offer" },
};

export const service: ItemKind = {
  mode: "item",
  type: "Service",
  required: ["name"],
  fields: {
    ...common,
    serviceType: ["category", "title"],
    provider: { as: "business" },
    areaServed: { as: "serviceAreas" },
  },
};

export const course: ItemKind = {
  mode: "item",
  type: "Course",
  required: ["name", "description", "provider"],
  fields: {
    ...common,
    courseCode: "courseCode",
    provider: { as: "business" },
    // An `authors` reference on the item, else the explicitly configured default instructor.
    instructor: { from: "instructor", as: "person", default: siteData.defaultInstructor },
    inLanguage: { as: "language" },
    // Total study time, ISO 8601 (e.g. "PT40H"). Google's Course info result
    // needs it; it's never invented — it's read from content or left out.
    courseWorkload: "courseWorkload",
    courseMode: "courseMode",
  },
  finalize: ({ courseWorkload, courseMode, instructor, ...node }) => ({
    ...node,
    ...((courseWorkload || courseMode || instructor) && { hasCourseInstance: {
      "@type": "CourseInstance",
      ...(courseMode && { courseMode }),
      ...(instructor && { instructor }),
      ...(courseWorkload && { courseWorkload }),
    } }),
  }),
};

export const product: ItemKind = {
  mode: "item",
  type: "Product",
  required: ["name", "offers"],
  fields: {
    ...common,
    sku: "sku",
    brand: { as: "business" },
  },
};
