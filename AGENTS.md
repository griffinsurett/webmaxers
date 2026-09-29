# Webmaxxers

This is a brand project built on Greastro. Read `../greastro/AGENTS.md` for the
shared architecture and `../AGENTS.md` for private deployment verification.
Preserve Webmaxxers's content and design when inheriting template utilities.

## Identity and content

- Public brand: Webmaxxers. Legal entity: Griffin's Web Services LLC; retain the
  documented DBA relationship. `src/content/siteData.ts` holds sitewide facts.
- Canonical origin: `https://webmaxxers.com`. Structured-data type: `OnlineBusiness`.
  There is no published customer office; do not invent an address or hours.
- Griffin Surett's JSON author is tagged `founder` and is the default blog author.
  Author pages are disabled. Author identity still participates in schema.
- `BaseLayout` owns the document; `SiteLayout` supplies the branded header/footer.
  Preserve custom capability MDX, article UI, carousel, 3D/media and promotions.
- Schema utilities and components inherit Greastro. Per-site technical mappings
  live in `src/utils/schema/siteMap.ts`; UI stays in its existing components.
  The carousel displays and registers the same prepared testimonial entries.
  Its displayed quotes are descriptions; it shows no stars, so omit ratings.
- Capabilities currently have `itemsHasPage: false`. Do not publish those pages
  as part of schema work. Their custom layout declares the `service` subject for
  future pages explicitly enabled through the existing content settings.

## Existing integration exceptions

Keep `output: static` and the existing Vercel adapter/API routes. The chatbot's
OpenAI/Supabase runtime paths and `/api/sync` cron predate this migration; they
are exceptions to the template's static-content baseline. Do not expand them
or invoke chat/sync just to test schema.

**Do not use `astro dev` for read-only visual QA:** its existing background-sync
hook may write to Supabase every 20 seconds. Serve `dist/client` with a local
static server instead. Build output is generated under `dist/client` and
`.vercel/output`, not only `dist`.

`robots.txt`, `llms.txt`, `llms-full.txt`, video thumbnails and the chatbot's
`knowledge-base.generated.ts` are generated. Change content/config/generators,
never hand-edit these artifacts. The chatbot generator runs after bundling;
verify its generated source matches the bundled knowledge base before release.

## Sanctioned third parties & endpoints

These are existing integrations inventoried during migration, not new services:

- Vercel hosting/functions, existing deployment feedback, Web Analytics and
  Speed Insights. Preserve configured security headers and deployment protection.
- Formspree at `https://formspree.io/f/`, configured by
  `PUBLIC_FORMSPREE_CONTACT_ID`, `PUBLIC_FORMSPREE_QUOTE_ID` and the existing
  game's `PUBLIC_FORMSPREE_WINNER_ID`.
- Google Tag Manager via `PUBLIC_GTM_ID`, with the existing Google Analytics/Ads
  destinations allowed in `vercel.json`. Preserve consent behavior.
- Google Translate (`translate.google.com`, `translate.googleapis.com`,
  `translate-pa.googleapis.com` and required Google static assets), through the
  existing language preferences integration.
- OpenAI API (`api.openai.com`) from existing server-side chatbot/knowledge sync.
  `OPENAI_API_KEY` is private; never expose it through `PUBLIC_*` or client code.
- The configured Supabase project (`SUPABASE_URL`, `*.supabase.co`) for existing
  server-side chat/knowledge storage. Service-role credentials remain private.

Calendly is an outbound booking link in siteData, not an embedded integration.
No form, chat request or synchronization job is submitted during schema QA.

## Validation and hosting

See `docs/SCHEMA_MIGRATION.md` for migration decisions, checks and Vercel facts.
The shared new-repository runbook is `../greastro/docs/VERCEL_SETUP.md`.
Never copy `.vercel` project linkage or private bypass keys into a new repository.
Only the existing approved Claude/Codex keys are permitted; use the private
workspace helper. A browser without the header does not inherit this access.

The user deferred the original 54 type-check errors until **all standalone and
multisite schema work is finished**. Compare against the migration baseline and
fix new regressions only. Shared author lookup resolved one old error, leaving
53. Remind the user at the end of the entire rollout; do not treat the remaining
type backlog as authorization to skip schema/build/UI/deployment validation.
