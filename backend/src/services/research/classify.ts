// backend/src/services/research/classify.ts
// Guesses what a page is for from its URL path and link text. Pure and deterministic.

export type PageRole =
  | 'home' | 'services' | 'service-detail' | 'about' | 'contact' | 'pricing'
  | 'locations' | 'location-detail' | 'projects' | 'reviews' | 'faq'
  | 'blog' | 'blog-post' | 'legal' | 'other';

const RULES: { role: PageRole; test: RegExp }[] = [
  { role: 'legal', test: /privacy|terms|cookie|disclaimer|accessibility|sitemap|policy|licen[cs]e-?agreement/ },
  { role: 'contact', test: /contact|get-?in-?touch|request-?(a-?)?(quote|estimate|service|appointment)|free-?(quote|estimate)|book|schedule|appointment/ },
  { role: 'pricing', test: /pric(e|ing)|rates|cost|financ(e|ing)|packages|plans/ },
  { role: 'reviews', test: /review|testimonial|reputation|what-?(people|customers|clients)-?say/ },
  { role: 'projects', test: /project|portfolio|gallery|our-?work|case-?stud|before-?and-?after|work-?samples/ },
  { role: 'faq', test: /faq|questions|help-?center/ },
  { role: 'about', test: /about|our-?(story|team|company)|who-?we-?are|meet-?(the-?)?(team|us)|team|careers?/ },
  { role: 'blog', test: /^\/?(blog|news|articles?|resources?|insights|guides?|tips|learn)\/?$/ },
  { role: 'blog-post', test: /\/(blog|news|articles?|resources?|insights|guides?|tips|learn|posts?)\/[^/]+|\/20\d\d\/\d\d\// },
  { role: 'locations', test: /^\/?(locations?|service-?areas?|areas?-?(we-?)?serve[d]?|where-?we-?(work|serve)|coverage)\/?$/ },
  { role: 'location-detail', test: /\/(locations?|service-?areas?|areas?-?served|cities|neighborhoods)\/[^/]+|(-in|-near)-[a-z-]+$/ },
  { role: 'services', test: /^\/?(services?|what-?we-?do|solutions|treatments|offerings|products|menu|specialt(y|ies)|practice-?areas)\/?$/ },
  { role: 'service-detail', test: /\/(services?|what-?we-?do|solutions|treatments|offerings|products|specialt(y|ies)|practice-?areas)\/[^/]+/ },
];

/** Classifies a page. `text` is the link's visible label; the path wins when both match. */
export function classifyPage(path: string, text = ''): PageRole {
  const p = path.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/') return 'home';
  for (const { role, test } of RULES) if (test.test(p)) return role;
  const label = text.toLowerCase().trim();
  if (label) {
    if (/^(about|our story|meet|team)/.test(label)) return 'about';
    if (/^(contact|get a quote|free (quote|estimate)|book|schedule)/.test(label)) return 'contact';
    if (/^(services|what we do)$/.test(label)) return 'services';
    if (/^(reviews|testimonials)$/.test(label)) return 'reviews';
    if (/^(blog|news|resources)$/.test(label)) return 'blog';
  }
  return 'other';
}

/** How much each role matters for understanding a competitor, highest first. */
export const SELECTION_PRIORITY: PageRole[] = [
  'services', 'about', 'contact', 'pricing', 'locations', 'service-detail',
  'projects', 'reviews', 'blog', 'faq', 'location-detail',
];
