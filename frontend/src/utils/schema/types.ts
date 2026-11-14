// src/utils/schema/types.ts
/**
 * Types for the schema system — see ./README.md for how the pieces fit.
 */

/** Everything a transform or resolver can see while building one node. */
export interface SchemaContext {
  /** The content entry's data (an item page's entry, or one list item). */
  data: Record<string, any>;
  /** Item URL when present, otherwise the displaying page's canonical URL. */
  url: string;
  /** The item's own web URL, if any (a page-less entry need not have one). */
  entityUrl?: string;
  /** Astro.locals — shared across the page for subject/dedupe state. */
  locals: Record<string, any>;
}

/**
 * How one schema property is filled. Shorthands:
 *   "title"                 → first value of that content field
 *   ["category", "title"]   → first of those fields that has a value
 *   false                   → leave the property out
 */
export type FieldSpec =
  | string
  | string[]
  | false
  | {
      /** Content field(s) to read. Several are passed together to `as`. */
      from?: string | string[];
      /** A transform from ./transforms.ts (image, offer, person, …). */
      as?: string;
      /** Used when the content fields are empty. Also goes through `as`. */
      default?: unknown;
      /** A fixed value — ignores content. */
      value?: unknown;
      /** Full control: compute the value yourself. */
      resolve?: (ctx: SchemaContext) => unknown | Promise<unknown>;
    };

/** schema.org property → how to fill it. */
export type FieldMap = Record<string, FieldSpec>;

/** One node built from one entry — the page's subject (Service, Course, …). */
export interface ItemKind {
  mode: "item";
  type: string;
  /** Minimum properties for this kind; a node missing one is dropped with a warning. */
  required?: string[];
  fields: FieldMap;
  /** Final shaping after mapping (e.g. nesting into hasCourseInstance). */
  finalize?: (node: Record<string, any>, ctx: SchemaContext) => Record<string, any>;
}

/** One node built from the items a section shows (FAQPage, reviews). */
export interface ListKind {
  mode: "list";
  /** How each item's values are read — a "virtual" property map per item. */
  fields: FieldMap;
  build: (
    items: Array<Record<string, any>>,
    ctx: Omit<SchemaContext, "data">,
  ) => Record<string, any> | null;
  /** Page-level dedupe key: two sections with the same key emit once. */
  dedupeKey?: (ctx: Omit<SchemaContext, "data">) => string;
  /** Map keys overrides may not fill with fixed values (e.g. ratings). */
  protectedFields?: string[];
  /** These inputs must come from the rendering boundary without remapping. */
  lockedFields?: string[];
}

export type SchemaKind = ItemKind | ListKind;

/** Per-site field remapping: kind name → property overrides. */
export type SchemaMap = Record<string, FieldMap>;

/** Portable site identity contract; optional settings need not exist on every site's object. */
export interface SiteSchemaSettings {
  title: string;
  url: string;
  schemaType: string;
  language: string;
  currency: string;
  legalName?: string;
  description?: string;
  parentUrl?: string;
  foundingDate?: string;
  defaultAuthor?: string;
  defaultInstructor?: string;
}
