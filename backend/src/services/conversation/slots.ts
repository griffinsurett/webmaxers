// backend/src/services/conversation/slots.ts
// What the agent needs to learn about the visitor, and how model output is merged in safely.
import { z } from 'zod';
import { looksUnsafe, normalizeText } from '../security/inputGuard.js';

export const GOALS = ['calls', 'quotes', 'bookings', 'sales', 'leads', 'other'] as const;
export type Goal = (typeof GOALS)[number];

export interface Slots {
  businessName?: string;
  industry?: string;
  services: string[];
  serviceArea?: string;
  primaryGoal?: Goal;
  existingTools: string[];
  mustHaves: string[];
  /** Verified (syntax + DNS) addresses only. Never set from model output. */
  ownUrl?: string;
  competitorUrls: string[];
  /** Visitor has no competitors in mind: the research phase will discover some. */
  competitorsSkipped: boolean;
  /** Visitor has no website of their own. */
  noWebsite: boolean;
}

export const emptySlots = (): Slots => ({
  services: [],
  existingTools: [],
  mustHaves: [],
  competitorUrls: [],
  competitorsSkipped: false,
  noWebsite: false,
});

export const REQUIRED_SLOTS = ['businessName', 'industry', 'services', 'serviceArea', 'primaryGoal'] as const;
export type RequiredSlot = (typeof REQUIRED_SLOTS)[number];

export function missingRequired(slots: Slots): RequiredSlot[] {
  return REQUIRED_SLOTS.filter((key) => {
    const value = slots[key];
    return Array.isArray(value) ? value.length === 0 : !value;
  });
}

/** Strict shape the model must return (every field present; null = "not mentioned"). */
export const modelSlotsSchema = z.object({
  businessName: z.string().max(120).nullable(),
  industry: z.string().max(120).nullable(),
  services: z.array(z.string().max(120)).max(8),
  serviceArea: z.string().max(120).nullable(),
  primaryGoal: z.enum(GOALS).nullable(),
  existingTools: z.array(z.string().max(80)).max(6),
  mustHaves: z.array(z.string().max(120)).max(8),
});
export type ModelSlots = z.infer<typeof modelSlotsSchema>;

/** Model strings are untrusted: normalized, length-capped, and dropped if they carry markup/injection. */
function cleanText(value: string | null | undefined, max = 120): string | undefined {
  if (!value) return undefined;
  const text = normalizeText(value).slice(0, max);
  if (!text || text === 'null' || text === 'unknown' || looksUnsafe(text) || /\[(?:URL\d+|INVALID_URL|EMAIL)\]/.test(text)) {
    return undefined;
  }
  return text;
}

function mergeList(existing: string[], incoming: string[], cap: number): string[] {
  const out = [...existing];
  for (const item of incoming) {
    const clean = cleanText(item);
    if (clean && !out.some((o) => o.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }
  return out.slice(0, cap);
}

const GENERIC_WORDS = new Set(['service', 'services', 'company', 'business', 'general', 'work', 'solutions', 'solution', 'and', 'the', 'our']);
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * A "service" that only restates the industry ("plumbing", "General Plumbing" for a plumbing
 * business) is not a service: it would become a redundant page and varies from run to run.
 */
export function isIndustryRestatement(service: string, industry: string | undefined): boolean {
  if (!industry) return false;
  const inIndustry = new Set(words(industry).filter((w) => !GENERIC_WORDS.has(w)));
  const rest = words(service).filter((w) => !GENERIC_WORDS.has(w));
  return inIndustry.size > 0 && rest.length > 0 && rest.every((w) => inIndustry.has(w));
}

/**
 * Drops industry restatements, but never empties the list: a visitor who only says "I'm a plumber"
 * still has to count as having named a service, or the required slot could never be filled.
 */
export function withoutRestatements(services: string[], industry: string | undefined): string[] {
  const real = services.filter((x) => !isIndustryRestatement(x, industry));
  return real.length > 0 ? real : services;
}

/** Merges model-extracted slots into the current ones. Never touches URL or skip flags. */
export function mergeModelSlots(current: Slots, extracted: ModelSlots): Slots {
  const industry = cleanText(extracted.industry) ?? current.industry;
  return {
    ...current,
    businessName: cleanText(extracted.businessName) ?? current.businessName,
    industry,
    serviceArea: cleanText(extracted.serviceArea) ?? current.serviceArea,
    primaryGoal: extracted.primaryGoal ?? current.primaryGoal,
    services: withoutRestatements(mergeList(current.services, extracted.services, 8), industry),
    existingTools: mergeList(current.existingTools, extracted.existingTools, 6),
    mustHaves: mergeList(current.mustHaves, extracted.mustHaves, 8),
  };
}
