// src/siteData.ts
export const SITE_DOMAIN = "webmaxxers.com";
export const SITE_URL = `https://${SITE_DOMAIN}`;

export const siteData = {
  // Plain-text brand name — used everywhere the name is READ rather than
  // displayed: SEO/meta, schema.org, image alt text, legal copy, share titles
  // and the chatbot prompts. Keep it free of stylization.
  title: "Webmaxxers",
  // Visual wordmark, rendered only by <TextLogoStatic>. The @ is emitted as its
  // own span there so it can be optically sized down — the glyph is drawn with
  // a ring that overshoots the surrounding lowercase letters, so at a matched
  // font-size it reads noticeably larger than they do.
  wordmark: "Webm@xxers",
  legalName: "Griffin’s Web Services LLC",
  // Shown in the footer. Kept out of `legalName` because that value is
  // interpolated mid-sentence in the legal pages, the schema.org publisher, and
  // the chatbot system prompt, where a full sentence breaks the grammar.
  dbaNotice: "Webmaxxers is a registered DBA of Griffin’s Web Services LLC.",
  description: "Every great business deserves a powerful online presence. We create websites that do more than just exist — they load instantly, showcase your brand, engage visitors, and grow alongside your business. We don’t just design your site — we make it lightning-fast, manage it, and protect it for the long term.",
  domain: SITE_DOMAIN,
  url: SITE_URL,
  location: "Freehold, New Jersey, United States",
  address: null,
  tagline: "Get a website your business can be proud of — fast, secure, and built to last.",
};

export const CALENDLY_URL = "https://calendly.com/griffinswebservices/30min";

export const ctaData = {
  text: "Book a Free Call",
  link: CALENDLY_URL,
  external: true,
};

export const contactCtaData = {
  text: "Book a Free Call",
  link: CALENDLY_URL,
  external: true,
};

export const quoteCtaData = {
  text: "Get a Free Quote",
  link: "/contact-us",
};

/**
 * "Play for a discount" popup — the timed modal that invites visitors to the
 * Saucer Defender game at /game.
 *
 * Mirrors the i75 `popupData` contract (each site's own src/content/siteData.ts
 * under i75-websites/sites) so both are configured the same way: copy and timing live HERE, and
 * the component reads them as props. Nothing about the offer is hardcoded in
 * the island.
 *
 * TIMING — `delayMs` races `scrollPercent`; whichever fires first opens it.
 * 8000ms matches i75. The island is hydrated `client:idle` and does no work
 * before that, so the delay costs nothing at load; see PlayForDiscountPopupHost.
 *
 * COPY — the discount is deliberately unquantified ("a discount"), matching
 * what /game itself promises in its meta description. Put a figure in
 * `description` when there is one to commit to.
 */
export const popupData = {
  enabled: true,
  /** "campaign" → localStorage (once per browser) · "session" → sessionStorage · "always" → every load. */
  frequencyMode: "campaign" as "campaign" | "session" | "always",
  delayMs: 8000,
  scrollPercent: 35,
  storageKeyPrefix: "play-for-discount",
  /** Bump to re-show the popup to everyone who already dismissed it. */
  campaignSlug: "saucer-defender-v1",
  eyebrow: "Play for a discount",
  heading: "Beat the game.\nWin a discount.",
  description:
    "Score 10,000 points in 90 seconds of Saucer Defender and claim a discount on your website project.",
  /** Primary action — the game. */
  buttonText: "Play for a discount",
  href: "/game",
  /** Secondary action — for visitors who would rather just talk. */
  secondaryButtonText: "Just book a call",
  secondaryHref: CALENDLY_URL,
  secondaryExternal: true,
};
