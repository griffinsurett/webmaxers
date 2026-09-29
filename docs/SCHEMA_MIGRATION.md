# Webmaxxers schema migration — 2026-09-29

Status: implementation `0a88d7f9` is pushed to main and deployed. Local build,
baseline comparison, Schema.org validation and automated production checks pass.
**Final carousel interaction QA remains pending.** Do not call the site complete or
start the next migration until that gate is resolved.

## Source and scope

Started on `feat/schema-system` at `9cdb1721`; `main` pointed to the same commit.
Switched to main without discarding existing uncommitted work. The comparison
baseline includes that earlier partial schema port and type fixes, not just the
older deployed commit. Source, existing output and the fresh baseline build
were saved under `/tmp/webmaxxers-schema-baseline-20260929`; no environment files
or bypass credentials were copied.

Inherit Greastro's tested `70f377c` runtime, including the ContentBridge
description opt-in discovered during this port. Checksums for 29 inherited files are in
[schema-validation/webmaxxers-2026-09-29.json](schema-validation/webmaxxers-2026-09-29.json).
Only `layoutUtils.ts` differs in trailing whitespace; runtime behavior matches.

## Drift decisions

| Area | Integration decision |
| --- | --- |
| Identity | Keep `OnlineBusiness`, Webmaxxers and its legal entity Griffin's Web Services LLC. Founder discovery uses Griffin Surett's tagged JSON author. Use the shared author resolver for the article byline and schema; author pages remain disabled. No office, hours or phone are invented. |
| Shared engine | Inherit the resolver, collector, rendered-answer handling, validation, serialization, canonical context and preparation/page rules. Components live in `src/components/Schema/`; the empty site adapter moves to `src/utils/schema/siteMap.ts`. Remove superseded component paths and the now-unused legacy author/image helper. |
| Custom layouts | Preserve BaseLayout/SiteLayout, Logo.jpg identity art, custom MDX capabilities, article sharing/TOC, breadcrumbs, promotions, 3D/media and preferences. CapabilityCustomLayout declares its Service subject and passes the same SEO canonical settings as BaseLayout. |
| Testimonials | Display and register the same prepared query results in the existing carousel. Quotes use the displayed description field; order, images, controls and transitions remain. No ratings are emitted because this UI shows no stars. |
| FAQ | Preserve the custom React accordion. Its separate description paragraph previously bypassed answer capture, omitting 21 of 22 questions. Opt in to the shared bridge description rendering and remove the duplicate React output. The collector now captures every complete displayed answer, including the description before MDX. Automatic FAQ semantics apply only to the FAQ collection; other question collections can opt in. |
| URLs/content | No route, public content, metadata or canonical changes. Capability and author pages remain disabled by their existing collection settings. Existing contact aliases remain redirects. |
| Prior work | Preserve the earlier interaction-hook and preferences type corrections, layered author loader, robots/LLMs manifest fix and generated chatbot knowledge content. No integration, endpoint or hosting protection is added or removed. |

## Validation

- UTC production build passes: **17 HTML files**, including two Partytown helper
  documents; 42 video-thumbnail files retained.
- Output audit: **15 JSON-LD blocks**, one FAQ page/22 questions and four review
  instances. Zero errors. Three later carousel reviews need browser checks.
- **No new type errors.** Baseline: 54 errors, zero warnings, 102 hints. Current:
  53 errors, zero warnings, 102 hints. Shared author lookup resolves the prior
  BlogLayout error. The user deferred the remaining backlog until **all standalone
  and multisite schema work is complete**. Remind them then; do not fix it now.
- All 17 routes match the pre-port working-tree build. No differences in
  links, images/alt text, metadata, canonical URLs, iframes, analytics markup,
  form controls or SVG markup. FAQ descriptions now live in the bridge with their
  MDX body instead of a separate React paragraph. This changes static text order,
  while preserving every question/answer and its paragraph style. Other pages
  have no text differences. Thirteen pages' JSON-LD changed as the
  current shared engine was integrated.
- Generated `robots.txt`, `llms.txt` and `llms-full.txt` match the baseline. Never
  hand-edit generated files to make a comparison pass.
- Schema.org code-snippet validation of homepage, FAQ, blog and temporary custom
  capability layout: **zero errors, zero warnings, nine top-level items**.
  Snippet validation does not prove public crawler access or Google rich-result
  eligibility. Credentials were not sent to the validator.
- Shared regression build passes for description-only answers, combined descriptions
  and bodies, escaping and opt-out, alongside existing lifecycle/canonical tests.
  All 22 FAQ descriptions appear exactly once in the resulting answer schema.
- Temporary capability fixture: one Service node uses the custom canonical URL
  consistently for its URL/ID and the document canonical. It renders the real
  capability MDX with the branded layout. The fixture is removed; no capability
  page is enabled in the release.
- Generated chatbot knowledge content matches the deployed-function bundle in
  the tested build. The generator still runs after bundling: future content edits
  must verify this match; a later build-time generation alone does not prove the
  earlier bundle refreshed. Its integration architecture is unchanged here.

Commands from this repository:

```sh
TZ=UTC npm run build
./node_modules/.bin/astro check
python3 ../greastro/tests/schema-output.py .
python3 tests/schema-faq-output.py
```

Typecheck remains a known deferred failure, not a clean check. Use a static
server over `dist/client` for visual QA. Do not use `astro dev`: its existing
background-sync hook can write to Supabase every 20 seconds. Do not submit
forms, chat messages or sync jobs as part of schema verification.

## Hosting record

- Team: `griffinjoshs-projects` (`team_XHhtRaFqJ86epPRSyadiDuHY`).
- Project: `webmaxxers` (`prj_8NsXLKA1X8hXZdFHs67CgRUXYTIC`).
- Repository: `griffinsurett/webmaxers`; production branch: `main`.
- Astro preset, repository root, Node 24.x. No dashboard build/install/output
  overrides; use package scripts and the existing Vercel adapter output.
- Verified production origin: `https://webmaxxers.com`. Both www and
  `webmaxers.vercel.app` redirect to the apex.
- Vercel Authentication remains `all_except_custom_domains`. Keep the existing
  Bot Protection and disabled automatic same-repository CI access. Only the
  approved Claude/Codex automation keys may be used; no new bypass is created.
- Credentials live outside repositories in the private workspace store. See
  AGENTS.md for the shared helper and the actual integration inventory. The
  reusable new-repository runbook is `../greastro/docs/VERCEL_SETUP.md`.

## Production verification

Vercel deployment `dpl_8yyCAHvWVDqHd8hY3Z15M5ZCJPVX` is Ready at
`https://webmaxxers.com`, serving main commit `0a88d7f9`.

- All **21 automated checks** passed after accounting for the existing contact
  form environment difference below. Twelve live HTML pages / 14 JSON-LD blocks
  match the tested build, including canonicals, text, links, images, metadata and
  external scripts. CSP headers are present. The image comparison removes only
  the exact Vercel deployment-ID query suffix.
- The live FAQ has all 22 questions; each schema answer matches its displayed
  bridge answer. All four review quotes appear in the carousel's serialized data.
  This does not substitute for testing the later slides interactively.
- Author, disabled capability and temporary QA routes return 404. Crawler files
  match generated output, and all three sitemap endpoints parse successfully.
- Local `PUBLIC_FORMSPREE_CONTACT_ID` differs from production. The live form action
  matches the pre-migration deployment `dpl_2DAghEVYqEdDyMCjMat4MvFUkBbv`; no form
  destination changed in this migration. No form submission was made.
- Both approved Claude/Codex keys return real HTML on the protected immutable
  deployment. Missing/invalid credentials redirect to Vercel login (302).
  No bypass credentials or protection settings were changed.
- Anonymous homepage, FAQ and robots requests each returned 200 with expected
  content and no challenge in this check. This is a point-in-time observation,
  not a guarantee of unrestricted crawler access.
- The fully merged local `feat/schema-system` branch was removed. Other branches
  are untouched. Repository hosting and integration records are in AGENTS.md.

See the compact production and deployment-access JSON records in
`docs/schema-validation/` for each check.

## Remaining release gate

Chrome checks on the deployed FAQ passed: description-only answers open, Space
collapses the focused answer, and the hosting FAQ displays both its introduction
and complete MDX body. The prior answer closes when another opens. No form or
chat submission was made.

The carousel responds to selecting Kenn Faria in the accessibility tree, but
all four slides have not been visually verified. Concurrent browser activity
interrupted the check, followed by `noWindowsAvailable`. This is not a failed
Vercel bypass test. A brief uninterrupted browser window was requested. Keep
the carousel gate pending until actually checked.
The later user request authorizes continuing Certified Bag Chasers technical work
while this visual gate remains pending. The deferred type-error reminder stays
scheduled for completion of the whole standalone and multisite rollout.


## Breadcrumb consolidation — 2026-09-29

The URL-segment schema builder has been replaced by Greastro's shared navigation
resolver. UI and schema use the same resolved data; schema emission waits for
rendered UI trails and otherwise uses the automatic hierarchy. See
[BREADCRUMBS.md](BREADCRUMBS.md). This is an integration correction following the
Farias `/demolitions` UI/schema mismatch, not a redesign or route change.

Build, output parity, navigation destination and schema regression checks are run
for this patch. Release evidence is recorded separately. Prior deployment records
remain historical and do not validate uncommitted changes.

Breadcrumb release `beade259` is deployed (`dpl_HirnYdz8ndXYuoRAsN4dQgR9j7vm`).
Authenticated checks on the production alias and exact deployment matched the
release build. Schema.org sampled markup had zero errors/warnings; all built
breadcrumb destinations and UI trails passed. See
[breadcrumb validation](schema-validation/breadcrumbs-2026-09-29.json).
