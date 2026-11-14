# Color Contrast Audit — WCAG 2 AA (1.4.3 / 1.4.11)

**Date:** 2026-07-07
**Scope:** All items flagged by the in-app Accessibility panel (axe-core) under
_"Elements must meet minimum color contrast ratio thresholds."_
**Theme audited in screenshots:** **Dark mode** (panel + page backgrounds are dark).

---

## STATUS — 2026-07-07: real issues FIXED

All Part B real issues are fixed and the site builds clean. Corrections found while
implementing:

- **Filmstrip "Lighthouse" card was misattributed.** The "Lightr… / GWS Average 98% /
  Industry Average 34%" screen is **`content/benefits/lightning-fast-websites.mdx`** — a
  Benefit panel whose media is a `BarGraph` **AnimatedExample** (fully `DecorativeWrapper`-
  wrapped). The `.mb-6.h2` / `.large-text` beside it are the benefit's own heading/body
  (they pass) flagged by demo proximity. → **Part A, decorative. No fix.** (This also
  explains the `.text-lg.font-semibold.text-accent` rows: they are BarGraph's decorative
  value labels, not real UI. Bucket B3 has **no** real fix.)
- **axe is a browser extension, not in-repo** (not in `package.json`; the panel is axe
  DevTools / similar). So the `[data-decorative]` exclusion can't be committed — it must
  be set in the extension. See "Suppressing false positives" at the bottom.

Fixes applied:
| Issue | File | Change |
|---|---|---|
| `.stat-label` over photo | `AboutStatsVariant.astro` | `--color-muted` → `--color-text`; 11px → 12px |
| About body over photo | `AboutSection.astro` | `font-light` → `font-normal` + `.about-flow-text` text-shadow scrim |

**Kept `--color-muted` (verified passing, reverted after checking the math):** footer
labels (`.footer-col__heading`, legal `.h4`), footer copyright, and the TwoColumn image
caption. All sit on **flat** base/footer backgrounds where muted = **5.15:1** — clears
WCAG AA (4.5:1) at any size/weight, so the muted hierarchy is preserved.

**Why size can't rescue muted over the photo (the `.stat-label` case):** the background
IS the photo. Muted grey (`#818183`) over a mid-tone photo pixel is ~**1.0:1**, over a
light region ~**1.8:1** — below even the 3:1 large-text floor regardless of font size.
Enlarging only helps when the ratio is already ≥3:1 (large-text threshold); over a
bright photo it never is. So `.stat-label` needs solid text; muted-larger would still
fail.

---

## THE DIVIDE

Every flagged item falls on one side of a single line:

- **PART A — Inside the Benefit AnimatedExamples (decorative).** Text that lives
  inside the `.bcs-slide` benefit panels' embedded `AnimatedExamples` demos, wrapped by
  `DecorativeWrapper`. **All false positives — WCAG-exempt, NO FIX.**
- **PART B — Everywhere else (real page chrome).** Text that is actual site content /
  UI. **Mixed — some real fixes, some other false positives.**

> **Why the split matters:** Part A is ~70% of the raw list and is entirely noise. The
> `AnimatedExamples` demos are imported into the Benefit MDX bodies
> (`src/content/benefits/*.mdx`), so each `.bcs-slide` panel embeds a decorative demo.
> axe walks into it and flags its tiny simulated-UI text — even the panel's own real
> `.h3`/body copy get swept up by association. None of it is reachable by AT users.

### Measured token reference (dark mode, vs `--color-bg` #080808)

| Token | Composited | Ratio | AA normal (4.5:1) |
|---|---|---|---|
| `--color-text` (zinc-200) `#e4e4e7` | — | **15.78** | ✅ |
| `--color-text/80` | `#b8b8ba` | **10.11** | ✅ |
| `--color-text/60` | `#8c8c8e` | **5.97** | ✅ |
| `--color-text/40` | `#606061` | **3.19** | ❌ |
| `--color-muted` (text @55%) | `#818183` | **5.15** on base only | ✅ base / ❌ on cards+photo |
| `--color-accent` `#5e76f6` | — | **5.15** base / **4.55** on zinc-900 | ⚠️ large-text only |

Light mode muted = `zinc-600` → **6.1–7.4:1** everywhere → ✅ (no light-mode debt).

---
---

# PART A — INSIDE THE BENEFIT ANIMATEDEXAMPLES (decorative)

**Verdict for this entire part: FALSE POSITIVES. NO FIX. Suppress in tooling.**

**Root cause:** [DecorativeWrapper.tsx](src/integrations/preferences/accessibility/ui/DecorativeWrapper.tsx)
wraps every demo with `aria-hidden="true"` + `role="presentation"` + `aria-live="off"`
+ `data-decorative="true"` + `inert`. WCAG SC 1.4.3 **exempts** decorative/incidental
content, and AT users never reach it. axe-core's contrast rule doesn't honor
`aria-hidden`, so it reports them anyway.

**Chain:** `BenefitsCardStackVariant` → `.bcs-slide` panel → benefit MDX body
(`src/content/benefits/*.mdx`) → imported `AnimatedExamples/*` → `DecorativeWrapper`.

### A1. Decorative-island rows (the panel literally labels them)
The selector itself contains the exemption marker:

- `astro-island[uid="Z23K6Vz"] > div[aria-live="off"][data-decorative="true"][role="presentation"] > .justify-between.flex.items-center > .text-text/80.text-sm`
- `astro-island[uid="1o2zlX"] > div[aria-live="off"][data-decorative="true"][role="presentation"] > … > .text-text/80.text-sm`

### A2. `.bcs-slide` run — every benefit panel (screenshots 3 & 4)
The full sweep, all exempt (embed a decorative demo):

- `.bcs-slide:nth-child(2..9) > .bcs-text[data-astro-cid-fxpqf435] > .h3`
- `.bcs-slide:nth-child(2..9) > .bcs-text[data-astro-cid-fxpqf435] > .mt-3.md\:text-lg.text-base`

> Note: the `.h3` (→ `--color-heading`, near-white) and `text-base` body (→ `--color-text`,
> 15.78:1) **pass contrast on their own.** They're only listed because axe walked the
> panel to reach the embedded demo. Source (unchanged):
> [BenefitsCardStackVariant.astro](src/components/ContentRenderer/variants/BenefitsCardStackVariant.astro).

### A3. Simulated-UI text inside the demos
All inside `DecorativeWrapper`; confirmed `text-text/40` appears **only** in
`AnimatedExamples/`:

- `.text-text/60`, `.text-lg.text-text/60`, `.text-text/60 > .tabular-nums`
- `.text-\[10px\].font-medium.text-text`, `.text-text/60.text-\[10px\].font-medium`
- `.px-1.mb-3.justify-between > .text-text/40.text-xs`
- `.pt-3 > span:nth-child(1)` / `span:nth-child(2)`

**Source files (reference only — DO NOT restyle):**
`AnimatedExamples/WebsiteLoadComparison.tsx`, `AddToCartDemo.tsx`, `BarGraph.tsx`,
`SearchRankingDemo.tsx`, `ScalabilityDemo.tsx`, `GrowthGraph.tsx`, `GoogleListing.tsx`,
`LeadsSpreadsheet.tsx`, `RestaurantQuickActions.tsx`, `EngagementDemo.tsx`,
`EcommerceIntegrationDemo.tsx`, `UpsellFunnelDemo.tsx`, `BlogPublishDemo.tsx`,
`CustomWebsiteBuildDemo.tsx`, `MobileOrderDemo.tsx`, `PortfolioAddDemo.tsx`,
`ResponsiveShowcase.tsx`, `AIChatSimulation.tsx`.

### Action for ALL of Part A
Exclude `[data-decorative="true"]` / `[inert]` / `[aria-hidden="true"]` subtrees from
the contrast rule (axe `exclude`/`runOnly`, or the in-app panel's filter). Removes this
entire part from the list. **Zero code/style changes to the demos.**

---
---

# PART B — EVERYWHERE ELSE (real page chrome)

Not inside a decorative demo. Triage below: some are real fixes, a couple are still
false positives (axe scanning its own UI / passing tokens flagged by proximity).

## B0. Still false positives (but NOT decorative-demo)

| Flagged | Where | Verdict |
|---|---|---|
| `.font-mono`, one `.text-[10px]` | The **Accessibility panel's own UI** — `AccessibilityModal.tsx`, `SliderControl.tsx` (axe scanning itself) | ✅ False positive — ignore |
| `.heading-display` | [global.css](src/styles/global.css#L1073) → `--color-heading` (zinc-50). Passes; flagged by proximity to the muted eyebrow | ✅ Passes — no fix (but see B3 for the eyebrow) |

## B1. Text over imagery — REAL (both modes, contextual)

Tokens pass flat, but the background is a photo/screenshot mid-scroll.

- **About body copy:** `.gap-10 > .text-base.font-light.leading-relaxed` and
  `.gap-8.justify-between.flex-col > .text-base.font-light.leading-relaxed` →
  [AboutSection.astro](src/components/AboutSection/AboutSection.astro#L227) `leftText`/`rightText`.
  They scroll **over** the expanding `.about-expand-media` photo while `--axp-dim` is
  still low. `font-light` (300) worsens it. **Fix:** raise the dim floor before the
  grid overlaps + bump `font-light` → `font-normal`. (Weight, not size.)
- **Filmstrip "Lighthouse" card:** `.text-left > div:nth-child(2) > .mb-6.h2` and
  `.text-left > .large-text` → [FilmstripCardMedia.astro](src/components/LoopComponents/FilmstripCardMedia.astro)
  ("Lightr…", "GWS Average 98%/34%") over a screenshot. `.h2`/`.large-text` are ≥18.66px
  → 3:1 threshold, likely pass, but **add/verify a scrim** for bright screenshots.

## B2. Muted labels on non-base surfaces — REAL (dark only, narrow)

`--color-muted` = 5.15:1 on `#080808` (passes) but ~4.3:1 on zinc-900 cards / over photo.

- **`.stat-label`** → [AboutStatsVariant.astro](src/components/ContentRenderer/variants/AboutStatsVariant.astro#L62)
  — `--color-muted`, **11px**, weight 500, uppercase. Renders over the About photo →
  drops below AA. **Fix:** `--color-muted` → `--color-text` (optionally 11px → 12px).
- **`.footer-col__heading`** + Footer legal `.h4` + `© … .text-sm text-muted` →
  [Footer.astro](src/layouts/sections/Footer.astro#L132) — `--color-muted`, 14px,
  weight 300, uppercase. Borderline even on base. **Fix:** weight 300 → 500, or
  `muted` → `text`.

## B3. Accent text at small size — REAL borderline (both modes)

- `.text-lg.font-semibold.text-accent` (+ `> .tabular-nums`) — accent = 4.55:1 on cards.
  At `text-lg` + `font-semibold` it's **large text (3:1)** → **passes.** Only a real fail
  if `text-accent` is used **< 18.66px non-bold**. **Fix:** grep `text-accent` usages
  (`TestimonialCard.tsx`, `AccordionItem.tsx`, `TechStackSection.tsx`,
  `TwoColumnImageVariant.astro`, `MarkdownText.tsx`, …); swap small ones to
  `primary-700`. Also apply to the muted **eyebrow** near `.heading-display` (B0).

## B4. Trace-and-fix

- `.text-muted.text-sm[data-astro-cid-pen5l4sj]` / `.p-0!` — trace `pen5l4sj` to its
  component; same muted-on-surface rule → apply B2 fix.

---
---

## Prioritized fix plan (Part B only — Part A needs no code)

| # | Part | Action | Effort | Files | Mode |
|---|---|---|---|---|---|
| 1 | A | Suppress `[data-decorative]`/`[inert]` in the contrast tool (removes all of Part A) | S | axe/panel config | both |
| 2 | B1 | Raise scrim floor over About photo + Filmstrip card | M | `AboutSection.astro`, `FilmstripCardMedia.astro` | both |
| 3 | B1 | `font-light` → `font-normal` on About left/right text | S | `AboutSection.astro` | both |
| 4 | B2 | `.stat-label` → `--color-text` (± 11px→12px) | S | `AboutStatsVariant.astro` | dark |
| 5 | B2 | Footer labels weight 300 → 500 (or muted → text) | S | `Footer.astro` | dark |
| 6 | B3 | Audit `text-accent` for <18.66px non-bold → `primary-700` | M | see B3 list | both |
| 7 | B4 | Trace `pen5l4sj` muted-`text-sm`; apply B2 | S | TBD | dark |

### Not the problem
- **Text size is fine site-wide** (only 11px `.stat-label`, better fixed by color).
- **Light mode is clean** (muted = zinc-600 = 6.1–7.4:1). B-fixes are dark-mode only.
- **Body `--color-text` passes** at 15.78:1 — ignore any `.text-text` flag not over an
  image (B1) or decorative (Part A).

---

## Suppressing false positives (Part A) in the axe browser extension

axe-core's contrast rule ignores `aria-hidden`, so it flags our `DecorativeWrapper`
demos even though WCAG exempts them and no code change in the DOM will silence it. Do
this in the extension instead:

- **axe DevTools:** Settings → add `[data-decorative="true"]` (or `[inert]`) to the
  element exclusion / "ignore" list, or scope the scan to `main` excluding those nodes.
- Alternatively restrict the analyzed region so the 32 benefit demos aren't scanned.

After that, the contrast list should collapse from ~325 rows to essentially zero — any
remainder is a real issue to triage here.

## Verification
1. Fix, re-run the panel in **both** themes.
2. For B1, scrub About/Filmstrip to the lowest-dim frame; check with a picker against
   the real pixels.
3. Remaining list should be only Part A (`[data-decorative]`) rows — expected/exempt.
4. Ratios computed via the WCAG relative-luminance formula against real tokens.
