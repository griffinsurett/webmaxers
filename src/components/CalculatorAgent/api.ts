import type { GenerateRequest, GenerateResponse, ApiErrorPayload } from './types';

const API_BASE_URL = (import.meta.env.PUBLIC_API_URL || 'https://api.griffinswebservices.com').replace(/\/$/, '');

function mapIndustry(val?: string): string {
  if (!val) return 'service_consulting';
  const lower = val.toLowerCase();
  if (lower.includes('health') || lower.includes('medical')) return 'healthcare_medical';
  if (lower.includes('retail') || lower.includes('e-commerce') || lower.includes('ecommerce')) return 'ecommerce_retail';
  if (lower.includes('tech') || lower.includes('saas')) return 'technology_saas';
  if (lower.includes('creative') || lower.includes('portfolio')) return 'creative_portfolio';
  // These three used to fall through to service_consulting, so a restaurant got
  // case studies and process steps instead of a menu, hours and reservations.
  if (lower.includes('home service') || lower.includes('roofing') || lower.includes('plumbing') || lower.includes('hvac')) return 'home_services';
  if (lower.includes('restaurant') || lower.includes('hospitality')) return 'restaurant_hospitality';
  if (lower.includes('real estate')) return 'real_estate';
  if (lower.includes('other')) return 'other';
  return 'service_consulting';
}

function mapEcommerce(val?: string): string {
  if (!val) return 'none';
  const lower = val.toLowerCase();
  if (lower.includes('physical')) return 'full_ecommerce';
  if (lower.includes('digital') || lower.includes('payment')) return 'simple_payments';
  if (lower.includes('yes')) return 'full_ecommerce';
  return 'none';
}

function mapPages(val?: string): string {
  if (!val) return '2_5_pages';
  if (val.includes('15+')) return '10_plus_pages';
  if (val.includes('6-15')) return '6_10_pages';
  if (val.includes('1-5')) return '2_5_pages';
  return '2_5_pages';
}

function mapCms(val?: string): string {
  if (!val) return 'occasional';
  const lower = val.toLowerCase();
  if (lower.startsWith('yes')) return 'frequent';
  if (lower.includes('griffin')) return 'managed_for_me';
  return 'occasional';
}

function mapUserAccounts(val?: string): string {
  if (!val) return 'none';
  const lower = val.toLowerCase();
  if (lower.includes('complex')) return 'employees_admin';
  if (lower.includes('basic') || lower.includes('customer')) return 'customers';
  return 'none';
}

function mapIntegrations(val?: string): string {
  if (!val) return 'yes';
  const lower = val.toLowerCase();
  if (lower.includes('basic') || lower === 'no') return 'none';
  return 'yes';
}

function mapBranding(val9?: string, val8?: string): string {
  const combined = `${val9 || ''} ${val8 || ''}`.toLowerCase();
  if (combined.includes('fully branded') || combined.includes('ready')) return 'ready';
  if (combined.includes('copywriting')) return 'need_copywriting';
  if (combined.includes('new logo') || combined.includes('scratch')) return 'from_scratch';
  return 'logo_only';
}

/** Slug form of the service-area answer — local SEO scope scales with this. */
function mapServiceArea(val?: string): string {
  if (!val) return 'unspecified';
  const lower = val.toLowerCase();
  // Order matters: "A few nearby towns" also contains "town", so the nearby
  // check has to come before the single-city one.
  if (lower.includes('nearby')) return 'nearby_towns';
  if (lower.includes('city') || lower.includes('town')) return 'single_city';
  if (lower.includes('whole state')) return 'statewide';
  if (lower.includes('multiple states')) return 'multi_state';
  if (lower.includes('online') || lower.includes('nationwide')) return 'nationwide';
  return 'unspecified';
}

function mapTimeline(val?: string): string {
  if (!val) return '1_2_months';
  const lower = val.toLowerCase();
  if (lower.includes('rush') || lower.includes('asap')) return 'rush';
  if (lower.includes('3-6')) return '3_6_months';
  return '1_2_months';
}

export function mapAnswersToPayload(answers: Record<string, string>, email: string): GenerateRequest {
  const rawDesc = answers.q1 || answers.q2 || 'Custom website project for business growth';
  const location = (answers.q2 || 'Austin, TX').trim();
  const businessName = (answers.q_business_name || '').trim();
  const serviceArea = (answers.q_service_area || '').trim();

  // Backend requires business_description to be min 20 characters
  let cleanDesc = rawDesc.trim();
  if (cleanDesc.length < 20) {
    cleanDesc = `${cleanDesc} - comprehensive website design and development with custom SEO and digital strategies.`;
  }

  // Both prompts (pricing and wireframes) feed on `model_dump()` of the whole
  // payload, so the dedicated fields below are enough for the model to see them.
  // They're also folded into the description because `business_description` is
  // what the wireframe brief uses verbatim as `business_summary` — that's how
  // the business name reaches the generated site's title.
  const contextParts: string[] = [];
  if (businessName) contextParts.push(`The business is called ${businessName}.`);
  if (serviceArea) contextParts.push(`Service area: ${serviceArea.toLowerCase()}.`);
  if (contextParts.length > 0) {
    cleanDesc = `${cleanDesc} ${contextParts.join(' ')}`;
  }

  const industrySlug = mapIndustry(answers.q_industry);

  return {
    email: email && email.includes('@') ? email.trim() : 'client@example.com',
    business_description: cleanDesc,
    business_name: businessName || null,
    service_area: mapServiceArea(answers.q_service_area),
    industry: industrySlug,
    industry_other: industrySlug === 'other' ? 'Custom Industry' : null,
    location: location.length >= 2 ? location : 'Austin, TX',
    target_audience: 'b2c',
    ecommerce: mapEcommerce(answers.q3),
    pages: mapPages(answers.q4),
    cms: mapCms(answers.q5),
    user_accounts: mapUserAccounts(answers.q6),
    integrations: mapIntegrations(answers.q7),
    branding: mapBranding(answers.q9, answers.q8),
    timeline: mapTimeline(answers.q11),
  };
}

export async function generateEstimate(payload: GenerateRequest): Promise<GenerateResponse> {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}/api/generate` : '/api/railway-generate';
  const fallbackUrl = '/api/railway-generate';

  let response: Response;
  try {
    response = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6 * 60 * 1000),
    });
  } catch (err: any) {
    // If direct connection fails (e.g. ISP DNS refusal on *.up.railway.app), try the Vercel proxy
    if (primaryUrl !== fallbackUrl) {
      try {
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6 * 60 * 1000),
        });
      } catch (fallbackErr: any) {
        throw new Error(`Network Error: Unable to reach backend directly or via proxy. Please verify Railway service is active.`);
      }
    } else {
      throw new Error(`Network Error: Unable to reach backend. Please verify Railway service is active.`);
    }
  }

  if (!response.ok) {
    let errorMsg = `Server returned status ${response.status}`;
    try {
      const errData = (await response.json()) as ApiErrorPayload;
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
      if (errData?.error?.details && errData.error.details.length > 0) {
        const detailMsgs = errData.error.details.map(d => `${d.field}: ${d.message}`).join(', ');
        errorMsg = `${errorMsg} (${detailMsgs})`;
      }
    } catch {
      // JSON parsing failed
    }
    throw new Error(errorMsg);
  }

  return (await response.json()) as GenerateResponse;
}
