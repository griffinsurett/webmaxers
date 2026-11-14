// src/components/BlueprintAgent/wire.ts
// The exact shapes the backend sends over the wire (mirrors backend/src). These are the SERVER's
// types; the UI's own display types live in types.ts and are bridged by the adapter (phase 6b).
// Keep in sync with backend/src/routes/*.ts and backend/src/services/blueprint/types.ts.

export const STAGES = ['greet', 'intake', 'competitors', 'research', 'blueprint', 'refine', 'close'] as const;
export type Stage = (typeof STAGES)[number];

// ---------------------------------------------------------------------------
// Blueprint
// ---------------------------------------------------------------------------

export type WireClassification = 'core' | 'recommended' | 'future';
export type WirePageCategory = 'core' | 'service' | 'location' | 'resource' | 'legal';

export interface WireContentSection {
  heading: string;
  purpose: string;
  subsections: { heading: string; content: string }[];
}

export interface WirePage {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  path: string;
  category: WirePageCategory;
  classification: WireClassification;
  sku: string;
  purpose: string;
  whyRecommended: string;
  primaryCta: string;
  sections: WireContentSection[];
  contentStatus: 'written' | 'outline_only';
  evidence: string[];
  basis: 'evidence' | 'intake' | 'reasonable_recommendation';
  included: boolean;
  /** 0 when covered by the website type's base price. */
  estimatedCost: number;
}

export interface WireArticle {
  id: string;
  title: string;
  customerQuestion: string;
  relatedPageId: string;
  conversionPath: string;
  priority: 'high' | 'medium' | 'low';
  why: string;
  included: boolean;
  estimatedCost: number;
}

export interface WireAddon {
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

export interface WirePriceLine {
  id: string;
  sku: string;
  title: string;
  amount: number;
  monthly: number;
  note?: string;
}

export interface WirePriceBreakdown {
  catalogVersion: string;
  websiteType: { sku: string; name: string; basePrice: number; includedPages: number };
  pagesSelected: number;
  pagesCoveredByBase: WirePriceLine[];
  extraPages: WirePriceLine[];
  content: WirePriceLine[];
  addons: WirePriceLine[];
  totals: {
    base: number;
    extraPages: number;
    content: number;
    addonSetup: number;
    initialInvestment: number;
    monthly: number;
  };
  cheaperWebsiteType?: { sku: string; name: string; initialInvestment: number; saves: number };
}

export interface WireFact {
  id: string;
  page: string;
  kind: string;
  text: string;
}

export interface WireBlueprint {
  version: 1;
  summary: {
    businessName: string;
    industry: string;
    serviceArea: string;
    existingUrl?: string;
    competitorUrl?: string;
    primaryGoal: string;
    primaryAudience: string;
    recommendedStrategy: string;
  };
  websiteTypeSku: string;
  pages: WirePage[];
  articles: WireArticle[];
  addons: WireAddon[];
  pricing: WirePriceBreakdown;
  facts: WireFact[];
  notices: string[];
  status: 'complete' | 'partial';
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface WireSlots {
  businessName: string | null;
  industry: string | null;
  services: string[];
  serviceArea: string | null;
  primaryGoal: string | null;
  ownUrl: string | null;
  competitorUrls: string[];
  noWebsite: boolean;
}

export interface ChatTurn {
  sessionId: string;
  reply: string;
  quickReplies: string[];
  notices: string[];
  /** True once the visitor has been locked out for repeated unsafe messages. */
  locked: boolean;
  stage: Stage;
  progress: { required: number; filled: number };
  slots: WireSlots;
  /** Present only in the refine stage, when a message changed (or re-read) the blueprint. */
  blueprint: WireBlueprint | null;
}

/** What GET /api/session/:id returns: everything needed to resume after a page refresh. */
export interface SessionSnapshot {
  sessionId: string;
  stage: Stage;
  progress: { required: number; filled: number };
  slots: WireSlots;
  locked: boolean;
  quickReplies: string[];
  messages: { role: 'user' | 'assistant'; content: string }[];
  research: WireResearch | null;
  blueprint: WireBlueprint | null;
}

// ---------------------------------------------------------------------------
// Research (as sent to the browser: no raw facts)
// ---------------------------------------------------------------------------

export type WireSupport = 'evidenced' | 'inferred' | string;

export interface WireClaim { point: string; why: string; evidence: string[]; support: WireSupport }
export interface WirePatternClaim extends WireClaim { appearsIn: string[] }
export interface WireVerdict { action: 'keep' | 'improve' | 'consolidate' | 'add'; target: string; reason: string; evidence: string[]; support: WireSupport }

export interface WireCompetitorFindings {
  key: string;
  name: string;
  host: string;
  whatWorks: WireClaim[];
  gaps: WireClaim[];
  limitedVisibility: boolean;
  thin: boolean;
}

export interface WireSite {
  key: string;
  role: 'own' | 'competitor';
  name: string;
  host: string;
  url: string;
  source: 'visitor' | 'discovered';
  status: 'read' | 'limited' | 'failed';
  pagesRead: number;
  note?: string;
}

export interface WireResearch {
  status: 'complete' | 'partial' | 'failed';
  notices: string[];
  sites: WireSite[];
  findings: {
    competitors: WireCompetitorFindings[];
    patterns: WirePatternClaim[];
    ownSite: { verdicts: WireVerdict[]; limitedVisibility: boolean } | null;
    opportunities: WireClaim[];
  } | null;
}

// ---------------------------------------------------------------------------
// Streaming progress events
// ---------------------------------------------------------------------------

export type ResearchProgress =
  | { type: 'step'; step: 'discovering' | 'reading' | 'analyzing'; message: string }
  | { type: 'competitors'; items: { name: string; host: string; source: 'visitor' | 'discovered'; reason?: string }[] }
  | { type: 'site'; host: string; role: 'own' | 'competitor'; status: 'reading' | 'done' | 'failed'; pages?: number; note?: string };

export type BlueprintProgress =
  | { type: 'step'; step: 'retrieving' | 'structuring' | 'writing' | 'pricing'; message: string }
  | { type: 'page'; done: number; total: number };

// ---------------------------------------------------------------------------
// Manual edits (/api/blueprint/edit)
// ---------------------------------------------------------------------------

export type EditOp =
  | { op: 'remove_page' | 'restore_page'; id: string }
  | { op: 'toggle_addon'; sku: string; on: boolean }
  | { op: 'toggle_article'; id: string; on: boolean };

export interface EditResult {
  /** The blueprint after the edit (unchanged when nothing applied). Always re-priced by the server. */
  blueprint: WireBlueprint;
  changes: string[];
  refused: string[];
  notice: string | null;
  /** A one-line, server-written estimate ("Your estimate is $3,650 plus $55 a month."). */
  estimate: string;
}
