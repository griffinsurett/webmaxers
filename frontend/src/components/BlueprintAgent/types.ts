// src/components/BlueprintAgent/types.ts

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
  estimatedCost: number; // 0 for core 5 pages, +XXX for expansion
  included: boolean; // can be toggled by user [x]
  parentId?: string;
  children?: string[]; // IDs of sub-pages
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
  basePrice: number; // standard $1,250
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  quickActions?: { label: string; action: string }[];
  isThinking?: boolean;
  /** Server-written caveats (e.g. a site could not be read), shown under the message. */
  notices?: string[];
  metadata?: {
    siteAnalyzed?: string;
    competitorAnalyzed?: string;
    stage?: 'intake' | 'audit' | 'architecture' | 'pricing' | 'final';
  };
}

