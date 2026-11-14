# Legal & Compliance Guide

> **Purpose.** This is the reusable playbook for the legal documents on Griffin's Web
> Services sites (Privacy Policy, Terms of Service, Cookie Policy). It records **what the
> compliance checklist requires**, **what changed on this site and why**, and **a
> step-by-step cleanup checklist** you can run against any other website.
>
> **Not legal advice.** This is a structural/compliance guide written by a developer, not
> an attorney. The New Jersey governing-law clause and the GDPR/international-transfer
> language in particular are worth a quick attorney review before you rely on them,
> especially for EU and worldwide traffic.

**Business context this guide assumes:**
- Legal entity: **Griffin's Web Services LLC**, based in **New Jersey, USA**.
- Serves clients in **NJ, the wider US, the EU/UK, and worldwide**.
- **Email-free & address-free** public contact strategy — all inquiries go through a
  secure contact form, never a published email address or street address.
- **No user accounts / no logins** — it's a marketing + portfolio site. Paid work is
  governed by separate signed contracts.

---

## 1. Where the legal content lives (this project's structure)

On a Greastro/Astro site, legal pages are content, not hardcoded pages:

| File | Purpose |
|---|---|
| `src/content/legal/privacy-policy.mdx` | Privacy Policy |
| `src/content/legal/terms-of-service.mdx` | Terms of Service |
| `src/content/legal/cookie-policy.mdx` | Cookie Policy |
| `src/content/legal/_meta.mdx` | Collection config for the `legal` collection |
| `src/content/siteData.ts` | Source of `legalName`, `title`, `location`, `address` used across all docs |

**Shared, reusable legal components** (import these instead of hand-writing repeated blocks):

| Component | Path | What it renders |
|---|---|---|
| `LegalContactSection` | `src/integrations/preferences/consent/ui/PrivacyPolicy/LegalContactSection.astro` | The email-free "contact us via form" block. Reads `siteData.location`/`address`. |
| `CCPARights` | `.../PrivacyPolicy/CCPARights.astro` | Full California (CCPA/CPRA) rights + opt-out UI |
| `IntegrationsSnippet` | `.../PrivacyPolicy/IntegrationsSnippet.astro` | Auto-lists integrations from `PUBLIC_INTEGRATION_*` env vars *(see gotcha in §5)* |

### The auto-numbering pattern (important when editing)
The MDX docs number their own sections with `{++sectionNumber}`:

```mdx
export let sectionNumber = 0;

## {++sectionNumber}. Introduction        → renders "1. Introduction"
## {++sectionNumber}. Information We Collect → renders "2. ..."
```

**Consequence:** when you insert or remove a `## {++sectionNumber}` heading, every later
section renumbers automatically. You never hand-edit numbers — but you **must** rebuild to
confirm the sequence still reads correctly. Sub-sections (`### {sectionNumber}.1`) reuse the
current counter, so if you add a sub-section you renumber its siblings by hand.

---

## 2. The Compliance Checklist (what every doc must contain)

### 🛡️ Privacy Policy — required elements
- [ ] **Formal legal entity** named (Griffin's Web Services LLC, New Jersey).
- [ ] **What you collect** via forms: names, emails, phone, URLs/message content.
- [ ] **Third-party data processors listed explicitly by name**, each with a link to their
      privacy policy:
  - Formspree (form routing)
  - Vercel + Vercel Analytics (hosting + anonymous analytics)
  - Google Analytics (analytics, if enabled)
  - OpenAI (chatbot prompt processing)
  - Supabase (chatbot conversation storage)
  - Calendly (call scheduling)
- [ ] **AI data safeguard**: state inputs are rate-limited/monitored for abuse and **not used
      to train AI models**.
- [ ] **PII warning**: tell users not to type passwords, card numbers, or sensitive personal
      info into the chat box. *(Also surface this in the chat UI itself.)*
- [ ] **CCPA** section (California rights + "Do Not Sell/Share" opt-out).
- [ ] **GDPR / UK GDPR** section (legal bases, data-subject rights, complaint right).
- [ ] **International data transfers** disclosure (data goes to US-based processors).
- [ ] **Data retention** statement.
- [ ] **Children's privacy** (no collection from under-16).
- [ ] **Email-free contact clause** — deletion/questions handled via the secure contact form,
      no email address anywhere.

### ⚖️ Terms of Service — required elements
- [ ] **Governing law = State of New Jersey** (+ NJ venue for disputes).
- [ ] **Intellectual property** — all code, graphics, layouts, and text belong to the LLC.
- [ ] **AI output disclaimer** — chatbot responses are automated, "as-is", not liable for
      errors/hallucinations.
- [ ] **Non-binding quotes** — chatbot estimates/pricing/advice are not a contract.
- [ ] **Prohibited conduct** — ban scraping code, form spam, and **prompt-injection / AI
      endpoint abuse**.
- [ ] **No stale SaaS boilerplate** — no "user accounts", passwords, or "we'll email you"
      if the site has neither accounts nor a published email.
- [ ] Third-party services list consistent with the Privacy Policy.

### 🍪 Cookie Policy — required elements
- [ ] Explains what cookies are and the categories used (Necessary / Preferences /
      Statistics / Marketing).
- [ ] GDPR consent + CCPA opt-out language.
- [ ] Link to the Privacy Policy.

### SEO/technical hygiene for all legal pages
- [ ] `robots: "noindex, nofollow"` in frontmatter (don't rank legal boilerplate).
- [ ] `effectiveDate` bumped whenever content **materially** changes.

---

## 3. Changes made on THIS site (2026-07-05)

Two rounds of edits. All are working-tree content edits; each was verified by running
`astro build` and grepping the rendered HTML in `dist/`.

### Round 1 — HIGH-risk fixes
| # | Change | File | Why |
|---|---|---|---|
| 1 | Governing law changed **"United States" → "State of New Jersey"**, added NJ court venue + a clause for non-US visitors. | `terms-of-service.mdx` | "US law" is legally vague/unenforceable; checklist requires NJ. Highest-priority fix. |
| 2 | Added **Formspree** as a named processor + a full processor list (Formspree, Vercel, Supabase, OpenAI, Calendly). | `privacy-policy.mdx` | Forms POST directly to Formspree but it was disclosed **nowhere**. |
| 3 | Added a **GDPR/UK GDPR** section: legal bases, data-subject rights, complaint right, **international-transfer** disclosure (US processors, SCCs), and **data retention**. | `privacy-policy.mdx` | Site serves the EU but had zero GDPR coverage — the biggest exposure for EU visitors. |

### Round 2 — MEDIUM / LOW fixes
| # | Change | File | Why |
|---|---|---|---|
| 4 | Replaced SaaS **"User Accounts / passwords"** section with **"Client Engagements"** (defers to signed contracts). | `terms-of-service.mdx` | Site has no logins; boilerplate contradicted reality. |
| 5 | Added **Supabase** and **Formspree** subsections to the ToS third-party list. | `terms-of-service.mdx` | Consistency with the Privacy Policy processor list. |
| 6 | Removed the **"we'll email your registered email address"** change-notification line. | `terms-of-service.mdx` | Email-free + account-free; the promise was impossible to keep. |
| 7 | Added bans on **scraping, form spam, prompt injection, and bot abuse** to Acceptable Use. | `terms-of-service.mdx` | Checklist requires explicit AI-endpoint + spam prohibitions. |
| 8 | Removed dead **"pricing estimator"** references from the OpenAI section. | `terms-of-service.mdx` | That feature/API was removed from the codebase. |
| 9 | Added a **Children's Privacy** section (no data from under-16). | `privacy-policy.mdx` | EU/COPPA hygiene. |
| 10 | `effectiveDate` left unchanged (**2026-06-05**) on Privacy + ToS. | both | Kept per owner's decision; bump manually if/when you want the "last updated" date to reflect these edits. |

### What was already compliant (kept as-is)
- Legal entity name via `siteData.legalName`.
- OpenAI disclosed + "not used to train models".
- PII warning in both the Privacy Policy **and** the chat UI (`src/components/AskAi/AskAi.tsx`).
- AI "as-is" / non-binding-quote language.
- Vercel Analytics disclosure.
- Email-free contact clause (`LegalContactSection` renders "Use our contact form").
- Full CCPA rights component.
- Cookie Policy with GDPR/CCPA language + dynamic cookie table.

---

## 4. Cleanup checklist for OTHER sites

Run this top-to-bottom on each site. It mirrors the fixes above.

**A. Reconnaissance first**
1. Locate the three legal docs (on Greastro sites: `src/content/legal/*.mdx`).
2. Confirm the business facts for *that* site: entity name, home state, whether it has
   logins, whether it publishes an email/address, and which third parties it actually uses.
   > ⚠️ Don't copy this site's processor list blindly — grep the codebase for what each site
   > **actually** integrates (see step B).

**B. Find the real third-party stack (don't trust the docs)**
```bash
# Form processor
grep -rn "formspree\|Formspree" src

# AI / LLM
grep -rn "openai\|OpenAI\|anthropic" src

# Storage / DB / analytics
grep -rn "supabase\|Supabase\|@vercel/analytics\|google-analytics\|gtag" src

# Any published email addresses that violate the email-free strategy
grep -rn "@.*\.\(com\|net\|org\)" src/content/legal src/layouts src/components
```
Every service that turns up **must** appear in the Privacy Policy processor list.

**C. Privacy Policy edits**
- [ ] Entity name correct (via `siteData.legalName`).
- [ ] Processor list matches the grep results, each with a privacy-policy link.
- [ ] OpenAI section present with "not used to train models" (only if the site has AI).
- [ ] CCPA section present (`<CCPARights />`).
- [ ] GDPR section present: legal bases + rights + **international transfers** + retention.
- [ ] Children's privacy section present.
- [ ] No email addresses; `LegalContactSection` used for contact.
- [ ] `robots: "noindex, nofollow"` in frontmatter.

**D. Terms of Service edits**
- [ ] Governing law = the entity's home state (here: **New Jersey**) + venue.
- [ ] Remove account/password sections **if the site has no logins**.
- [ ] Remove "we'll email you" notification lines **if email-free**.
- [ ] Acceptable Use bans scraping, spam, and prompt injection.
- [ ] Third-party list matches the Privacy Policy.
- [ ] No references to removed features (grep for `estimator`, old API names, etc.).

**E. Cookie Policy edits**
- [ ] Categories + GDPR consent + CCPA opt-out language present.
- [ ] Links to the Privacy Policy.

**F. Verify (never skip)**
```bash
# From the project root
./node_modules/.bin/astro build

# Confirm the new text actually rendered (adjust dist path per project)
grep -o "State of New Jersey\|International Data Transfers\|Formspree" \
  dist/client/terms-of-service/index.html dist/client/privacy-policy/index.html
```
- [ ] Build passes with no errors.
- [ ] `{++sectionNumber}` numbering reads correctly (1, 2, 3… no gaps/dupes).
- [ ] Grep confirms each new clause is in the rendered HTML.
- [ ] Bump `effectiveDate` on any doc whose content materially changed.

---

## 5. Gotchas & footguns

- **`IntegrationsSnippet` reads `PUBLIC_INTEGRATION_*` env vars, not `PUBLIC_FORMSPREE_*`.**
  On this site the Formspree vars are named `PUBLIC_FORMSPREE_CONTACT_ID` etc., so the
  auto-lister renders nothing — that's why Formspree had to be added to the Privacy Policy
  **by hand**. If you want the snippet to work, either rename the env vars to the
  `PUBLIC_INTEGRATION_*` convention or keep listing processors manually.
- **Smart quotes escape in HTML.** "Children's Privacy" renders with a curly `'`
  (`&#39;`/`'`), so a grep for a straight apostrophe will falsely report it missing. Grep
  a substring without the apostrophe.
- **`npx astro build` can pull the wrong global Astro** ("Missing pages directory" /
  installing `astro@7`). Always build with the local binary: `./node_modules/.bin/astro build`.
- **Don't hand-number sections.** Editing a literal number instead of using
  `{++sectionNumber}` will desync the whole document.
- **Copy facts, not text, between sites.** Governing state, login existence, and the
  processor stack differ per site — re-derive them each time (step A/B).

---

## 6. Open items / recommended follow-ups
- **Attorney review** of the NJ governing-law clause and the GDPR/SCC language before
  relying on them for EU traffic.
- **Confirm SCCs actually apply**: the GDPR section states transfers use "Standard
  Contractual Clauses." Vercel, OpenAI, Supabase, and Formspree all offer SCCs via their
  standard DPAs — verify each site's providers before repeating the claim.
- Consider **renaming Formspree env vars** to `PUBLIC_INTEGRATION_*` so the
  `IntegrationsSnippet` auto-discloses them (removes a manual maintenance step).
- Consider a short **DPA/data-processing note** if you ever start handling client end-user
  data on their behalf (different from your own site visitors).
