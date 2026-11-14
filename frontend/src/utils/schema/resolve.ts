// src/utils/schema/resolve.ts
/**
 * The resolver — turns a kind + content into a JSON-LD node, applying the
 * override layers in order (later wins):
 *
 *   1. the kind's field map          src/utils/schema/kinds/
 *   2. the site's map                src/utils/schema/siteMap.ts
 *   3. the component's `map`/`extra` <Schema kind="…" map={…} extra={…} />
 *   4. the entry's own `schema:`     frontmatter of one content entry
 *
 * and enforcing the rules no override can bend: required fields (incomplete
 * nodes are dropped with a build warning), honest ratings (`protectedFields`
 * can't be given fixed values), one FAQPage / one review set per target per
 * page, and linking by @id.
 */
import { collectSection, registerItemNode } from "./collector";
import { schemaMap } from "@site/utils/schema/siteMap";
import { kinds, type KindName } from "./kinds";
import { transforms } from "./transforms";
import type { FieldMap, FieldSpec, SchemaContext } from "./types";
import { getPageCanonicalUrl, setPageCanonicalUrl } from "@/utils/seo";
import { prepareSchemaEntry, itemIdentity } from "./itemIdentity";
import { assertOverrideKeys, validateSchemaNode } from "./validation";
import type { SEOData } from "@/content/schema";
import { getEntryKey } from "@/utils/query";

export interface ResolveOptions {
  kind: KindName;
  /** Item kinds: the entry the node is about. */
  entry?: { id?: string; data?: Record<string, any>; body?: string } | Record<string, any>;
  /** List kinds: the items the section shows (prepared items or entries). */
  items?: Array<Record<string, any>>;
  /** Layer 3: property overrides for this use. */
  map?: FieldMap;
  /** Layer 3: extra properties merged into the finished node. */
  extra?: Record<string, any>;
  /** Page pathname (Astro.url.pathname). */
  pathname: string;
  /** Astro.locals. */
  locals: Record<string, any>;
  /** For frontmatter callers that run before BaseLayout establishes page SEO. */
  seo?: SEOData;
  /** Set by resolveSubject; ordinary item calls represent embedded entries. */
  pageSubject?: boolean;
}

const present = (v: unknown) =>
  v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "") &&
  !(Array.isArray(v) && v.length === 0);

const read = (data: Record<string, any>, path: string) =>
  path.split(".").reduce<any>((o, k) => (o == null ? undefined : o[k]), data);

async function resolveField(spec: FieldSpec, ctx: SchemaContext): Promise<unknown> {
  if (spec === false) return undefined;
  const s = typeof spec === "string" || Array.isArray(spec) ? { from: spec } : spec;
  if ("value" in s) return s.value;
  if (s.resolve) return s.resolve(ctx);
  const from = s.from === undefined ? [] : Array.isArray(s.from) ? s.from : [s.from];
  let values = from.map((f) => read(ctx.data, f));
  if (!values.some(present) && s.default !== undefined) values = [s.default];
  if (s.as) {
    const transform = transforms[s.as];
    if (!transform) {
      console.warn(`[schema] Unknown transform "${s.as}"`);
      return undefined;
    }
    return transform(values, ctx);
  }
  return values.find(present);
}

async function mapFields(fields: FieldMap, ctx: SchemaContext) {
  const out: Record<string, any> = {};
  for (const [prop, spec] of Object.entries(fields)) {
    const value = await resolveField(spec, ctx);
    if (present(value)) out[prop] = value;
  }
  return out;
}

/** Layers 1–3 merged; protected fields keep content-only sources. */
function mergeMaps(kindName: KindName, componentMap?: FieldMap): FieldMap {
  const kind = kinds[kindName];
  const locked = kind.mode === "list" ? kind.lockedFields ?? [] : [];
  assertOverrideKeys(schemaMap[kindName], `${kindName} site map`, locked);
  assertOverrideKeys(componentMap, `${kindName} component map`, locked);
  const merged: FieldMap = { ...kind.fields, ...(schemaMap[kindName] ?? {}), ...(componentMap ?? {}) };
  for (const field of kind.mode === "list" ? kind.protectedFields ?? [] : []) {
    const spec = merged[field];
    if (spec && typeof spec === "object" && !Array.isArray(spec) &&
        ("value" in spec || "default" in spec || spec.resolve)) {
      throw new Error(`[schema] "${kindName}.${field}" can only be read from content; fixed/default/computed ratings are not allowed.`);
    }
  }
  return merged;
}

/** Layer 4: an entry's own `schema:` frontmatter, protected fields excepted. */
function entryOverrides(kindName: KindName, data: Record<string, any>) {
  const overrides = { ...(data.schema ?? {}) };
  const kind = kinds[kindName];
  assertOverrideKeys(overrides, `${kindName} entry ${data.id ?? data.title ?? ""}`, kind.mode === "list" ? Object.keys(kind.fields) : []);
  return overrides;
}

export async function resolveSchema(options: ResolveOptions): Promise<Record<string, any> | null> {
  const { kind: kindName, entry, items, map, extra, pathname, locals } = options;
  const kind = kinds[kindName];
  if (!kind) {
    console.warn(`[schema] Unknown kind "${kindName}"`);
    return null;
  }
  const pageUrl = options.seo ? setPageCanonicalUrl(locals, pathname, options.seo) : getPageCanonicalUrl(locals, pathname);
  const fields = mergeMaps(kindName, map);
  assertOverrideKeys(extra, `${kindName} on ${pathname}`);

  if (kind.mode === "list") {
    const baseCtx = { url: pageUrl, locals };
    const mapped = await Promise.all(
      (items ?? []).map(async (item) => {
        const data = await prepareSchemaEntry(item);
        if (data.draft) return null;
        return { ...(await mapFields(fields, { data, url: pageUrl, locals })), ...entryOverrides(kindName, data),
          _identity: data.id ? getEntryKey(data.collection ?? "", data.id) : undefined };
      }),
    );
    const key = kind.dedupeKey?.(baseCtx) ?? kindName;
    collectSection(locals, key, mapped.filter((item) => item !== null), (all) => {
      // A parent layout can collect a section before BaseLayout establishes SEO.
      const node = kind.build(all, { url: getPageCanonicalUrl(locals, pathname), locals });
      if (!node) return null;
      assertOverrideKeys(extra, `${kindName} on ${pathname}`, Object.keys(node));
      const result = { ...node, ...(extra ?? {}) };
      validateSchemaNode(result, `${kindName} on ${pathname}`);
      return result;
    });
    return null;
  }

  const data = await prepareSchemaEntry(entry);
  if (data.draft) return null;
  const identity = itemIdentity(kindName, data, pageUrl, options.pageSubject);
  const ctx: SchemaContext = { data, url: identity.url ?? pageUrl, entityUrl: identity.url, locals };
  let node: Record<string, any> = {
    "@type": kind.type,
    "@id": identity.id,
    ...(await mapFields(fields, ctx)),
  };
  if (kind.finalize) node = kind.finalize(node, ctx);
  node = { ...node, ...(extra ?? {}), ...entryOverrides(kindName, data) };
  validateSchemaNode(node, `${kindName} ${data.id ?? ""} on ${pathname}`);

  const missing = (kind.required ?? []).filter((p) => !present(node[p]));
  if (missing.length > 0) {
    console.warn(`[schema] ${kind.type} on ${pathname} is missing ${missing.join(", ")} — not emitted.`);
    return null;
  }
  registerItemNode(locals, node);
  return { "@context": "https://schema.org", ...node };
}

/**
 * Apply the site map's entry for a node that isn't built from a kind — the
 * business (`schemaMap.business`). Same field specs as kinds; e.g. a multi-site
 * brand adding `brand` / `alternateName` to the shared business entity.
 */
export async function applySiteMap(
  key: string,
  node: Record<string, any>,
  context: { pathname: string; locals: Record<string, any> },
): Promise<Record<string, any>> {
  const fields = schemaMap[key];
  if (!fields) return node;
  assertOverrideKeys(fields, `${key} site map`);
  const url = getPageCanonicalUrl(context.locals, context.pathname);
  const additions: Record<string, any> = {};
  const removals: string[] = [];
  for (const [prop, spec] of Object.entries(fields)) {
    if (spec === false) {
      removals.push(prop);
      continue;
    }
    const value = await resolveField(spec, { data: node, url, locals: context.locals });
    if (present(value)) additions[prop] = value;
  }
  const out = { ...node, ...additions };
  for (const prop of removals) delete out[prop];
  validateSchemaNode(out, `${key} on ${context.pathname}`);
  return out;
}

/**
 * Resolve an item kind as the page's SUBJECT — call from a layout's
 * frontmatter (it runs before the page's sections render). Review sections may reference it explicitly through their content relationships.
 */
export async function resolveSubject(
  astro: { url: URL; locals: Record<string, any>; props?: Record<string, any> },
  options: Omit<ResolveOptions, "pathname" | "locals" | "pageSubject">,
): Promise<Record<string, any> | null> {
  const seo = options.seo ?? astro.props?.seoProps?.seo ?? (options.entry?.data ?? options.entry)?.seo;
  setPageCanonicalUrl(astro.locals, astro.url.pathname, seo);
  const node = await resolveSchema({
    ...options,
    pathname: astro.url.pathname,
    locals: astro.locals,
    pageSubject: true,
  });
  if (node) {
    const previous = astro.locals.schemaSubject;
    if (previous && (previous["@id"] !== node["@id"] || previous.name !== node.name)) {
      throw new Error(`[schema] ${astro.url.pathname} already has a page subject. Use Schema with an entry for additional displayed items.`);
    }
    astro.locals.schemaSubject = {
      "@id": node["@id"],
      "@type": node["@type"],
      ...(node.name && { name: node.name }),
      ...(node.url && { url: node.url }),
    };
  }
  return node;
}
