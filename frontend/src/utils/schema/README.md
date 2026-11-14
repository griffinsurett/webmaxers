# Structured data

Greastro builds structured data from siteData, existing collections and the items
components actually render. The schema layer does not select a second set of
content or replace the query/reference system.

## File organization

- `src/components/Schema/`: Schema, JsonLd, SchemaBoundary and RenderedAnswer.
- `src/utils/schema/`: resolver, kinds, transforms, validation and the site's
  technical field adapter (`siteMap.ts`, exporting `schemaMap`).
- `src/content/siteData.ts`: sitewide facts/settings, including business type.
- `src/content/schema.ts`: collection/Zod validation; this is a different use of
  “schema” and stays with the content system.

ContentBridge imports the answer-capture component from the Schema folder. The
active-site adapter is imported through `@site/utils/schema/siteMap`; move a
site's existing custom map and update this import when porting the template.

Shared responsibilities stay in the existing utilities:

- `query.related` selects a service's FAQs for both the accordion and its schema.
- `seo.resolveAuthorEntry` supplies published authors to bylines and Person nodes;
  a reference to another collection cannot become an author accidentally.
- `collections.prepareEntry` prepares raw section entries as well as item entries.
  Prepared items pass through unchanged; collection IDs use `query.getEntryKey`.
- `collections.getTestimonialQuote` selects the quote for TestimonialCard and the
  default review map. Custom renderers/maps must use their actual displayed fields.
- Static route generation and preparation share the primary-parent helper and
  page rules, including parent `childHasPage` and collection `itemsChildHasPage`.

## Site setup

- Set business identity, `schemaType`, currency and language in `siteData.ts`.
  `parentUrl` optionally identifies a shared business across multiple sites.
- Tag actual founder records in `authors` with `tags: ["founder"]`. Several
  founders are supported. Founders do not need public author pages; keep authors
  `hasPage` and `itemsHasPage` false unless useful profiles have been built.
- `defaultAuthor` and `defaultInstructor` are optional author IDs in siteData.
  These are separate relationships: founder status does not imply either role.
  Explicit content references take precedence.
- Contact facts come from `contact-us`; social profiles from `social-media`;
  local service areas from `service-areas`. Missing facts are omitted.
- Replace starter identities before launch. Never use placeholder people as real
  founders or assume every contributing author works for the business.

## Rendering and ownership

| Data | Owner | Source |
|---|---|---|
| Business, WebSite, Person, WebPage/BlogPosting | SEO layout | siteData, collections, page metadata |
| BreadcrumbList | SchemaBoundary, after body rendering | Shared breadcrumb resolver; exact displayed trails when UI exists |
| Service, Course, Product | Routed item layout | entry supplied by the route |
| FAQPage | Accordion + ContentBridge | actual rendered question answers |
| Review / AggregateRating | Testimonial variant | actual displayed reviews |

Layouts call `resolveSubject(Astro, { kind: schemaKind, entry, seo: seoProps.seo })` and render
`<Schema node={subject} />`. ServiceLayout demonstrates this. Course and product
kinds are available for site-specific routed layouts; registering a collection
alone does not claim its items are courses or products.

Export `const schemaKind = "service"` (or the appropriate registered item kind)
from that layout. Reference resolution reads this export through the existing
itemLayout/itemsLayout selection; collection names do not determine types.
An embedded item uses `<Schema kind="service" entry={entry} />`, with its
collection identity or an explicit stable item ID. Only the main page subject
uses `resolveSubject`.

AccordionVariant infers FAQ semantics only when ContentRenderer supplies the
`faq` collection context. Other accordions need an explicit `schema="faq"` when
they really display questions and answers. `schema={false}` disables emission.
ContentBridge renders the MDX once, preserves it for React, and passes the same
rendered answer through `answerHtml` to retain prose, lists, emphasis and links
without scripts, navigation or hydration attributes. Raw MDX is not an answer.
Custom FAQ renderers must similarly provide `renderedAnswer` from displayed HTML.
If an accordion displays `description` before the MDX body, enable
`includeDescription` on ContentBridge and pass its existing paragraph styles as
`descriptionClassName`. Let React display that complete bridge answer; remove
its separate description output. This captures description-only answers and
description-plus-body answers without duplicating text or guessing which fields
are visible. The default stays off for consumers that display only the body.

SchemaBoundary awaits the complete body slot, including nested content and the
header/footer, before serializing collected sections. Its state lives solely in
Astro.locals. It combines later sections, deduplicates collection + entry IDs,
and rejects conflicting representations of the same item. Do not emit collected
sections outside BaseLayout without an equivalent boundary.

Business testimonials remain business reviews, even on an offering page.
`reviewedItem` is an explicit typed collection reference for an offering review;
the resolver reuses `find`, collection metadata and `prepareEntry` to resolve it.
The starter permits services; extend the existing reference schema when adding
other offering collections. Missing/unpublished explicit targets and layouts
without a declared item kind produce actionable errors. Ratings are optional, constrained to 1–5,
and never defaulted. Aggregates describe only the displayed review set. Semantic
markup is not a promise that search engines will award review stars.

## URLs inherit the existing routing system

- `utils/collections/prepare.ts` owns item preparation and page/link decisions.
  Its `url` is the displayed link; `pageUrl` is the generated page path and
  `canonicalUrl` applies the existing merged item/collection SEO settings.
  These differ when a card links to a checkout, a contact protocol or nowhere.
  `mergeItemSEO` inherits collection-wide policy such as robots and keywords,
  but excludes index titles, descriptions, social images and canonical URLs.
  Item-level SEO overrides still win; an index's identity never becomes every
  item's identity.
- `utils/links/linkBehavior.ts` provides the shared absolute-web-link and
  canonical rules. `utils/seo.ts` supplies page-local canonical context to
  BaseLayout, SEO and the schema resolver. Pass the same SEO settings to a
  subject resolver and BaseLayout; conflicting values fail rather than split
  the graph. Explicit canonical overrides retain their trailing-slash choice.
  Direct `resolveSchema` frontmatter calls can supply the same `seo` object
  before BaseLayout runs. Collected section IDs use the final page context.
- Routed item identities retain `canonical#kind`. Embedded entries with pages
  reuse their prepared canonical. Page-less collection entries use stable site
  fragments derived from kind, collection and entry ID; no route is fabricated.
  Standalone manual entries need an ID (scoped to the displaying page) or an
  explicit canonical URL. Duplicate conflicting item identities fail the build.
- Review references reuse `find`, the selected layout's schemaKind and the same
  preparation/identity helper as the emitted item. Contact links are not treated
  as HTTP page URLs. Missing optional collections are allowed; unexpected errors
  loading a configured collection are surfaced.

## Mapping and extension

`src/utils/schema/siteMap.ts` remaps existing fields when a site differs. Resolution
order is kind defaults → site map → component map → entry schema overrides.
`schemaMap.business` adjusts the business node. Fixed/default rating mappings
are rejected. Keep overrides factual; they are not a way to manufacture data.

Overrides cannot replace engine-owned IDs/types/URLs, captured FAQ inputs, or generated
question/review relationships. Section entry overrides cannot replace mapped
rendered fields. The final graph is checked again after overrides and at safe
serialization for numeric prices, currency, offer shape, rating scales and
counts. These focused checks do not replace external vocabulary validation or
verification against the page's visible content.

Kinds are registered in `kinds/index.ts`. Add a kind when real content needs it,
with meaningful required fields and a renderer/layout that owns its output.
Unused kinds emit nothing. This is an extensible library, not complete coverage
of every Schema.org type. Event, employment, recipe and other domain-specific
adapters need their own content contracts and verification before use.

Offers accept exact nonnegative numeric prices (including zero), not ranges or
marketing copy. Availability is not assumed. Monthly billing requires an actual
monthly description; "recurring" alone does not establish its interval.
Course instances use explicit course mode, instructor and workload data.

## Shared author loading

Standalone sites continue using `FileLoad("authors", "authors.json")`.
A multisite can opt into ordered shared and local JSON sources:

```ts
FileLoad("authors", "authors.json", {
  sources: ["../../src/content/authors/authors.json", "src/content/authors/authors.json"],
})
```

Paths are relative to the active Astro project root. Objects merge recursively;
explicit arrays replace inherited arrays. Partial local records are validated
only after merging. Duplicate IDs within one source fail. Source changes,
removal and restoration refresh the collection; removed records do not linger.
Use root-relative public image URLs for shared JSON assets; relative asset paths
are interpreted against the last source defining the record. An empty local
array inherits shared authors; it does not delete them. Use the existing draft
field to hide an inherited record on one site.

## Portability and output

Portable schema code reads `@site/content/siteData` and
`@site/utils/schema/siteMap`. Standalone sites map `@site` to local src in Vite and
TypeScript; multisites map it to workspace src. `@` remains the shared code alias.
Install both aliases before migrating helpers.

All JSON-LD goes through JsonLd.astro and `serializeJsonLd`, which escapes script
closing delimiters and Unicode separators without changing parsed JSON values.
Do not restore independent JSON.stringify/set:html emitters.

## Validation

```sh
node --experimental-strip-types --test tests/*.test.mjs
node tests/schema-build.mjs
npm run build
```

The build fixture checks actual Astro output for repeated FAQ sections, rendered
MDX, non-FAQ accordions, founder nodes, reviews and hydration markup. The reliability
fixture additionally covers canonical overrides, prepared root/nested/no-page
links, shared checkout links, custom collection names, references and rejected
overrides, shared author resolution, displayed review quotes and parent-page
inheritance (including an actual disabled child route). The runner removes its temporary routes/content afterward; run the
final production build to remove fixture output. Run `astro check` as well and
compare unrelated baseline diagnostics.
See SCHEMA_INTEGRATION_PLAN.md and docs/SCHEMA_DRIFT_AUDIT.md for migration gates
and per-site exceptions. Koi Crest and archived projects are excluded.

## Shared breadcrumb navigation

`src/utils/breadcrumbs.ts` owns navigation data for UI and schema. The schema
serializer only converts the resolved trail. See [the breadcrumb guide](../../../docs/BREADCRUMBS.md)
for optional UI, custom trails, parent-page rules and validation. Do not rebuild
paths or ancestry in a renderer or in schema code.
