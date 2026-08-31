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
