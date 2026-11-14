// backend/src/services/research/facts.ts
// Flattens SiteFacts into short, citable statements with stable ids (e.g. "c1-F12").
// The analysis step may only cite these ids, and code verifies every cited id exists, so
// no claim about a competitor can rest on something we did not actually observe.
import type { SiteFacts } from './extractor.js';

export type FactKind =
  | 'title' | 'heading' | 'nav' | 'cta' | 'phone' | 'form' | 'trust' | 'schema' | 'rating'
  | 'booking' | 'chat' | 'platform' | 'social' | 'inventory' | 'size' | 'absence' | 'visibility';

export interface Fact {
  id: string;
  /** Page path the fact came from, or "site" for site-wide facts. */
  page: string;
  kind: FactKind;
  text: string;
}

const list = (items: string[], max = 8) => items.slice(0, max).join(', ');

/** `key` namespaces ids per site: "own", "c1", "c2", "c3". */
export function toFacts(site: SiteFacts, key: string): Fact[] {
  const out: Fact[] = [];
  const add = (page: string, kind: FactKind, text: string) => {
    if (text.trim()) out.push({ id: `${key}-F${out.length + 1}`, page, kind, text });
  };

  if (site.limitedVisibility) {
    add('site', 'visibility', `Limited visibility (${site.limitedReasons.join(', ')}): the site renders with JavaScript or exposes little, so absences below are not reliable.`);
  }
  if (site.platform) add('site', 'platform', `Built on ${site.platform}.`);

  if (site.nav.length) {
    add('site', 'nav', `Main navigation (${site.nav.length} items): ${list(site.nav.map((n) => n.label), 12)}.`);
    for (const n of site.nav.filter((i) => i.children.length > 0)) {
      add('site', 'nav', `Navigation dropdown "${n.label}": ${list(n.children.map((c) => c.label), 10)}.`);
    }
  }

  for (const [role, count] of Object.entries(site.inventory)) {
    if (role !== 'other' && role !== 'legal' && count) add('site', 'inventory', `The site exposes ${count} ${role} page${count === 1 ? '' : 's'}.`);
  }
  if (site.bookingTools.length) add('site', 'booking', `Online booking via ${list(site.bookingTools)}.`);
  if (site.chatTools.length) add('site', 'chat', `Chat widget: ${list(site.chatTools)}.`);
  if (site.social.length) add('site', 'social', `Links to: ${list(site.social, 10)}.`);
  if (site.phones.length) add('site', 'phone', `Phone ${list(site.phones, 3)}${site.hasClickToCall ? ', with click-to-call links' : ', not a click-to-call link'}.`);
  if (site.primaryCta) add('/', 'cta', `Primary homepage call to action: "${site.primaryCta.text}" (${site.primaryCta.kind}, ${site.primaryCta.place}).`);
  if (site.schemaTypes.length) add('site', 'schema', `Structured data types: ${list(site.schemaTypes, 12)}.`);

  for (const p of site.pages) {
    const where = p.path || '/';
    add(where, 'title', `Page title: "${p.title}"${p.metaDescription ? `; description: "${p.metaDescription}"` : ''}.`);
    if (p.h1.length) add(where, 'heading', `H1: ${list(p.h1.map((h) => `"${h}"`), 3)}.`);
    if (p.h2.length) add(where, 'heading', `Sections (H2): ${list(p.h2.map((h) => `"${h}"`), 10)}.`);
    add(where, 'size', `${p.wordCount} words of main content.`);
    for (const c of p.ctas.slice(0, 6)) add(where, 'cta', `Call to action "${c.text}" (${c.kind}, ${c.place}).`);
    for (const f of p.forms) {
      add(where, 'form', `Form with ${f.fieldCount} fields (${list(f.kinds)})${f.hasFileUpload ? ', accepts file uploads' : ''}${f.hasCaptcha ? ', has captcha' : ''}.`);
    }
    for (const t of p.trust) add(where, 'trust', `Trust signal (${t.tag}): "${t.snippet}".`);
    if (p.aggregateRating) add(where, 'rating', `Structured rating ${p.aggregateRating.value}${p.aggregateRating.count ? ` from ${p.aggregateRating.count} reviews` : ''}.`);
  }

  if (!site.limitedVisibility) {
    const trustTags = new Set(site.pages.flatMap((p) => p.trust.map((t) => t.tag)));
    if (site.bookingTools.length === 0) add('site', 'absence', 'No online booking tool was detected on the pages read.');
    if (!site.hasClickToCall) add('site', 'absence', 'No click-to-call phone link was found on the pages read.');
    if (site.schemaTypes.length === 0) add('site', 'absence', 'No structured data (schema.org) was found on the pages read.');
    if (!trustTags.has('reviews') && !trustTags.has('rating')) add('site', 'absence', 'No reviews or ratings were found on the pages read.');
    if (!trustTags.has('free_estimate')) add('site', 'absence', 'No free-estimate or free-quote offer was found on the pages read.');
    if (site.totals.forms === 0) add('site', 'absence', 'No contact or quote form was found on the pages read.');
  }
  if (site.totals.thinPages.length) add('site', 'size', `Thin pages (under 300 words): ${list(site.totals.thinPages, 8)}.`);
  return out;
}
