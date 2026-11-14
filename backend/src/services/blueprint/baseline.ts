// backend/src/services/blueprint/baseline.ts
// Deterministic fallback structure, built only from the visitor's answers. Used when the model
// pass fails or returns something unusable, so a visitor always gets a sensible, priceable
// blueprint. Everything here still goes through the same verifier as model output.
import type { Slots } from '../conversation/slots.js';
import { cleanText, slugify, MAX_DEPTH, MAX_PAGES, type PageNode, type VerifiedStructure } from './verify.js';
import type { PageDraft, StructureOutput } from './types.js';

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function baselineStructure(slots: Slots): StructureOutput {
  const page = (id: string, over: Partial<PageDraft>): PageDraft => ({
    id, parentId: 'home', title: title(id.replace(/-/g, ' ')), slug: id, category: 'core', classification: 'core',
    sku: 'page-standard', purpose: '', why: 'Recommended based on what you told me about your business.', primaryCta: 'Contact us',
    evidence: [], basis: 'intake', ...over,
  });

  const pages: PageDraft[] = [
    page('home', { parentId: null, slug: '', purpose: 'Explain what the business does and send visitors to the main action.', basis: 'reasonable_recommendation' }),
    page('about', { purpose: 'Build trust by showing who is behind the business.', basis: 'reasonable_recommendation' }),
    page('services', { purpose: 'Give an overview of everything the business offers.' }),
    page('projects', { title: 'Our Work', purpose: 'Show proof of past work and results.', basis: 'reasonable_recommendation' }),
    page('contact', { purpose: 'Make it easy to call, request a quote or send a message.', primaryCta: 'Request a quote', basis: 'reasonable_recommendation' }),
  ];
  for (const svc of slots.services.slice(0, 5)) {
    const id = slugify(svc) || 'service';
    if (pages.some((p) => p.id === id)) continue;
    pages.push(page(id, { parentId: 'services', title: title(svc), category: 'service', classification: 'recommended', sku: 'page-service', purpose: `Explain the ${svc} service and how to book it.`, primaryCta: 'Get a quote' }));
  }
  if (slots.serviceArea) {
    pages.push(page('service-area', { title: `Serving ${slots.serviceArea}`, category: 'location', classification: 'recommended', sku: 'page-location', purpose: `Show the business serves ${slots.serviceArea}.` }));
  }

  const goal = slots.primaryGoal;
  const rec = (sku: string, recommended: boolean, reason: string) => ({ sku, recommended, reason, evidence: [] as string[] });
  return {
    websiteTypeSku: goal === 'sales' ? 'site-ecommerce' : 'site-starter',
    audience: `People in ${slots.serviceArea ?? 'your area'} looking for ${slots.industry ?? 'what you offer'}.`,
    strategy: 'A fast, clear website that shows what you do, proves you are trustworthy, and makes the next step obvious.',
    pages,
    articles: [],
    addons: [
      rec('addon-managed-forms', true, 'Delivers contact and quote requests reliably.'),
      rec('addon-booking', goal === 'bookings', goal === 'bookings' ? 'Your main goal is bookings.' : 'Only needed if customers book appointments.'),
      rec('addon-quote-system', goal === 'quotes', goal === 'quotes' ? 'Your main goal is quote requests.' : 'Only needed if you quote jobs online.'),
      rec('addon-payments', goal === 'sales', goal === 'sales' ? 'You want to sell online.' : 'Only needed if you take online payments.'),
    ],
  };
}

const stems = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)))];

/**
 * The visitor told us which services they offer; a model that merges them all into one Services
 * page makes a thinner plan than the visitor asked for. Any stated service without a matching page
 * gets one, as a "recommended" child of Services (the visitor can switch it off). Deterministic,
 * so the result does not depend on how generous the model felt.
 */
export function addMissingServicePages(draft: VerifiedStructure, services: string[], goal?: string): VerifiedStructure {
  const pages: PageNode[] = draft.pages.map((p) => ({ ...p }));
  const repairs = [...draft.repairs];
  const parent = pages.find((p) => p.id === 'services') ?? pages.find((p) => p.parentId === 'home' && /^services?$|what we do/i.test(p.title)) ?? pages.find((p) => p.id === 'home')!;
  const depth = (p: PageNode): number => { let d = 0; for (let cur: PageNode | undefined = p; cur && cur.parentId !== null && d < 10; cur = pages.find((q) => q.id === cur!.parentId)) d++; return d; };
  if (depth(parent) + 1 > MAX_DEPTH) return draft;

  for (const raw of services.slice(0, 5)) {
    if (pages.length >= MAX_PAGES) break;
    const name = cleanText(raw, 60, [], true);
    if (!name) continue;
    const want = stems(name);
    // Covered when enough of the service's key words appear in an existing service page: all of two,
    // at least two of three or more. (One shared word like "repair" must not count as a match.)
    const need = want.length <= 2 ? want.length : Math.ceil(want.length / 2);
    const covered = pages.some((p) => p.category === 'service' && stems(`${p.title} ${p.slug}`).filter((x) => want.includes(x)).length >= need);
    if (covered || want.length === 0) continue;
    const title = name.replace(/\b\w/g, (c) => c.toUpperCase());
    let id = slugify(title) || 'service';
    for (let n = 2; pages.some((p) => p.id === id); n++) id = `${slugify(title, 36)}-${n}`;
    let slug = slugify(title) || id;
    for (let n = 2; pages.some((p) => p.parentId === parent.id && p.slug === slug); n++) slug = `${slugify(title, 52)}-${n}`;
    pages.push({
      id, parentId: parent.id, title, slug, category: 'service', classification: 'recommended', sku: 'page-service',
      purpose: `Explain the ${name.toLowerCase()} service and how to get it.`,
      why: 'You told me you offer this, and customers search for it separately, so it deserves its own page.',
      primaryCta: goal === 'calls' ? 'Call now' : 'Get a quote', evidence: [], basis: 'intake',
    });
    repairs.push(`${id}: added service page for a service the visitor listed`);
  }
  return { ...draft, pages, repairs };
}
