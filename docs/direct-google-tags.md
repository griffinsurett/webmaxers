# Direct Google tags with Zest

Migrated from published GTM-P6HHJC3Z version 4 on 2026-09-24:
- GA4: G-MWPC04E67Q
- Ads: AW-18471438772

GoogleTags.astro runs after ZestEngine. googleTags.js checks saved preferences
and listens for zest:change; Zest queues Consent Mode updates before that event.
Each allowed destination is configured once per document. The shared gtag.js
loader runs once when either Analytics or Advertising is allowed. No GTM
container is loaded; PUBLIC_GTM_ID is no longer consumed. The Google-hosted
library still uses www.googletagmanager.com despite not using GTM.

Zest explicitly allows that shared host because its built-in classification is
Analytics-only. The site bridge gates loading; Google Consent Mode and Zest's
other interceptors continue handling consent changes. Withdrawal does not unload
already executed JavaScript. GA4's disable flag is also set when Analytics is off.
Existing geographic consent policy is unchanged.

The redundant custom event named "Google Analytics" is intentionally omitted.
The source container has no Google Ads conversion action tags; this migration
copies the base tag, not a newly invented lead/purchase conversion or label.
The remote GTM container remains intact for reference; its MCP is read-only.

Validation: isolated Chrome with actual installed Zest, Google network stubbed:
reject, analytics-only, advertising-only, accept-all, revoke, saved consent after
reload, repeated updates. Production Astro build passed. After deployment verify
real collection requests and consent states in Tag Assistant. Expect G- and AW-
IDs, not the old GTM container. CSP Google Ads allowlist is still required.
