# One breadcrumb system

Breadcrumbs are navigation data, not a schema-only feature. `src/utils/breadcrumbs.ts`
resolves trails for UI, JSON-LD and other server-side consumers. It uses
`getBreadcrumbs()` from the existing query system, collection metadata, page rules
and `prepareEntry()` page/canonical URLs. It never uses a card's checkout/contact
link as a parent-page destination.

## Default behavior

`BaseLayout` initializes a page-local fallback. A published collection index is
included when its `hasPage` permits it. Entries follow the **primary parent**
(the first parent, matching page generation); ancestors without pages are skipped.
Draft/missing ancestors stop that chain. Cycles fail the build. Multiple parent
branches are not flattened into an invented linear trail.

Titles come from collection/entry content. `labelStyle: "slug"` supports existing
short-label designs such as Farias. Prepared `pageUrl` supplies navigation;
`canonicalUrl` supplies its schema identity. The current crumb always receives the
page's final SEO canonical URL. Root-path overrides are respected.

An unknown hand-written route defaults to Home → page title. It does not invent
parent URLs from path segments. Pass an explicit trail for a richer navigation path.
The homepage has no automatic breadcrumb. Trails shorter than two items emit no
BreadcrumbList. Breadcrumbs do not create routes or enable disabled pages.

## Optional UI

```astro
---
import Breadcrumbs from '@/components/Breadcrumbs.astro';
---
<Breadcrumbs />
```

The stock component provides an ordered list in a labeled navigation landmark,
keyboard-accessible ancestor links, a text-only current item with `aria-current`,
and decorative separators hidden from assistive technology. Its classes, separator
and accessible navigation label are configurable. No client JavaScript is needed.
Do not mount it on sites that intentionally have no breadcrumb UI merely to get
schema. Farias and Webmaxxers retain their own visual components.

A custom UI calls `await useBreadcrumbs(Astro, options?)` and renders the returned
items. That call also registers the **same** trail for schema. Use `item.label` and
`item.url`; render the final item as text. Keep any visible label customization in
the resolver options/input, not in a second transformation inside markup.

`SchemaBoundary` waits for the body to finish, then emits BreadcrumbList from the
registered trails. Repeated identical UI is deduplicated. Intentionally different
visible trails produce separate lists. When no UI registers a trail, the automatic
fallback is used. This avoids head/body render-order races and duplicate automatic
plus custom schema. The schema builder only serializes; it does not discover routes.

## Custom trails and other consumers

```astro
<Breadcrumbs items={[
  { label: 'Home', url: '/' },
  { label: 'Services', url: '/services' },
  { label: 'Demolitions' },
]} />
```

For a page without breadcrumb UI, pass that same array as `breadcrumbs` to
`BaseLayout`. `breadcrumbs={false}` disables the fallback; a UI explicitly mounted
on the page still registers its actual trail. `items={[]}` renders no trail.
Intermediate groups without URLs are omitted from the normalized trail for both
consumers. Invalid protocols and section-anchor destinations fail instead of
claiming to be breadcrumb pages. Explicit custom destinations must be real pages;
the output test checks local destinations.

`resolveBreadcrumbs(pathname, canonicalUrl, options)` returns data without emitting
UI or registering schema. Options include `entry`, `collection`, `items`,
`includeHome`, `includeCollection`, `homeLabel`, `title`, and `labelStyle`.
This is also the API for another navigation consumer. Do not add a separate
hierarchy or URL algorithm for it. `href` is accepted as an input alias for existing
custom components; the resolved model consistently uses `url`.

## Migration and verification

Inherit `utils/breadcrumbs.ts`, `query/hierarchy.ts`'s primary-parent breadcrumb
function, the small schema serializer, BaseLayout initialization, and SchemaBoundary
emission together. Remove the old SEO URL-splitting generator. Connect each existing
breadcrumb renderer to `useBreadcrumbs`; replace local hierarchy/path builders.
Preserve styling and do not add visible navigation to sites that never had it.

Run `node tests/breadcrumb-build.mjs` in Greastro for hierarchy, custom/repeated UI,
canonical overrides, unsafe URLs, draft/disabled parent and lifecycle fixtures.
Then run a clean build (fixtures are removed from source automatically) and
`python3 tests/breadcrumb-output.py . ../FariasDemolition ../KoiRoofingandSolar ../webmaxxers`.
The output test compares every displayed trail with JSON-LD, checks positions and
current canonicals, and verifies same-site destinations exist. Validation of JSON-LD
syntax alone cannot establish UI/data parity. Check branded UI and navigation in a
browser too; keep the ordinary schema/build/type checks.
