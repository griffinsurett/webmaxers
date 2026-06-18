// src/siteData.ts - Compatible with both Astro and React
import { SITE_DOMAIN, SITE_URL } from "./siteDomain.js";

export const siteData = {
  title: "Webmaxxers",
  legalName: "Griffin's Web Services LLC",
  tagline: "Build fast. Stay typesafe. Ship with confidence.",
  description:
    "Finest Typesafe Static Sites with Astro, dynamically static with content collections.",
  domain: SITE_DOMAIN,
  url: SITE_URL,
  location: "New Jersey, USA",
  address: "123 Main St, Springfield, NJ 07081",
};

export const ctaData = {
  text: `Get Started with ${siteData.title}`,
  link: "/contact-us",
};
