// backend/src/services/blueprint/types.ts
// The blueprint data model (5a). Two shapes live here:
//  - the model's DRAFTS (zod schemas below): what the LLM may propose. SKUs and ids only,
//    never prices.
//  - the final Blueprint: drafts after code verification, with content written and every
//    price attached by the pricing engine.
import { z } from 'zod';
import type { Fact } from '../research/facts.js';
import type { PriceBreakdown } from '../../types/index.js';

export const PAGE_CATEGORIES = ['core', 'service', 'location', 'resource', 'legal'] as const;
export type PageCategory = (typeof PAGE_CATEGORIES)[number];
export type Classification = 'core' | 'recommended' | 'future';
export type Basis = 'evidence' | 'intake' | 'reasonable_recommendation';
export type Priority = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Model output schemas (strict structured output: every field present, nulls where optional)
// ---------------------------------------------------------------------------

const ids = z.array(z.string().max(20)).max(6);

export const pageDraftSchema = z.object({
  id: z.string().max(40),
  parentId: z.string().max(40).nullable(),
  title: z.string().max(60),
  slug: z.string().max(60),
  category: z.enum(PAGE_CATEGORIES),
  classification: z.enum(['core', 'recommended', 'future']),
  sku: z.string().max(40),
  purpose: z.string().max(220),
  why: z.string().max(260),
  primaryCta: z.string().max(60),
  evidence: ids,
  basis: z.enum(['evidence', 'intake', 'reasonable_recommendation']),
});

export const articleDraftSchema = z.object({
  id: z.string().max(40),
  title: z.string().max(100),
  customerQuestion: z.string().max(180),
  relatedPageId: z.string().max(40),
  conversionPath: z.string().max(140),
  priority: z.enum(['high', 'medium', 'low']),
  why: z.string().max(200),
});

export const addonDraftSchema = z.object({
  sku: z.string().max(40),
  recommended: z.boolean(),
  reason: z.string().max(240),
  evidence: ids,
});

/** Pass 1: structure. */
export const structureSchema = z.object({
  websiteTypeSku: z.string().max(40),
  audience: z.string().max(200),
  strategy: z.string().max(400),
  pages: z.array(pageDraftSchema).max(35),
  articles: z.array(articleDraftSchema).max(12),
  addons: z.array(addonDraftSchema).max(14),
});
export type StructureOutput = z.infer<typeof structureSchema>;
export type PageDraft = z.infer<typeof pageDraftSchema>;

/** Pass 2: content for a batch of pages. */
export const contentSchema = z.object({
  pages: z.array(z.object({
    id: z.string().max(40),
    sections: z.array(z.object({
      heading: z.string().max(80),
      purpose: z.string().max(180),
      subsections: z.array(z.object({ heading: z.string().max(80), content: z.string().max(260) })).max(5),
    })).max(7),
  })).max(6),
});
export type ContentOutput = z.infer<typeof contentSchema>;

export interface BlueprintLlm {
  /** `signal` aborts the in-flight request when the run is cancelled (timeout). */
  structure(prompt: { system: string; user: string }, signal?: AbortSignal): Promise<StructureOutput>;
  content(prompt: { system: string; user: string }, signal?: AbortSignal): Promise<ContentOutput>;
}

// ---------------------------------------------------------------------------
// Final blueprint
// ---------------------------------------------------------------------------

export interface ContentSection {
  heading: string;
  purpose: string;
  subsections: { heading: string; content: string }[];
}

export interface BlueprintPage {
  id: string;
  /** null only for the home page. */
  parentId: string | null;
  title: string;
  /** This page's own URL segment ("" for home). */
  slug: string;
  /** Full path built from the parent chain, e.g. "/services/drain-cleaning". */
  path: string;
  category: PageCategory;
  classification: Classification;
  sku: string;
  purpose: string;
  whyRecommended: string;
  primaryCta: string;
  sections: ContentSection[];
  contentStatus: 'written' | 'outline_only';
  evidence: string[];
  basis: Basis;
  included: boolean;
  /** 0 when covered by the website type's base price. */
  estimatedCost: number;
}

export interface BlueprintArticle {
  id: string;
  title: string;
  customerQuestion: string;
  relatedPageId: string;
  conversionPath: string;
  priority: Priority;
  why: string;
  included: boolean;
  estimatedCost: number;
}

export interface BlueprintAddon {
  sku: string;
  name: string;
  category: string;
  purpose: string;
  setupCost: number;
  monthlyCost: number;
  recommended: boolean;
  reason: string;
  evidence: string[];
  included: boolean;
}

export interface BlueprintSummary {
  businessName: string;
  industry: string;
  serviceArea: string;
  existingUrl?: string;
  competitorUrl?: string;
  primaryGoal: string;
  primaryAudience: string;
  recommendedStrategy: string;
}

export interface Blueprint {
  version: 1;
  summary: BlueprintSummary;
  websiteTypeSku: string;
  pages: BlueprintPage[];
  articles: BlueprintArticle[];
  addons: BlueprintAddon[];
  pricing: PriceBreakdown;
  /** Research facts cited by pages and add-ons, so every recommendation can be traced. */
  facts: Fact[];
  notices: string[];
  status: 'complete' | 'partial';
  generatedAt: string;
}
