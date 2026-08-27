# Prompt 2 — Configuring GTM + GA4 against this consent system

Paste this into a new AI session. It assumes the reader has already read
`consent-system-brief.md`, but restates the essentials so it can stand alone.

---

I need help configuring my **Google Tag Manager container and GA4 property** to
work correctly with a custom Consent Mode v2 implementation that is already
built and verified on my site. **The site code is finished — do not propose
changes to it.** I need guidance on the GTM/GA4 *interface* configuration.

## What my site already does (verified in-browser)

- Container: `GTM-TTGTZMFT`. GA4: `G-LQPJ59ZD85`, loaded *through* the container.
- Before any Google code exists, an inline script in `<head>` sets:
  ```js
  gtag('consent', 'default', {
    security_storage: 'granted',
    functionality_storage: 'denied',
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  ```
- **The GTM container script itself is blocked** until the visitor grants
  `analytics_storage`. It sits inert as
  `<script type="text/plain" data-consent="analytics_storage">` and is only
  activated after consent. Verified: a fresh or declining visitor produces
  **zero** requests to googletagmanager.com, google-analytics.com,
  doubleclick.net, or googleadservices.com.
- On a choice, `gtag('consent','update', …)` fires with all six types. Revoking
  mid-session flips Google's internal state and stops further requests.
- My consent categories are literally the Consent Mode types — my cookie stores
  those exact six keys, so there is no mapping layer.
- This is **basic** consent mode by design (no cookieless pings pre-consent). I
  understand the tradeoff; do not tell me to switch to advanced unless I ask.

## What I need from you

1. **Container-level consent settings.** Walk me through enabling *Consent
   Overview* (Admin → Container Settings) and how to read the shield icon in the
   workspace to spot tags with unconfigured consent.

2. **Per-tag consent configuration.** For each tag type, tell me exactly what to
   set under **Tag → Advanced Settings → Consent Settings**:
   - GA4 Configuration / GA4 Event tags
   - Google Ads Conversion / Remarketing tags
   - **Custom HTML tags** (Meta Pixel, Hotjar, LinkedIn Insight, etc.) — I
     understand these do *not* read consent automatically and need
     "Require additional consent for tag to fire". Confirm which consent type
     each should require.

3. **What "built-in consent checks" actually cover.** Which Google tags respect
   `analytics_storage` / `ad_storage` natively, and what that changes about
   their behaviour when denied (cookieless pings vs. nothing at all) — bearing
   in mind my container does not load at all pre-consent.

4. **GA4 property settings** that matter alongside Consent Mode: Google signals,
   data retention, IP anonymisation defaults, and whether consent mode changes
   what I should enable.

5. **Testing procedure.** How to verify with Tag Assistant / Preview mode:
   - that no tag fires before consent (my container won't even load, so tell me
     what Preview mode will look like in that state and how to test meaningfully)
   - that each tag's consent state shows correctly after granting
   - that granting **Analytics only** fires GA4 but no ad tags
   - what `google_tag_data.ics.entries` should look like in the console at each
     step

6. **A gap I already know about and want confirmed:** because my container is
   gated on `analytics_storage`, a visitor who grants *only* Advertising gets no
   ad tags at all — the container never loads. Tell me whether that matters for
   my setup and what the options are if I want to support that combination.

## Constraints

- Do not suggest a CMP (Cookiebot, OneTrust, etc.). My consent UI is custom and
  staying.
- Do not suggest editing site code. I need GTM/GA4 dashboard configuration.
- Assume GDPR + CCPA exposure; I serve EEA/UK visitors from the US.
- Be concrete about menu paths and field names; I will follow them literally.
