// backend/src/services/research/signals.ts
// Pattern tables for the extractor: what counts as a trust signal, a call to action, a
// booking tool, a chat widget, or a site platform. Plain data, easy to extend.

export type TrustTag =
  | 'reviews' | 'rating' | 'licensed' | 'insured' | 'certified' | 'warranty' | 'guarantee'
  | 'years_in_business' | 'family_owned' | 'financing' | 'free_estimate' | 'emergency'
  | 'awards' | 'affiliations' | 'before_after' | 'local_owned';

export const TRUST_PATTERNS: { tag: TrustTag; re: RegExp }[] = [
  { tag: 'rating', re: /\b[45](?:\.\d)?\s*(?:\/\s*5|out of 5|-?\s*star)|\b5-?star\b|★{3,}/i },
  { tag: 'reviews', re: /\b(?:\d[\d,]{0,8}\+?\s+(?:five[- ]star\s+)?(?:google\s+)?reviews?|customer reviews?|testimonials?|what (?:our )?(?:customers|clients|patients) say)\b/i },
  { tag: 'licensed', re: /\blicen[cs]ed\b|\blicen[cs]e\s*(?:#|no\.?|number)/i },
  { tag: 'insured', re: /\b(?:fully\s+)?(?:insured|bonded)\b/i },
  { tag: 'certified', re: /\bcertified\b|\bcertification\b|\baccredited\b|\bnate\b|\bepa\b/i },
  { tag: 'warranty', re: /\bwarrant(?:y|ies)\b/i },
  { tag: 'guarantee', re: /\bguarantee[ds]?\b|\bsatisfaction\b/i },
  { tag: 'years_in_business', re: /\b(?:since\s+(?:19|20)\d\d|(?:over\s+|more than\s+)?\d{1,2}\+?\s+years?(?:\s+of\s+experience|\s+in\s+business)?|established\s+in\s+(?:19|20)\d\d)\b/i },
  { tag: 'family_owned', re: /\bfamily[- ](?:owned|operated|run)\b/i },
  { tag: 'local_owned', re: /\blocally[- ](?:owned|operated)\b|\blocal(?:ly)?\s+(?:business|company|experts?)\b/i },
  { tag: 'financing', re: /\bfinancing\b|\bpayment plans?\b|\b0%\s*apr\b|\bmonthly payments?\b/i },
  { tag: 'free_estimate', re: /\bfree\s+(?:estimates?|quotes?|inspections?|consultations?|diagnos\w+)\b/i },
  { tag: 'emergency', re: /\b24\s*\/\s*7\b|\b24[- ]hours?\b|\bemergency\s+(?:service|repair|response|plumbing|call)s?\b|\bsame[- ]day\b/i },
  { tag: 'awards', re: /\baward[- ]winning\b|\bbest of\b|\bvoted\b|\btop[- ]rated\b|\bwinner\b/i },
  { tag: 'affiliations', re: /\bBBB\b|better business bureau|chamber of commerce|\bangi\b|homeadvisor|\bnahb\b|\bnari\b/i },
  { tag: 'before_after', re: /\bbefore\s*(?:&|and|\/)\s*after\b/i },
];

export const CTA_TEXT =
  /\b(?:call|text us|get (?:a |your )?(?:free )?(?:quote|estimate|started|offer|price)|free (?:quote|estimate|consultation|inspection)|request|book|schedule|appointment|contact us|order|buy now|shop now|start|sign up|subscribe|reserve|apply|download|learn more|see pricing|view (?:plans|pricing))\b/i;

/** A third-party service recognised by the hostname of a URL (never by substring). */
export interface Provider { name: string; hosts: string[]; pathPrefix?: string }

export const BOOKING_PROVIDERS: Provider[] = [
  { name: 'Calendly', hosts: ['calendly.com'] },
  { name: 'Acuity', hosts: ['acuityscheduling.com', 'as.me'] },
  { name: 'Square Appointments', hosts: ['squareup.com'], pathPrefix: '/appointments' },
  { name: 'Housecall Pro', hosts: ['housecallpro.com'] },
  { name: 'ServiceTitan', hosts: ['servicetitan.com'] },
  { name: 'Jobber', hosts: ['getjobber.com'] },
  { name: 'Booksy', hosts: ['booksy.com'] },
  { name: 'Vagaro', hosts: ['vagaro.com'] },
  { name: 'Mindbody', hosts: ['mindbodyonline.com', 'mindbody.io'] },
  { name: 'Setmore', hosts: ['setmore.com'] },
  { name: 'SimplyBook', hosts: ['simplybook.me'] },
  { name: 'Schedulicity', hosts: ['schedulicity.com'] },
  { name: 'Zocdoc', hosts: ['zocdoc.com'] },
  { name: 'OpenTable', hosts: ['opentable.com'] },
  { name: 'Resy', hosts: ['resy.com'] },
];

export const CHAT_PROVIDERS: Provider[] = [
  { name: 'Intercom', hosts: ['intercom.io', 'intercomcdn.com'] },
  { name: 'Drift', hosts: ['drift.com', 'driftt.com'] },
  { name: 'Tawk.to', hosts: ['tawk.to'] },
  { name: 'LiveChat', hosts: ['livechatinc.com'] },
  { name: 'Crisp', hosts: ['crisp.chat'] },
  { name: 'Tidio', hosts: ['tidio.co'] },
  { name: 'Podium', hosts: ['podium.com'] },
  { name: 'Birdeye', hosts: ['birdeye.com'] },
  { name: 'HubSpot chat', hosts: ['usemessages.com'] },
  { name: 'Zendesk', hosts: ['zdassets.com', 'zopim.com'] },
  { name: 'Freshchat', hosts: ['freshchat.com'] },
  { name: 'Olark', hosts: ['olark.com'] },
  { name: 'Smith.ai', hosts: ['smith.ai'] },
];

/** Hostname equals the domain or is a subdomain of it ("embed.tawk.to" matches "tawk.to"; "wix.com" never matches "x.com"). */
export function hostMatches(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return h === domain || h.endsWith(`.${domain}`);
}

export function matchProviders(urls: URL[], providers: Provider[]): string[] {
  return providers
    .filter((p) => urls.some((u) => p.hosts.some((d) => hostMatches(u.hostname, d)) && (!p.pathPrefix || u.pathname.startsWith(p.pathPrefix))))
    .map((p) => p.name);
}

/** Platform fingerprints. The generator <meta> is checked first; resource URLs need a host or a distinctive path. */
export const PLATFORMS: { name: string; generator?: RegExp; hosts?: string[]; paths?: string[] }[] = [
  { name: 'Shopify', generator: /shopify/i, hosts: ['cdn.shopify.com', 'myshopify.com'] },
  { name: 'Wix', generator: /\bwix\b/i, hosts: ['wixstatic.com', 'wixsite.com', 'parastorage.com'] },
  { name: 'Squarespace', generator: /squarespace/i, hosts: ['squarespace.com', 'squarespace-cdn.com', 'sqspcdn.com'] },
  { name: 'Webflow', generator: /webflow/i, hosts: ['website-files.com', 'webflow.com'] },
  { name: 'GoDaddy', generator: /godaddy|websitebuilder/i, hosts: ['wsimg.com'] },
  { name: 'Duda', generator: /\bduda\b/i, hosts: ['multiscreensite.com', 'cdn-website.com'] },
  { name: 'Weebly', generator: /weebly/i, hosts: ['weebly.com', 'editmysite.com'] },
  { name: 'Astro', generator: /\bastro\b/i, paths: ['/_astro/'] },
  { name: 'Next.js', generator: /next\.js/i, paths: ['/_next/'] },
  { name: 'WordPress', generator: /wordpress/i, paths: ['/wp-content/', '/wp-includes/', '/wp-json/'] },
];

/** Social and listing profiles, matched on the hostname of an outbound link. `pathPrefix` narrows shared hosts. */
export const SOCIAL_SITES: { name: string; host: string; pathPrefix?: string }[] = [
  { name: 'facebook.com', host: 'facebook.com' },
  { name: 'instagram.com', host: 'instagram.com' },
  { name: 'youtube.com', host: 'youtube.com' },
  { name: 'linkedin.com', host: 'linkedin.com' },
  { name: 'x.com', host: 'x.com' },
  { name: 'twitter.com', host: 'twitter.com' },
  { name: 'tiktok.com', host: 'tiktok.com' },
  { name: 'pinterest.com', host: 'pinterest.com' },
  { name: 'yelp.com', host: 'yelp.com' },
  { name: 'nextdoor.com', host: 'nextdoor.com' },
  { name: 'google business profile', host: 'g.page' },
  { name: 'google maps', host: 'google.com', pathPrefix: '/maps' },
  { name: 'google maps', host: 'maps.google.com' },
];
