// src/siteData.ts
export const SITE_DOMAIN = "webmaxxers.com";
export const SITE_URL = `https://${SITE_DOMAIN}`;

/** Site facts. The structured-data fields are documented in src/utils/schema/README.md. */
export interface SiteData {
  title: string;
  /** Visual wordmark, rendered only by <TextLogoStatic>. */
  wordmark: string;
  /** Public company name — footer, legal pages and structured data. */
  legalName?: string;
  dbaNotice?: string;
  tagline?: string;
  description?: string;
  domain: string;
  url: string;
  location?: string;
  address?: string | null;
  /** BCP 47 language — <html lang> and schema inLanguage. */
  language: string;
  activePromoSlug: string;

  // ── Structured data — only what isn't already above or in a collection.
  // Contact details, hours and address come from `contact-us`, profiles from
  // `social-media`, people from `authors`. See src/utils/schema/README.md.
  /**
   * schema.org business type. A local type ("LocalBusiness",
   * "RoofingContractor", "Plumber", "LegalService", …) adds address, hours and
   * service area; an online type ("OnlineBusiness", "OnlineStore",
   * "Organization") leaves them out.
   */
  schemaType: string;
  /** Default blog author ID; founders are authors tagged "founder". */
  defaultAuthor?: string;
  defaultInstructor?: string;
  foundingDate?: string;
  /** ISO 4217 currency for prices. */
  currency: string;
  /** Multi-site brands: the company's home URL, shared by every site. */
  parentUrl?: string;
}

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
  language: "en",
  location: "Freehold, New Jersey, United States",
  address: null,
  tagline: "Get a website your business can be proud of — fast, secure, and built to last.",
  /**
   * The live promo — an entry id in the `promos` collection (filename without
   * extension). Empty string or a slug that does not resolve = no popup, with
   * no code change needed. i75 calls this `activeSpecialSlug`.
   */
  activePromoSlug: "play-for-a-discount",
  // No public address, phone or opening hours: the team works with clients
  // remotely (calls booked online, the contact form) and serves visitors
  // worldwide (privacy policy), so the business is typed as online.
  schemaType: "OnlineBusiness",
  // `authors` entry — "Founder of Webmaxxers".
  defaultAuthor: "griffin-surett",
  currency: "USD",
} satisfies SiteData as SiteData;

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
 * Popup DEFAULTS — timing and frequency only.
 *
 * The popup's CONTENT lives in the `promos` content collection, not here;
 * `activePromoSlug` (in siteData above) names the live entry, and each promo
 * may override any of these per-campaign. This split mirrors i75, where
 * `popupData` carries the mechanics and the `specials` collection carries the
 * copy.
 *
 * TIMING — `delayMs` races `scrollPercent`; whichever fires first opens it.
 * 8000ms matches i75. The island is hydrated `client:idle` and does no work
 * before that, so the delay costs nothing at load.
 */
export const popupData = {
  enabled: true,
  /** "campaign" → localStorage (once per browser) · "session" → sessionStorage · "always" → every load. */
  frequencyMode: "campaign" as "campaign" | "session" | "always",
  delayMs: 8000,
  scrollPercent: 35,
  storageKeyPrefix: "play-for-discount",
};
