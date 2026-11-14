# robots-llms Integration

Generates `robots.txt`, `llms.txt`, and `llms-full.txt` automatically during Astro's static build. No manual maintenance required — everything flows from the content collections and page layouts already in place.

---

## How It Works

The system has two phases:

**Phase 1 — Build time (per page)**
Every page that renders through `SEO.astro` writes a small JSON manifest entry to `dist/__seo/` during the build. Each entry records the page path, title, description, robots directive, and whether it should appear in llms.txt.

**Phase 2 — Post build (`astro:build:done` hook)**
The integration reads all manifest entries, reads the content directory directly for non-paged collections, and writes the three output files. The `dist/__seo/` manifest directory is deleted from the final dist — it never ships.

---

## Output Files

### `robots.txt`
Standard crawl policy. Example output:
```
User-agent: *
Allow: /
Disallow: /*?*
Disallow: /404
Sitemap: https://yoursite.com/sitemap-index.xml
```

### `llms.txt`
Curated index of site pages for AI crawlers. Only pages that have a URL (`hasPage: true` or `itemsHasPage: true`) and are not opted out appear here. Grouped into sections by URL prefix.

### `llms-full.txt`
Complete site knowledge dump for AI ingestion. Two parts:
- **Pages** — every paged URL with full extracted prose body
- **Supporting Content** — non-paged collections (FAQ, features, philosophy, process, technologies, testimonials, etc.) as pure knowledge context with no URL

---

## File Structure

```
src/
  integrations/
    robots-llms/
      robots-llms.integration.ts   ← the entire system
  layouts/
    SEO.astro                       ← writes per-page manifest entries
  utils/
    seo.ts                          ← buildItemSEOProps / buildCollectionSEOProps
  content/
    schema.ts                       ← llmsItemSchema / llmsMetaSchema
```

---

## Configuration

### Global config — `astro.config.mjs`

```ts
import robotsLlmsIntegration from './src/integrations/robots-llms/robots-llms.integration.ts';

integrations: [
  robotsLlmsIntegration({
    // Block specific AI training bots entirely (own User-agent group, Disallow: /)
    blockBots: ['GPTBot', 'CCBot', 'Google-Extended'],

    // Additional paths to disallow for all crawlers
    disallow: ['/admin', '/staging'],

    // Disallow URLs with query strings (default: true)
    blockQueryUrls: true,
  }),
]
```

All options are optional. Calling `robotsLlmsIntegration()` with no arguments produces a sensible default `robots.txt`.

### `RobotsLlmsConfig` interface

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `blockBots` | `string[]` | `[]` | Named bots to block entirely. Common values: `GPTBot`, `CCBot`, `Claude-Web`, `Anthropic-AI`, `Google-Extended`, `FacebookBot`, `Bytespider`, `PetalBot` |
| `disallow` | `string[]` | `[]` | Additional paths to disallow in the wildcard group. Leading `/` is added automatically if missing. |
| `blockQueryUrls` | `boolean` | `true` | Adds `Disallow: /*?*` to prevent crawling query string variants |

`/404` is always disallowed regardless of config via `DEFAULT_DISALLOWED_PATHS`.

---

## Per-Page Control

### Static pages (`src/pages/*.astro`)

Pass props directly to `BaseLayout` or `SiteLayout`:

```astro
<!-- Exclude from llms.txt (page exists but not useful for AI) -->
<BaseLayout title="Links" addToLLMs={false}>

<!-- Noindex for search engines (also excluded from llms.txt automatically) -->
<SiteLayout title="404" robots="noindex, nofollow" addToLLMs={false}>
```

### Collection index pages — `_meta.mdx`

```yaml
---
title: "Blog"
hasPage: true
itemsHasPage: true
llms:
  addToLLMs: false        # exclude the /blog index page from llms.txt
  itemsAddToLLMs: false   # exclude all blog post pages from llms.txt
---
```

### Collection item frontmatter

```yaml
---
title: "Privacy Policy"
llms:
  addToLLMs: false   # exclude this specific item from llms.txt
---
```

Item-level `llms.addToLLMs` overrides the collection-level `llms.itemsAddToLLMs`.

### robots directive

Any page can set its robots meta tag:

```astro
<!-- In a static page -->
<SiteLayout robots="noindex, nofollow">

<!-- In a collection _meta.mdx -->
seo:
  robots: "noindex, nofollow"
```

A `noindex` page is also automatically excluded from both `llms.txt` and `llms-full.txt` — these are separate concerns handled independently, but noindex implies the page should not be AI-indexed either.

---

## Control Hierarchy

### robots.txt
```
Global config (astro.config.mjs)
  └── collection _meta.mdx seo.robots
        └── item frontmatter seo.robots / layout robots= prop
```

### llms.txt / llms-full.txt
```
Collection _meta.mdx llms.addToLLMs (index page)
Collection _meta.mdx llms.itemsAddToLLMs (all items in collection)
  └── item frontmatter llms.addToLLMs (overrides collection setting)
      └── layout addToLLMs={false} prop (static pages)
```

---

## What Gets Included by Default

### Always included in `llms.txt`
Any page that has a URL and is not explicitly opted out:
- All collection index pages where `hasPage: true`
- All collection item pages where `itemsHasPage: true`
- All static `.astro` pages that render through `BaseLayout`/`SiteLayout`

For entries where no meaningful description exists (missing or equals the site-wide fallback description), the integration automatically extracts the first sentence from the MDX body and uses that instead. No configuration needed — this applies to any collection like FAQ where items store their content in the body rather than a `description` field.

### Always excluded from `llms.txt`
- Pages with `addToLLMs={false}`
- Pages with `robots` containing `noindex`
- Collections/items with `llms.addToLLMs: false` or `llms.itemsAddToLLMs: false`

### `llms-full.txt` Supporting Content
Non-paged collections are included as supporting knowledge context (no URL, pure data). By default this includes: `about-us` items, `benefits`, `faq`, `features`, `philosophy`, `process`, `technologies`, `testimonials` items.

To exclude a non-paged collection from llms-full.txt Supporting Content, set in its `_meta.mdx`:
```yaml
llms:
  itemsAddToLLMs: false
```

---

## MDX Body Extraction

`llms-full.txt` extracts readable prose from MDX files using three modes:

| Mode | Trigger | Extracts |
|------|---------|---------|
| **1 — HTML prose** | No imports + has `<section>` tags | Full HTML → markdown conversion (headings, paragraphs, lists) |
| **2 — JSX components** | Has imports or mixed HTML | `<p>` tags, `description=` props, `heading=` props, `TrustStatement text=`, `description:` object fields |
| **3 — Plain markdown** | No imports, no HTML | Raw markdown after stripping export statements |

---

## Schema Requirements

The following must be present in `src/content/schema.ts`:

```ts
export const llmsItemSchema = z.object({
  addToLLMs: z.boolean().optional(),
}).optional();

export const llmsMetaSchema = z.object({
  addToLLMs: z.boolean().optional(),
  itemsAddToLLMs: z.boolean().optional(),
  useBodyAsDescription: z.boolean().optional(),
}).optional();
```

Both schemas must be wired into `baseSchema` (for items) and `metaSchema` (for collection meta):

```ts
// In baseSchema:
llms: llmsItemSchema,

// In metaSchema:
llms: llmsMetaSchema,
```

---

## `seo.ts` Requirements

`buildItemSEOProps` must resolve `addToLLMs` from the collection and item:

```ts
const collectionItemsAddToLLMs = collectionMeta?.llms?.itemsAddToLLMs;
const itemAddToLLMs = itemData.llms?.addToLLMs;
const addToLLMs = itemAddToLLMs !== undefined ? itemAddToLLMs : collectionItemsAddToLLMs;

return {
  // ...other props
  addToLLMs,
};
```

`buildCollectionSEOProps` must pass the collection-level setting:

```ts
return {
  // ...other props
  addToLLMs: collectionMeta.llms?.addToLLMs,
};
```

---

## `SEO.astro` Requirements

`SEO.astro` must accept `addToLLMs?: boolean` in its Props and write the manifest entry during build:

```ts
export interface Props {
  // ...existing props
  robots?: string;
  addToLLMs?: boolean;
}

// In the frontmatter script block:
if (import.meta.env.MODE !== 'development') {
  try {
    const outDir = join(process.cwd(), 'dist', '__seo');
    mkdirSync(outDir, { recursive: true });
    const slug = canonicalPath === '/' ? '_index' : canonicalPath.replace(/^\//, '').replace(/\//g, '__');
    const entry = {
      path: canonicalPath,
      title: finalMetaTitle,
      description: finalMetaDescription,
      robots: effectiveRobots,
      addToLLMs: addToLLMs !== false,
    };
    writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(entry), 'utf8');
  } catch (_) {}
}
```

The manifest write is wrapped in try/catch and only runs outside of development — it is non-fatal and never blocks page rendering.

---

## Logo and OG Image in `SEO.astro`

Because `siteData.ts` cannot import assets (see `siteData.ts` Requirements below), logo and OG image references live directly in `SEO.astro` instead. Each site owns its own imports.

Two separate imports are used:

```ts
import siteLogo from "@/assets/logo.png";       // Used in JSON-LD "logo" field
import defaultOGImage from "@/assets/og.jpg";   // Used as OG/Twitter image fallback
```

`siteLogo` should point to the actual site logo. `defaultOGImage` should ideally be a 1200×630 social card image — until one is made, pointing both at the logo is acceptable as an interim.

**Per-site examples:**
```ts
// griffinswebservices
import siteLogo from "@/assets/transparent-word-logo.png";
import defaultOGImage from "@/assets/transparent-word-logo.png";

// FariasDemolition
import siteLogo from "@/assets/farias.png";
import defaultOGImage from "@/assets/farias.png";

// greastro (template placeholder — replace with real assets per site)
import siteLogo from "@/assets/astro.svg";
import defaultOGImage from "@/assets/astro.svg";
```

`siteLogo.src` is used in the JSON-LD `"logo"` object. `defaultOGImage.src` is passed to `getImageUrl()` as the fallback for `baseImageUrl`. Both are processed by Vite at normal build time so `@/` aliases work fine here.

When a proper OG card image is available, only swap `defaultOGImage` — `siteLogo` stays pointing to the actual logo independently.

---

## `siteData.ts` Requirements

The integration imports `siteData` as a **top-level static import** at config evaluation time — before Vite aliases or environment variables are available. This means `src/content/siteData.ts` must follow these rules:

**Do NOT use:**
- `import.meta.env.*` — env vars are not resolved at this stage
- `import Logo from "@/assets/logo.png"` or any asset import via `@/` alias
- Dynamic imports or conditional imports

**Do use:**
- Plain string constants for domain and URL
- Export `SITE_URL` as a named constant (also imported by `astro.config.mjs` for `site:`)

**Correct pattern:**
```ts
const SITE_DOMAIN = "yoursite.com";
export const SITE_URL = `https://${SITE_DOMAIN}`;

export const siteData = {
  title: "Your Site",
  tagline: "Your tagline",   // optional but recommended for llms.txt header
  description: "...",
  domain: SITE_DOMAIN,
  url: SITE_URL,
};
```

**And in `astro.config.mjs`:**
```ts
import { SITE_URL } from "./src/content/siteData.ts";

export default defineConfig({
  site: SITE_URL,
  // ...
});
```

If `siteData` has no `tagline` field the integration handles it gracefully (the tagline line is simply omitted from `llms.txt`/`llms-full.txt`). Adding a tagline is recommended for good AI crawler headers.

---

## Migration Instructions for Other Greastro Sites

### Step 1 — Copy the integration file

Copy `src/integrations/robots-llms/robots-llms.integration.ts` verbatim into the target site at the same path.

### Step 2 — Delete old robots/llms pages

If the site has static page routes for these files, delete them:
```
src/pages/robots.txt.ts   ← delete
src/pages/llms.txt.ts     ← delete
src/pages/llms-full.txt.ts ← delete (if exists)
```

### Step 3 — Register the integration in `astro.config.mjs`

```ts
import { SITE_URL } from './src/content/siteData.ts';
import robotsLlmsIntegration from './src/integrations/robots-llms/robots-llms.integration.ts';

export default defineConfig({
  site: SITE_URL,   // use SITE_URL, not import.meta.env
  integrations: [
    robotsLlmsIntegration(),
    // or with config:
    robotsLlmsIntegration({
      blockBots: ['GPTBot', 'CCBot'],
      disallow: ['/admin'],
    }),
  ],
});
```

If the site previously used `import { loadEnv } from "vite"` to set `site:`, replace it with the `SITE_URL` import from `siteData.ts`.

### Step 4 — Add llms schemas to `src/content/schema.ts`

Add the two schemas and wire them in (see Schema Requirements section above).

### Step 5 — Update `src/utils/seo.ts`

Add `addToLLMs` resolution to `buildItemSEOProps` and `buildCollectionSEOProps` (see seo.ts Requirements section above). Also add `addToLLMs?: boolean` to the `SEOProps` interface.

### Step 6 — Update `src/layouts/SEO.astro`

Add `robots?: string` and `addToLLMs?: boolean` to Props and add the manifest-writing block (see SEO.astro Requirements section above).

Also replace any `import defaultOGImage from "@/assets/astro.svg"` placeholder with two named imports for this site's actual assets (see Logo and OG Image section above):

```ts
import siteLogo from "@/assets/your-logo.png";
import defaultOGImage from "@/assets/your-og.jpg";
```

Then update the two usage sites:
- `getImageUrl(image, defaultOGImage.src)` — OG fallback
- `"url": makeAbsolute(siteLogo.src)` — JSON-LD logo field

### Step 7 — Exclude structural collections

Review your collections. Any collection that is purely structural/navigational and not useful for AI should opt out in its `_meta.mdx`:

```yaml
llms:
  addToLLMs: false
  itemsAddToLLMs: false
```

Common candidates across all Greastro sites: `menu-items`, `menus`, `social-media`, `authors`, `stats`. This is the only place exclusions are configured — there is no hardcoded list in the integration.

### Step 8 — Opt out specific pages

Review static pages and add `addToLLMs={false}` to any page that has a URL but should not appear in llms.txt:
- Links / utility pages
- Thank-you pages
- Redirect placeholder pages

Also add `robots="noindex, nofollow" addToLLMs={false}` to your 404 page.

### Step 9 — Run a build and verify

```bash
npm run build
cat dist/robots.txt
cat dist/llms.txt
wc -l dist/llms-full.txt
```

Check that:
- `robots.txt` has the correct `User-agent` groups and `Sitemap:` line
- `llms.txt` lists only real, meaningful pages — no legal, no 404, no utility pages
- `llms-full.txt` has a `## Pages` section and a `## Supporting Content` section
- `dist/__seo/` does not exist (cleaned up after build)

---

## Troubleshooting

**`Cannot find module '@/assets/...'` or `import.meta.env` errors during build**
The integration imports `siteData` at config evaluation time before Vite is initialized. Remove any asset imports (`@/assets/*`) and `import.meta.env` usage from `src/content/siteData.ts`. Hardcode domain/URL as plain string constants instead. See the `siteData.ts` Requirements section above.

**`Vite module runner has been closed` error**
Same root cause as above — do not attempt dynamic imports inside the integration hook. The integration only works with top-level static imports from `siteData.ts`.

**`robots-llms: no manifest entries found`**
The manifest is empty. This means SEO.astro did not write any entries. Check that:
- You are running a production build (`npm run build`), not dev
- `SEO.astro` has the manifest-writing block
- The build actually rendered pages (check the build output for page count)

**Legal / auth pages appearing in llms.txt**
Set `llms.itemsAddToLLMs: false` in the collection's `_meta.mdx` and verify `buildItemSEOProps` reads `collectionMeta?.llms?.itemsAddToLLMs`.

**Root-level pages missing body in llms-full.txt**
These are items with `itemsRootPath: true`. The integration uses `shouldItemUseRootPathData` to find them. Verify the function exists and returns `true` for those items.

**llms-full.txt has garbled text from JSX files**
Mode 2 extraction pulls `description=`, `heading=`, and `<p>` content from JSX component files. If you have custom prop names with long strings being picked up incorrectly, the deduplication and filter logic in `extractMdxBody` can be extended with additional exclusion patterns in the `unique` filter block.
