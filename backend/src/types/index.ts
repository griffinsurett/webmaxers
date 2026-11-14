// backend/src/types/index.ts

// ---------------------------------------------------------------------------
// Pricing catalog (knowledge base) & deterministic pricing
// ---------------------------------------------------------------------------

export type CatalogKind = 'website_type' | 'page' | 'content' | 'addon';

export interface CatalogItem {
  sku: string;
  kind: CatalogKind;
  name: string;
  description: string;
  price: number;
  setup: number;
  monthly: number;
  includedPages: number | null;
  unit: string;
  version: string;
  metadata: Record<string, unknown>;
}

/** A selectable item in a blueprint, referencing a catalog SKU (never a price). */
export interface PricedSelection {
  id: string;
  sku: string;
  title?: string;
  included: boolean;
  /** Pages only: core pages fill the website type's allowance first. */
  classification?: PageClassification;
}

export interface PriceRequest {
  websiteTypeSku: string;
  pages: PricedSelection[];
  content?: PricedSelection[];
  addons?: PricedSelection[];
}

export interface PriceLine {
  id: string;
  sku: string;
  title: string;
  /** one-time amount for this line (0 when covered by the base price) */
  amount: number;
  monthly: number;
  note?: string;
}

export interface PriceBreakdown {
  catalogVersion: string;
  websiteType: { sku: string; name: string; basePrice: number; includedPages: number };
  pagesSelected: number;
  pagesCoveredByBase: PriceLine[];
  extraPages: PriceLine[];
  content: PriceLine[];
  addons: PriceLine[];
  totals: {
    base: number;
    extraPages: number;
    content: number;
    addonSetup: number;
    initialInvestment: number;
    monthly: number;
  };
  /** Set when another website type in the same family covers the pages for less. */
  cheaperWebsiteType?: { sku: string; name: string; initialInvestment: number; saves: number };
}

export type PageClassification = 'core' | 'recommended' | 'future';

export interface SitemapPageItem {
  id: string;
  title: string;
  slug: string;
  category: 'core' | 'service' | 'location' | 'resource' | 'legal';
  classification: PageClassification;
  purpose: string;
  whyRecommended: string;
  recommendedContent: string[];
  primaryCta: string;
  estimatedCost: number;
  included: boolean;
  parentId?: string;
  children?: string[];
}

export interface FunctionalAddon {
  id: string;
  name: string;
  category: 'forms' | 'chat' | 'booking' | 'crm' | 'reviews' | 'payments';
  purpose: string;
  setupCost: number;
  monthlyCost: number;
  recommended: boolean;
  whyRecommended: string;
  included: boolean;
}

export interface BusinessSummary {
  businessName: string;
  industry: string;
  serviceArea: string;
  existingUrl?: string;
  competitorUrl?: string;
  primaryGoal: string;
  primaryAudience: string;
  recommendedStrategy: string;
}

export interface BlueprintState {
  summary: BusinessSummary;
  pages: SitemapPageItem[];
  addons: FunctionalAddon[];
  basePrice: number; // $1,250 fixed baseline for 5 core pages
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  targetUrl?: string;
  currentBlueprint?: BlueprintState;
}

export interface BlueprintGenerationRequest {
  sessionId: string;
  businessName?: string;
  industry?: string;
  primaryGoal?: string;
  existingUrl?: string;
  competitorUrl?: string;
  userPrompt: string;
}

