export interface LineItem {
  label: string;
  amount: number;
  recurring: boolean;
}

export interface EstimatedPrice {
  min: number;
  max: number;
  currency: string;
  monthly_min: number;
  monthly_max: number;
  requires_discovery_call: boolean;
  line_items: LineItem[];
}

export interface Wireframe {
  page: string;
  html: string;
}

export interface GenerationMeta {
  generated_at: string;
  generation_time_ms: number;
  pages_generated: number;
  wireframes_source: 'claude' | 'placeholder';
  pricing_source: 'knowledge_base' | 'heuristic';
  model: string | null;
}

export interface GenerateResponse {
  generation_id: string;
  estimated_price: EstimatedPrice;
  wireframes: Wireframe[];
  meta: GenerationMeta;
}

export interface GenerateRequest {
  email: string;
  business_description: string;
  /** Trade name, used to title the generated site. Null when not given. */
  business_name?: string | null;
  /** How wide a radius they serve — drives local SEO scope in the estimate. */
  service_area?: string;
  industry: string;
  industry_other?: string | null;
  location: string;
  target_audience: string;
  ecommerce: string;
  pages: string;
  cms: string;
  user_accounts: string;
  integrations: string;
  branding: string;
  timeline: string;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  error: {
    type: 'invalid_payload' | 'rate_limited' | 'upstream_error' | 'internal_error';
    message: string;
    request_id: string | null;
    details?: ApiErrorDetail[];
  };
}
