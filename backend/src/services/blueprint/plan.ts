// backend/src/services/blueprint/plan.ts
// The deterministic part of blueprint planning. Everything that CAN be decided by rules is
// decided here, from the visitor's answers and the research evidence, so two runs on the same
// input give the same plan. The model keeps what needs judgement and language: extra pages with
// evidence, the hierarchy of extras, article ideas, and all the wording (purposes, reasons, CTAs).
//
//  - core pages: from an industry template (kb/blueprint-rules.json)
//  - a page for every service the visitor named, and for every service area they named
//  - website type
//  - which add-ons are recommended: goal/industry/evidence conditions, dependencies
//    (notifications need a form, quote or booking tool), exclusive groups (one chat tool),
//    and a cap
// The rules file is demo data, like the prices: Webmaxxers can replace it without code changes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Slots } from '../conversation/slots.js';
import type { ResearchRecord } from '../research/job.js';
import type { CatalogItem } from '../../types/index.js';
import { addMissingServicePages } from './baseline.js';
import { MAX_LOCATION_PAGES, MAX_PAGES, slugify, type AddonNode, type PageNode, type VerifiedStructure } from './verify.js';

// ---------------------------------------------------------------------------
// Rules file
// ---------------------------------------------------------------------------

const condition = z.object({
  goal: z.array(z.string()).optional(),
  industry: z.array(z.string()).optional(),
  signal: z.array(z.string()).optional(),
  tool: z.array(z.string()).optional(),
}).strict();

const rulesSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  maxRecommendedAddons: z.number().int().min(0).max(12),
  templates: z.array(z.object({
    id: z.string(),
    match: z.array(z.string()),
    core: z.array(z.object({
      id: z.string().regex(/^[a-z0-9-]+$/), title: z.string(), aliases: z.array(z.string()), purpose: z.string(), cta: z.string(),
    })).length(3),
  })).min(1),
  exclusiveGroups: z.array(z.array(z.string())),
  addons: z.array(z.object({
    sku: z.string(), priority: z.number(),
    requires: z.array(z.string()).optional(),
    recommendWhen: z.array(condition),
    skipWhenTool: z.array(z.string()).optional(),
    whyYes: z.string(), whyNo: z.string(),
  })),
});
export type BlueprintRules = z.infer<typeof rulesSchema>;
export type Template = BlueprintRules['templates'][number];
type AddonRule = BlueprintRules['addons'][number];
type Condition = z.infer<typeof condition>;

const RULES_PATH = fileURLToPath(new URL('../../../kb/blueprint-rules.json', import.meta.url));
let cached: BlueprintRules | null = null;

/** Loads and validates the rules once. A broken rules file fails loudly at first use, never silently. */
export function loadRules(): BlueprintRules {
  cached ??= rulesSchema.parse(JSON.parse(readFileSync(RULES_PATH, 'utf8')));
  return cached;
}

// ---------------------------------------------------------------------------
// Industry template, service areas, research signals
// ---------------------------------------------------------------------------

export function pickTemplate(rules: BlueprintRules, industry: string | undefined, services: string[]): Template {
  const text = `${industry ?? ''} ${services.join(' ')}`.toLowerCase();
  const generic = rules.templates.find((t) => t.id === 'generic') ?? rules.templates[rules.templates.length - 1];
  // Industry wording wins over service wording ("pool cleaning" must not read as a cleaner).
  const byIndustry = rules.templates.find((t) => t.match.some((k) => (industry ?? '').toLowerCase().includes(k)));
  return byIndustry ?? rules.templates.find((t) => t.match.some((k) => text.includes(k))) ?? generic;
}

const US_STATES = new Set(
  ('alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ' +
    'new-hampshire new-jersey new-mexico new-york north-carolina north-dakota ohio oklahoma oregon pennsylvania rhode-island south-carolina south-dakota tennessee texas utah vermont virginia washington west-virginia wisconsin wyoming ' +
    'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc').split(' '),
);

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** "Austin and Round Rock, Texas" -> ["Austin", "Round Rock"]. States and filler words are dropped. */
export function areaList(serviceArea: string | undefined): string[] {
  const raw = (serviceArea ?? '').trim();
  if (!raw) return [];
  const parts = raw
    .replace(/\b(?:and|plus)\b|&/gi, ',')
    .split(/[,;/]+/)
    .map((p) => p.replace(/\b(?:greater|area|areas|metro|metropolitan|surrounding|county|region|the|around|near|city of)\b/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const places = parts.filter((p) => !US_STATES.has(p.toLowerCase().replace(/\s+/g, '-')));
  const out = [...new Set((places.length ? places : parts).map((p) => titleCase(p.toLowerCase())))];
  return out.filter((p) => p.length >= 2 && p.length <= 40 && /[a-z]/i.test(p)).slice(0, 6);
}

export interface Signals { compBooking: string[]; compNoBooking: string[]; compChat: string[]; compReviews: string[] }

/** Evidence from competitor sites (fact ids), used by the add-on rules. */
export function deriveSignals(research: ResearchRecord | null): Signals {
  const out: Signals = { compBooking: [], compNoBooking: [], compChat: [], compReviews: [] };
  let readable = 0;
  const lacksBooking: string[] = [];
  for (const site of research?.sites ?? []) {
    if (site.role !== 'competitor' || site.status === 'failed') continue;
    // A site we could barely see (JavaScript-rendered) produces no absence facts, so it counts as unknown, not as "lacks it".
    if (site.status === 'read') readable++;
    const absent = site.facts.find((f) => f.kind === 'absence' && /No online booking tool/i.test(f.text));
    if (site.status === 'read' && absent) lacksBooking.push(absent.id);
    for (const f of site.facts) {
      if (f.kind === 'booking') out.compBooking.push(f.id);
      else if (f.kind === 'chat') out.compChat.push(f.id);
      else if (f.kind === 'rating' || (f.kind === 'trust' && /\((?:reviews|rating)\)/i.test(f.text))) out.compReviews.push(f.id);
    }
  }
  // "Competitors lack online booking": at least two read sites, and none of the read sites offer it.
  if (lacksBooking.length >= 2 && out.compBooking.length === 0 && lacksBooking.length >= readable / 2) out.compNoBooking = lacksBooking;
  for (const k of Object.keys(out) as (keyof Signals)[]) out[k] = out[k].slice(0, 3);
  return out;
}

// ---------------------------------------------------------------------------
// Add-on decisions
// ---------------------------------------------------------------------------

export interface AddonDecision { sku: string; recommended: boolean; reason: string; evidence: string[] }

interface AddonContext { goal?: string; templateId: string; tools: string[]; signals: Signals }

function matchCondition(c: Condition, ctx: AddonContext): { ok: boolean; evidence: string[] } {
  if (c.goal && !(ctx.goal && c.goal.includes(ctx.goal))) return { ok: false, evidence: [] };
  if (c.industry && !c.industry.includes(ctx.templateId)) return { ok: false, evidence: [] };
  if (c.tool && !ctx.tools.some((t) => c.tool!.some((k) => t.toLowerCase().includes(k)))) return { ok: false, evidence: [] };
  let evidence: string[] = [];
  if (c.signal) {
    const hit = c.signal.filter((s) => (ctx.signals as unknown as Record<string, string[]>)[s]?.length);
    if (hit.length === 0) return { ok: false, evidence: [] };
    evidence = hit.flatMap((s) => (ctx.signals as unknown as Record<string, string[]>)[s]);
  }
  return { ok: true, evidence };
}

/**
 * Applies dependencies (a "requires" list is satisfied by ANY of its members), exclusive groups
 * (first member of a group wins) and the cap (lowest priority number wins) to a set of SKUs.
 * Shared by the rule engine and by the safety net that re-checks model-influenced results.
 */
export function settleAddons(skus: Set<string>, rules: BlueprintRules): Set<string> {
  const byRule = new Map(rules.addons.map((r) => [r.sku, r]));
  const set = new Set(skus);
  const dropUnmet = () => {
    for (let changed = true; changed;) {
      changed = false;
      for (const sku of [...set]) {
        const need = byRule.get(sku)?.requires;
        if (need && !need.some((r) => set.has(r))) { set.delete(sku); changed = true; }
      }
    }
  };
  dropUnmet();
  for (const group of rules.exclusiveGroups) {
    const present = group.filter((s) => set.has(s));
    for (const loser of present.slice(1)) set.delete(loser);
  }
  dropUnmet();
  if (set.size > rules.maxRecommendedAddons) {
    const ranked = [...set].sort((a, b) => (byRule.get(a)?.priority ?? 99) - (byRule.get(b)?.priority ?? 99));
    for (const sku of ranked.slice(rules.maxRecommendedAddons)) set.delete(sku);
    dropUnmet();
  }
  return set;
}

export function decideAddons(rules: BlueprintRules, catalog: CatalogItem[], ctx: AddonContext): AddonDecision[] {
  const candidates = new Map<string, string[]>();
  for (const rule of rules.addons) {
    if (rule.skipWhenTool && ctx.tools.some((t) => rule.skipWhenTool!.some((k) => t.toLowerCase().includes(k)))) continue;
    for (const c of rule.recommendWhen) {
      const m = matchCondition(c, ctx);
      if (m.ok) { candidates.set(rule.sku, m.evidence); break; }
    }
  }
  const settled = settleAddons(new Set(candidates.keys()), rules);
  const byRule = new Map(rules.addons.map((r) => [r.sku, r]));
  return catalog.filter((c) => c.kind === 'addon').map((item) => {
    const rule = byRule.get(item.sku);
    const recommended = settled.has(item.sku);
    return {
      sku: item.sku,
      recommended,
      reason: rule ? (recommended ? rule.whyYes : rule.whyNo) : (item.description || 'Not needed based on what you told me.'),
      evidence: recommended ? (candidates.get(item.sku) ?? []) : [],
    };
  });
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface Plan {
  template: Template;
  areas: string[];
  services: string[];
  addons: AddonDecision[];
  websiteTypeSku: string;
}

export function buildPlan(slots: Slots, research: ResearchRecord | null, catalog: CatalogItem[], rules = loadRules()): Plan {
  const template = pickTemplate(rules, slots.industry, slots.services);
  const addons = decideAddons(rules, catalog, {
    goal: slots.primaryGoal, templateId: template.id, tools: slots.existingTools, signals: deriveSignals(research),
  });
  const hasEcommerce = catalog.some((c) => c.sku === 'site-ecommerce');
  const sells = slots.primaryGoal === 'sales' || template.id === 'retail';
  // Start from the Starter type; the pricing engine adopts a cheaper type of the same family on its own.
  return {
    template, areas: areaList(slots.serviceArea), services: slots.services.slice(0, 5), addons,
    websiteTypeSku: sells && hasEcommerce ? 'site-ecommerce' : 'site-starter',
  };
}

// ---------------------------------------------------------------------------
// Enforcing the plan on a verified draft
// ---------------------------------------------------------------------------

const stems = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)))];
const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));


export function enforcePlan(input: VerifiedStructure, plan: Plan, slots: Slots, rules = loadRules()): VerifiedStructure {
  let draft: VerifiedStructure = { ...input, pages: input.pages.map((p) => ({ ...p })), addons: input.addons.map((a) => ({ ...a, evidence: [...a.evidence] })), repairs: [...input.repairs] };
  const note = (s: string) => draft.repairs.push(s);

  // ---- core pages from the industry template ----
  const claimed = new Set<string>(['home', 'contact']);
  const coreIds = new Set<string>(['home', 'contact']);
  for (const tpl of plan.template.core) {
    const aliasStems = stems(`${tpl.title} ${tpl.aliases.join(' ')}`);
    const found = draft.pages.find((p) => !claimed.has(p.id) && p.parentId === 'home' && p.category !== 'location' && p.category !== 'legal' && (p.id === tpl.id || overlaps(stems(`${p.title} ${p.slug}`), aliasStems)));
    if (found) {
      claimed.add(found.id); coreIds.add(found.id);
      if (found.classification !== 'core') note(`${found.id}: core page from template`);
      found.classification = 'core'; found.category = 'core';
      if (found.sku !== 'page-advanced') found.sku = 'page-standard';
    } else {
      let id = tpl.id;
      for (let n = 2; draft.pages.some((p) => p.id === id); n++) id = `${tpl.id}-${n}`;
      draft.pages.push({
        id, parentId: 'home', title: tpl.title, slug: tpl.id, category: 'core', classification: 'core', sku: 'page-standard',
        purpose: tpl.purpose, why: 'A core page for this type of business.', primaryCta: tpl.cta, evidence: [], basis: 'reasonable_recommendation',
      });
      claimed.add(id); coreIds.add(id);
      note(`${id}: added core page from template`);
    }
  }
  for (const p of draft.pages) if (p.classification === 'core' && !coreIds.has(p.id)) { p.classification = 'recommended'; note(`${p.id}: demoted (not a template core page)`); }
  draft.pages.forEach((p) => { if (coreIds.has(p.id)) p.classification = 'core'; });

  // ---- a page per stated service ----
  draft = addMissingServicePages(draft, plan.services, slots.primaryGoal);

  // ---- a page per stated service area ----
  const industryLabel = titleCase((slots.industry ?? '').trim());
  for (const area of plan.areas) {
    if (draft.pages.length >= MAX_PAGES || draft.pages.filter((p) => p.category === 'location').length >= MAX_LOCATION_PAGES) break;
    const want = stems(area);
    if (want.length === 0) continue;
    const exists = draft.pages.some((p) => p.category === 'location' && want.every((w) => stems(`${p.title} ${p.slug}`).includes(w)));
    if (exists) continue;
    let id = slugify(area) || 'area';
    for (let n = 2; draft.pages.some((p) => p.id === id); n++) id = `${slugify(area, 36)}-${n}`;
    let slug = id;
    for (let n = 2; draft.pages.some((p) => p.parentId === 'home' && p.slug === slug); n++) slug = `${id}-${n}`;
    draft.pages.push({
      id, parentId: 'home', title: industryLabel ? `${industryLabel} in ${area}` : `Serving ${area}`, slug, category: 'location',
      classification: 'recommended', sku: 'page-location', purpose: `Show customers in ${area} that you serve them, with local proof.`,
      why: `You told me you serve ${area}, and people search for local help by place name.`, primaryCta: 'Get in touch', evidence: [], basis: 'intake',
    });
    note(`${id}: added location page for a stated service area`);
  }

  // ---- the model's extras: offered as future ideas, never part of the default plan ----
  const serviceStems = plan.services.map((s) => stems(s));
  const areaStems = plan.areas.map((a) => stems(a));
  for (const p of draft.pages) {
    if (coreIds.has(p.id)) continue;
    const text = stems(`${p.title} ${p.slug}`);
    const statedService = p.category === 'service' && serviceStems.some((s) => s.length > 0 && overlaps(s, text));
    const statedArea = p.category === 'location' && areaStems.some((a) => a.length > 0 && a.every((w) => text.includes(w)));
    if (statedArea) {
      // Same wording every run: "<Industry> in <Area>" at /<area>.
      const area = plan.areas.find((a) => stems(a).every((w) => text.includes(w)))!;
      const slug = slugify(area);
      if (slug && !draft.pages.some((q) => q !== p && q.parentId === p.parentId && q.slug === slug)) p.slug = slug;
      p.title = industryLabel ? `${industryLabel} in ${area}` : `Serving ${area}`;
    }
    if (statedService || statedArea) {
      // The visitor named it, so it is part of the plan (they can still switch it off).
      if (p.classification === 'future') { p.classification = 'recommended'; note(`${p.id}: promoted, the visitor named it`); }
      continue;
    }
    if (p.classification === 'future') continue;
    if (p.category === 'location') { p.classification = 'future'; note(`${p.id}: location not named by the visitor, kept as future`); continue; }
    // Whatever else the model suggests stays on the list as a "future" idea (with its evidence) that the visitor can switch
    // on. The default plan is therefore decided by rules alone, and cannot change with the model's mood.
    p.classification = 'future';
    note(`${p.id}: model-suggested extra kept as a future idea`);
  }

  // ---- add-ons: rules decide, the model words the reason (and may add one evidenced exception) ----
  const byModel = new Map(draft.addons.map((a) => [a.sku, a]));
  const finalRec = new Set(plan.addons.filter((a) => a.recommended).map((a) => a.sku));
  let exceptions = 0;
  const addons: AddonNode[] = plan.addons.map((d) => {
    const m = byModel.get(d.sku);
    if (m && m.recommended === d.recommended && m.reason) return { sku: d.sku, recommended: d.recommended, reason: m.reason, evidence: m.evidence.length ? m.evidence : d.evidence };
    if (m && m.recommended && !d.recommended && m.evidence.length > 0 && exceptions < 1) {
      const trial = new Set(finalRec); trial.add(d.sku);
      if (settleAddons(trial, rules).has(d.sku) && [...trial].every((s) => settleAddons(trial, rules).has(s))) {
        exceptions++; finalRec.add(d.sku); note(`${d.sku}: model exception accepted (evidence-backed)`);
        return { sku: d.sku, recommended: true, reason: m.reason, evidence: m.evidence };
      }
    }
    return { sku: d.sku, recommended: d.recommended, reason: d.reason, evidence: d.evidence };
  });
  draft.addons = addons;
  return enforceAddonConsistency(draft, rules);
}

/**
 * Safety net: whatever produced the add-on flags, dependencies, exclusive groups and the cap
 * hold on the final list. A violator becomes "not recommended" with its rule's own wording.
 */
export function enforceAddonConsistency(draft: VerifiedStructure, rules = loadRules()): VerifiedStructure {
  const recommended = new Set(draft.addons.filter((a) => a.recommended).map((a) => a.sku));
  const settled = settleAddons(recommended, rules);
  if (settled.size === recommended.size) return draft;
  const byRule = new Map(rules.addons.map((r) => [r.sku, r]));
  return {
    ...draft,
    addons: draft.addons.map((a) => (a.recommended && !settled.has(a.sku) ? { ...a, recommended: false, reason: byRule.get(a.sku)?.whyNo ?? a.reason, evidence: [] } : a)),
    repairs: [...draft.repairs, `add-ons made consistent: ${[...recommended].filter((s) => !settled.has(s)).join(', ')}`],
  };
}

export type { PageNode, AddonRule };
