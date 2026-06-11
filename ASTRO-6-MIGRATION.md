# Astro 5 → 6 Migration

**Date:** 2026-05-31  
**Branch:** main  
**Template:** greastro

---

## Overview

This document details every change made to the greastro starter template to support Astro 6. The migration touched 19 files across config, utils, components, layouts, and integrations. Post-upgrade runtime fixes are documented in sections 9–11.

---

## 1. Config File Location

**Why:** Astro 6 looks for `content.config.ts` in `src/`, not `src/content/`. The old location triggers a legacy warning and auto-generation fallback.

**Changes:**
- Deleted `src/content/config.ts`
- Created `src/content.config.ts` with all collection definitions
- Updated three files that imported from the old path:
  - `src/utils/collections/core.ts` — `@/content/config` → `@/content.config`
  - `src/utils/pages/pageGeneration.ts` — same
  - `src/utils/query/graph.ts` — same (dynamic `await import("@/content/config")` — caught by post-migration QA build test)

---

## 2. Explicit Loaders on All Collections

**Why:** Astro 6 requires every `defineCollection` to have an explicit `loader:` property. The old system auto-detected file-based and data collections by directory convention — that is gone.

**Collections that needed loaders added:**
- `legal`, `about-us`, `blog`, `services`, `testimonials`, `projects`, `faq`

**`_meta.mdx` exclusion:** Astro 6's `glob()` loader does NOT auto-exclude `_` prefixed files the way the legacy system did. Added a negation pattern to every `glob()` call:

```ts
pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"]
```

---

## 3. Loader Utilities (`src/utils/loaders/loaderUtils.ts`)

**Why:** Avoid repeating the glob pattern and base path on every collection definition. New file created alongside `MenuItemsLoader.ts`.

```ts
// GlobLoad — for MDX-based collections, excludes _meta.mdx
export const GlobLoad = (collection: string) =>
  astroGlob({ pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"], base: `./src/content/${collection}` });

// FileLoad — for JSON-based collections
export const FileLoad = (collection: string, filename: string) =>
  astroFile(`src/content/${collection}/${filename}`);
```

`content.config.ts` now uses these instead of inline loader calls:

```ts
// Before
loader: glob({ pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"], base: "./src/content/blog" })

// After
loader: GlobLoad("blog")
```

---

## 4. `z` Imports Moved to `astro/zod`

**Why:** `import { z } from "astro:content"` is deprecated in Astro 6 with a `@deprecated` JSDoc, and will be removed in Astro 7. `z` now lives at `astro/zod`.

**Files updated:**
- `src/content/schema.ts` — `z` split to `astro/zod`, `reference`/`CollectionKey` stay in `astro:content`
- `src/utils/query/schema.ts` — same split
- `src/utils/collections/meta.ts` — `z` → `astro/zod`
- `src/content.config.ts` — written with `astro/zod` from the start

```ts
// Before
import { z, reference, type CollectionKey } from "astro:content";

// After
import { z } from "astro/zod";
import { reference, type CollectionKey } from "astro:content";
```

---

## 5. `entry.render()` Removed

**Why:** The `.render()` method on `CollectionEntry` objects is removed in Astro 6. The standalone `render()` function imported from `astro:content` is the replacement.

**Before touching any files, run this grep:**
```sh
grep -rn "\.render()\|entry\.render\|typeof.*render.*function" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Any `entry.render()` call or `typeof entry.render === "function"` guard must be removed and replaced with the standalone `renderEntry(entry)`.

**`src/utils/pages/pageGeneration/itemPageHelpers.ts`**

Removed the `if (typeof entry.render === "function")` branch entirely. Always uses the standalone `renderEntry()`:

```ts
// Before
if (entryWithRender && typeof entryWithRender.render === "function") {
  const rendered = await entryWithRender.render();
  Content = rendered?.Content ?? null;
} else {
  const rendered = await renderEntry(entry as any);
  Content = rendered?.Content ?? null;
}

// After
const rendered = await renderEntry(entry as any);
Content = rendered?.Content ?? null;
```

**`src/utils/collections/prepare.ts`**

Was storing `entry.render` as a lazy function reference on `PreparedItem` so `ContentBridge.astro` could call it later. Since `entry.render` no longer exists, replaced with a closure over the standalone `render()`:

```ts
// Before
const renderFn = (entry as any).render;

// After
import { render as renderEntry } from "astro:content";

const hasBody = "body" in entry;
const renderFn = hasBody ? () => renderEntry(entry as any) : undefined;
```

`ContentBridge.astro` required no changes — it calls `item.render()` which is now the closure above.

---

## 6. `entry.slug` Removed from Layouts

**Why:** `CollectionEntry.slug` is removed in Astro 6. `CollectionEntry.id` is the identifier.

**Before touching any files, run this grep:**
```sh
grep -rn "entry\.slug\|entry?\.slug" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Every result on a `CollectionEntry` object must be replaced with `entry.id`. Ignore results on plain data objects (e.g. `MenuNode.slug`, `ScannedItem.slug`) — those are not `CollectionEntry` fields.

**Files updated:**
- `src/layouts/collections/CollectionLayout.astro`
- `src/layouts/collections/LegalLayout.astro`

```ts
// Before
eyebrow={humanizeSlug(entry?.slug ?? entry?.id ?? "")}

// After
eyebrow={humanizeSlug(entry?.id ?? "")}
```

---

## 7. `getItemKey` Deleted

**Why:** `getItemKey` was a compatibility shim that tried `item.slug` first, then fell back to `item.id`. In Astro 6, `CollectionEntry.slug` no longer exists, so the slug branch is permanently dead on entry objects. The function is no longer needed — `entry.id` is the Astro standard.

**Deleted from:** `src/utils/collections/core.ts`

**Before touching any files, run this grep to find every call site in the project:**
```sh
grep -rn "getItemKey" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Every result must be resolved — either replace with `entry.id` (for `CollectionEntry` objects) or with `(item as any).id || (item as any).slug || ""` (for plain data objects like `MenuNode`). Do not proceed until the grep returns zero results.

**Replaced with `entry.id` at all `CollectionEntry` call sites:**
- `src/utils/collections/prepare.ts`
- `src/utils/query/snippets.ts` — all `getItemKey(entry)`, `getItemKey(a)`, `getItemKey(b)` calls
- `src/utils/query/helpers.ts` — `getQueryKey()` now returns `normalizeId(entry.id)`
- `src/utils/pages/pageGeneration/itemPageHelpers.ts`

**Plain data object call sites (MenuNode / generic items) — import removed, replaced with inline fallback:**
- `src/utils/menuQueries.ts` — `node.id || node.slug || ""`  (MenuNode has both as its own fields)
- `src/utils/tree.ts` — `(item as any).id || (item as any).slug || ""` (generic tree utility)

> **Note:** When applying to client projects, `getItemKey` may also be imported in `menuQueries.ts`, `tree.ts`, `query/helpers.ts`, and `query/snippets.ts`. Remove the import and apply the same inline fallbacks in all of them.

---

## 8. `PreparedItem.slug` Renamed to `PreparedItem.id`

**Why:** `PreparedItem` is greastro's prepared form of a collection entry. Its `slug` field was set from `entry.id` (via `getItemKey`) and used throughout the content system. Renaming it to `id` aligns `PreparedItem` with Astro's standard and eliminates the confusing `slug` terminology from the content pipeline entirely.

**`src/utils/collections/prepare.ts`**
```ts
// Before
export interface PreparedFields {
  slug: string;
  ...
}
// return { ...data, slug: identifier, ... }

// After
export interface PreparedFields {
  id: string;
  ...
}
// return { ...data, id: identifier, ... }
```

**All consumers updated:**

| File | Change |
|---|---|
| `src/layouts/collections/BlogIndexLayout.astro` | `item.slug` → `item.id` (card slug + fallback URL) |
| `src/components/ContentRenderer/variants/AccordionVariant.astro` | prop `slug: item.slug` → `id: item.id` |
| `src/components/LoopTemplates/Accordion.tsx` | `AccordionItemData.slug` → `id`, all usages updated |
| `src/integrations/preferences/consent/ui/CookiePreferencesModal.tsx` | `accordionItems` array `slug:` → `id:`, `key={item.slug}` → `key={item.id}` |
| `src/components/LoopComponents/Menu/MobileMenuItem.tsx` | `key={child.slug \|\| child.id}` → `key={child.id}` |
| `src/components/Menu/HamburgerMenuDrawer.tsx` | `key={item.slug \|\| item.id}` → `key={item.id}` |
| `src/utils/query/snippets.ts` | `p?.id \|\| p?.slug` fallbacks → `p?.id` |
| `src/hooks/useFilter.ts` | `value.id \|\| value.slug` → `value.id` |

---

## Files Changed

| File | Type of Change |
|---|---|
| `src/content/config.ts` | Deleted |
| `src/content.config.ts` | Created |
| `src/utils/loaders/loaderUtils.ts` | Created |
| `src/content/schema.ts` | `z` import source |
| `src/utils/query/schema.ts` | `z` import source |
| `src/utils/collections/meta.ts` | `z` import source |
| `src/utils/collections/core.ts` | Deleted `getItemKey` |
| `src/utils/collections/prepare.ts` | `render()`, `slug` → `id`, removed `getItemKey` |
| `src/utils/pages/pageGeneration.ts` | Config import path |
| `src/utils/query/graph.ts` | Config import path (dynamic import) |
| `src/utils/pages/pageGeneration/itemPageHelpers.ts` | `render()`, removed `getItemKey` |
| `src/utils/query/helpers.ts` | Removed `getItemKey` |
| `src/utils/query/snippets.ts` | Removed `getItemKey`, dropped `\|\| .slug` fallbacks |
| `src/utils/menuQueries.ts` | Replaced `getItemKey` with inline |
| `src/utils/tree.ts` | Replaced `getItemKey` with inline |
| `src/utils/redirects/collector.ts` | No change (`item.slug` is filesystem scanner field, not `CollectionEntry`) |
| `src/utils/redirects/pathAliasCollector.ts` | No change (same reason) |
| `src/layouts/collections/CollectionLayout.astro` | `entry.slug` → `entry.id` |
| `src/layouts/collections/LegalLayout.astro` | `entry.slug` → `entry.id` |
| `src/layouts/collections/BlogIndexLayout.astro` | `item.slug` → `item.id` |
| `src/components/ContentRenderer/variants/AccordionVariant.astro` | `slug:` → `id:` prop |
| `src/components/LoopTemplates/Accordion.tsx` | Interface + usages `slug` → `id` |
| `src/components/LoopComponents/Menu/MobileMenuItem.tsx` | Dropped `\|\| .slug` key fallback |
| `src/components/Menu/HamburgerMenuDrawer.tsx` | Dropped `\|\| .slug` key fallback |
| `src/integrations/preferences/consent/ui/CookiePreferencesModal.tsx` | `slug` → `id` in accordion items |
| `src/hooks/useFilter.ts` | Dropped `\|\| .slug` fallback |
| `src/pages/[slug].astro` | Renamed to `[id].astro` |
| `src/pages/[collection]/[slug].astro` | Renamed to `[collection]/[id].astro` |
| `src/utils/links/linkBehavior.ts` | `slug` param → `id` in `buildUrl` + `applyLinkBehavior` |
| `src/layouts/FrontPageHero.astro` | Default background import `.svg` → `.jpg` |
| `src/layouts/SecondaryHero.astro` | Default background import `.svg` → `.jpg` |
| `src/content/blog/first-post.mdx` | `featuredImage` + `ogImage` `.svg` → `.jpg` |
| `src/components/BackgroundMedia.astro` | Removed SVG bypass, reverted to clean raster-only logic |
| `src/utils/images.ts` | Removed `isSvgSource` + `resolveSrcString` utilities |
| `astro.config.mjs` | Removed `include` filter from `react()` |

---

## What Did NOT Need Changing

- `getCollection()`, `getEntry()`, `getEntries()` — unchanged in Astro 6
- `reference()` — still exported from `astro:content`
- `CollectionKey` type — still exported from `astro:content`
- `getStaticPaths` + content collection routing — unchanged
- `ContentBridge.astro` — calls `item.render()` which is now the closure set by `prepare.ts`; no change needed
- `src/utils/redirects/collector.ts` and `pathAliasCollector.ts` — their `item.slug` reads the filesystem scanner's own `slug` field, not `CollectionEntry.slug`
- `src/utils/menuQueries.ts` `node.slug` references — `MenuNode` is a plain data object with its own `.slug` field
- `src/utils/loaders/MenuItemsLoader.ts` `candidate.slug` — same, plain parsed object

---

## 9. Route Params Renamed: `slug` → `id`

**Why:** With `CollectionEntry.slug` gone, the local variable derived from `entry.id` was still named `slug` in the path-generation helpers — a naming holdover. Renamed everything for consistency.

**Files updated:**
- `src/pages/[slug].astro` → `src/pages/[id].astro`
- `src/pages/[collection]/[slug].astro` → `src/pages/[collection]/[id].astro`
- `src/utils/pages/pageGeneration/itemPageHelpers.ts` — `RootLevelPathParams.slug`, `CollectionLevelPathParams.slug`, `buildParams` signature, local variable, `buildRootLevelParams`, `buildCollectionLevelParams` all → `id`
- `src/utils/links/linkBehavior.ts` — `buildUrl` and `applyLinkBehavior` parameter names → `id`

**Note:** The route param name (`[id]`) is a Vite/Astro filename convention — not an Astro API field. The rename is cosmetic but eliminates the confusing holdover.

---

## 10. React Renderer `include` Filter Removed

**Why:** `@astrojs/react` 5 (shipped with Astro 6) no longer needs an `include` glob to scope which files the renderer processes. The old filter in `astro.config.mjs` was too narrow — files outside its patterns (e.g. hooks in `src/integrations/`) loaded React outside the renderer context, causing duplicate React instances and "Invalid hook call" errors at runtime.

**`astro.config.mjs`**
```ts
// Before
react({
  include: ['**/react/*', '**/components/**/*.jsx', '**/components/**/*.tsx', '**/hooks/**/*.js', '**/hooks/**/*.ts'],
})

// After
react()
```

---

## 11. SVG Backgrounds Replaced with JPEG

**Why:** Astro 6 disables SVG processing through `getImage()` by default. `background.svg` was used as the default fallback in `FrontPageHero` and `SecondaryHero`, and as `featuredImage`/`ogImage` in the sample blog post — all of which route through `BackgroundMedia`'s `getImage()` pipeline and throw `UnsupportedImageFormat` errors at runtime.

**Fix:** Replace all `background.svg` references with `background.jpg` (already present in `src/assets/`). No SVGs should be passed as background images through `BackgroundMedia`.

**Files updated in greastro:**
- `src/layouts/FrontPageHero.astro` — default import `.svg` → `.jpg`
- `src/layouts/SecondaryHero.astro` — default import `.svg` → `.jpg`
- `src/content/blog/first-post.mdx` — `featuredImage` + `ogImage` `.svg` → `.jpg`

**Also applies to all client projects** — same fix applied to: `hymanson-law`, `preferred-plumbing`, `Koi-Crest-Marketing`, `certified-bag-chasers`.

**`BackgroundMedia.astro`** — reverted to clean raster-only logic. SVG bypass code removed. `isSvgSource`/`resolveSrcString` utilities removed from `src/utils/images.ts`.

**Rule going forward:** Do not pass SVG files as `src` to `BackgroundMedia`. Use raster images (JPG/PNG/WebP) for backgrounds.

---

## Applying This Migration to Client Projects

**The `greastro` repo is the canonical reference point for this migration.** It is fully migrated and confirmed working on Astro 6.4.2. When migrating a client project, diff its `src/` against greastro's `src/` — any divergence in the files listed above is a migration gap.

Each client project forked from greastro needs the same changes applied to its own `src/` directory. The content-specific changes (loader patterns, schema) are identical. The component changes only apply if the client project uses those components.

### Step-by-step checklist

Run each grep **before** making changes to find all affected files, then fix every result before moving on.

**1. Config file**
```sh
# Confirm old config exists, new one doesn't
ls src/content/config.ts       # should exist
ls src/content.config.ts       # should NOT exist yet
```
- Delete `src/content/config.ts`
- Create `src/content.config.ts` with all collections using `GlobLoad`/`FileLoad`
- Copy `src/utils/loaders/loaderUtils.ts` from greastro if not present

**2. Update all `@/content/config` import paths**
```sh
grep -rn "content/config" src --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.mjs"
```
Every result must be changed from `@/content/config` → `@/content.config`. This includes:
- `src/utils/collections/core.ts`
- `src/utils/pages/pageGeneration.ts`
- `src/utils/query/graph.ts` ← **dynamic import, easy to miss**

**3. `z` imports**
```sh
grep -rn "from \"astro:content\"" src --include="*.ts" --include="*.tsx"
```
Any file importing `z` from `astro:content` must be split: `z` → `astro/zod`, rest stay in `astro:content`.

**4. `entry.render()`**
```sh
grep -rn "\.render()\|entry\.render\|typeof.*render.*function" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Replace all with standalone `render()` from `astro:content`.

**5. `entry.slug` on CollectionEntry objects**
```sh
grep -rn "entry\.slug\|entry?\\.slug" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Replace with `entry.id`. Do not touch `node.slug`, `item.slug` on plain data objects.

**6. `getItemKey`**
```sh
grep -rn "getItemKey" src --include="*.ts" --include="*.tsx" --include="*.astro"
```
Must return zero results before proceeding. Replace with `entry.id` (CollectionEntry) or `(item as any).id || (item as any).slug || ""` (plain objects).

**7. `PreparedItem.slug` → `id`**
```sh
grep -rn "\.slug" src/utils/collections/prepare.ts src/utils/query/snippets.ts src/hooks/useFilter.ts
```
Replace `slug` with `id` on `PreparedFields` interface and all consumers.

**8. Route param files**
```sh
ls src/pages/
ls src/pages/*/
```
Rename `[slug].astro` → `[id].astro` and `[collection]/[slug].astro` → `[collection]/[id].astro`.

**9. React renderer**

In `astro.config.mjs`, remove the `include` array from `react()`:
```ts
// Before
react({ include: [...] })
// After
react()
```

**10. SVG backgrounds**
```sh
grep -rn "background\.svg\|\.svg" src/layouts src/content/blog --include="*.astro" --include="*.mdx"
```
Replace any `.svg` passed as a background/featured image with a raster equivalent (`.jpg`/`.webp`).

**11. Verify**
```sh
npm run build
```
A clean build with no errors is the only acceptance criterion. Warnings about dynamic imports of `astro:content` are expected and benign.
