# Webmaxxers schema migration — 2026-09-29

Status: shared port, local build, baseline comparison and Schema.org validation
pass. Browser interaction and production verification are still pending.
Do not call the site complete until those checks are recorded below.

## Source and scope

Started on `feat/schema-system` at `9cdb1721`; `main` pointed to the same commit.
Switched to main without discarding existing uncommitted work. The comparison
baseline includes that earlier partial schema port and type fixes, not just the
older deployed commit. Source, existing output and the fresh baseline build
were saved under `/tmp/webmaxxers-schema-baseline-20260929`; no environment files
or bypass credentials were copied.

Inherit Greastro's tested `c71c801` runtime plus the tested ContentBridge description
opt-in discovered during this port. Its earlier documentation checkpoint
is `71686d5`. Checksums for 29 inherited files are in
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

## Remaining release gates

1. Browser: FAQ open/close and rendered MDX; all four testimonial slides, including
   the three reviews absent from the initially rendered slide.
2. Commit/push reviewed source; verify the production deployment's schema,
   content, routes, generated crawler files and security headers against the build.
3. Verify both approved keys on the protected deployment and negative access
   without a valid key. Record anonymous crawler behavior separately.

Chrome interaction attempts were interrupted by concurrent user activity; they
are not counted as failed bypass tests or completed browser checks.
