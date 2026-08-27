# Prompt 1 — Understanding the custom consent system

Paste this into a new AI session before asking it to touch anything
consent-related in this repo.

---

You are working in an Astro 5 + React 19 + Tailwind 4 site (a fork of the
"greastro" template). It has a **custom, hand-rolled cookie consent system** —
no CMP, no third-party consent library. Read this before writing any code that
touches analytics, tracking, cookies, or third-party scripts.

## The one rule that makes this system different

**The consent categories ARE Google Consent Mode v2 types.** There is no
translation layer and you must not add one. The stored cookie maps 1:1 onto the
`gtag('consent', ...)` payload. If you find yourself writing a mapping table
like `performance -> analytics_storage`, stop: that is the old design and it was
deliberately removed because the two halves drifted apart.

## Source of truth

`src/integrations/preferences/consent/core/types.ts` exports everything. Import
from there; never hardcode a category list.

```ts
CONSENT_TYPES   // ['security_storage','functionality_storage','analytics_storage',
                //  'ad_storage','ad_user_data','ad_personalization']
ALWAYS_GRANTED  // ['security_storage'] — never presented as a choice, never denied
AD_TYPES        // the three ad_* types, set together by one UI toggle
CONSENT_VERSION // 2 — bump when the stored shape changes
defaultConsent()    // essentials only (the "declined" state)
fullConsent()       // everything granted (the "Accept All" state)
isCurrentConsent(v) // type guard; false for any cookie without the current version
```

`src/integrations/preferences/consent/core/utils/consent.ts`:

```ts
CONSENT_COOKIE = 'cookie-consent'   // first-party, 365 days, path=/
getConsent(): CookieConsent | null  // null if absent, malformed, OR wrong version
saveConsent(consent)                // writes cookie + dispatches 'consent-changed'
hasConsentFor(type) / isTrackingAllowed(type)  // latter also honours Do Not Track
toConsentModePayload(consent)       // -> Record<ConsentType,'granted'|'denied'>
optOutOfSale()                      // CCPA: reset to defaultConsent()
```

## How it fits together

1. **`GoogleTagManager.astro` runs first in `<head>`** (via `IntHeadScripts`).
   Its inline script sets `gtag('consent','default', …)` with everything denied
   except `security_storage`, plus `wait_for_update: 500` — *before* any Google
   code exists. It receives `CONSENT_TYPES` / defaults / `CONSENT_VERSION`
   through `define:vars` so it can't drift from the UI.

2. **GTM itself is blocked**, rendered as
   `<script type="text/plain" data-consent="analytics_storage">`. A
   non-executing type means the browser will not run it.

3. **`scriptManager.ts` unblocks scripts.** It finds
   `script[type="text/plain"][data-consent="<type>"]`, clones each into a real
   `text/javascript` tag, and runs it. This is how *any* third-party script gets
   gated — add `type="text/plain" data-consent="<consent_type>"` and it is
   handled automatically.

4. **The banner** (`ui/CookieConsentBanner.tsx`) calls `saveConsent()`, which
   dispatches `consent-changed`. The GTM inline script listens for that event
   and sends `gtag('consent','update', …)` built by reading the stored types
   straight across.

5. **Old cookies re-prompt.** `getConsent()` returns `null` for anything without
   `version: 2`, so the banner reappears rather than us guessing at a migration.

## Conventions you must follow

- **Never hardcode a category list.** Iterate `CONSENT_TYPES`.
- **Never write the cookie directly.** Use `saveConsent()` — writing it by hand
  skips the `consent-changed` event and Google never learns about the change.
- **To gate a new third-party script**, add
  `type="text/plain" data-consent="<type>"`. Do not invent a new gating
  mechanism.
- **Mapping guide:** analytics → `analytics_storage`; ads/remarketing →
  `ad_storage`; anything remembering a user preference (language, theme, push
  notifications) → `functionality_storage`.
- **The banner is NOT a modal.** It passes `modal={false}` to `Modal`. With the
  default (`true`) the Modal marks `header`/`main`/`footer` as `inert`, which
  leaves the page scrollable but makes nothing clickable. Keep `modal={false}`.
- The preferences modal *is* modal (default) — that one should block.

## Verified behaviour (don't regress these)

- Fresh visitor: **0** network requests to googletagmanager / google-analytics /
  doubleclick / googleadservices.
- Declined visitor on a fresh load: **0** requests; the loader stays
  `type="text/plain"`; `window.google_tag_manager` is never created.
- Accept All: `consent update` with all six granted, then GTM loads.
- Analytics-only: GTM loads, all three `ad_*` stay denied.
- Revoke mid-session: `update` fires with everything denied, Google's internal
  state (`google_tag_data.ics.entries`) flips, **0** further requests.
  Caveat: `window.google_tag_manager` stays resident until the next page load —
  a browser reality (code already executed cannot be unloaded), not a bug.

## Deliberate design decisions — do not "fix" these

- **This is basic, not advanced, consent mode.** GTM does not load at all before
  consent, so Google receives nothing from non-consenting users (no cookieless
  pings, no conversion modelling). Switching to advanced means ungating the
  loader so GTM runs under the denied defaults. That is a privacy-posture
  decision for the site owner — do not change it unilaterally.
- **Vercel Analytics / Speed Insights are intentionally ungated.** They are
  cookieless, set no device storage, and do not require consent.
- **The AI chat is intentionally ungated.** It stores nothing on the device (the
  session id lives in a React `useRef`) and is user-initiated. Its lawful basis
  is legitimate interest with up-front disclosure, not cookie consent.
