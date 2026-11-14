// Test helpers: a scripted fake `fetch` and SSE/JSON response builders.
import type { WireBlueprint } from '../../src/components/BlueprintAgent/wire';

export const SID = '8f0c1c3e-5a52-4a0c-9d57-2d0f6c1f4a11';

export function blueprint(overrides: Partial<WireBlueprint> = {}): WireBlueprint {
  return {
    version: 1,
    summary: { businessName: 'Maple Leaf Plumbing', industry: 'plumbing', serviceArea: 'Austin, TX', primaryGoal: 'More phone calls', primaryAudience: 'Homeowners', recommendedStrategy: 'Lead with calls.' },
    websiteTypeSku: 'site-standard',
    pages: [{
      id: 'home', parentId: null, title: 'Home', slug: '', path: '/', category: 'core', classification: 'core', sku: 'page-core', purpose: 'p', whyRecommended: 'w',
      primaryCta: 'Call now', sections: [], contentStatus: 'written', evidence: [], basis: 'intake', included: true, estimatedCost: 0,
    }],
    articles: [{ id: 'a1', title: 'T', customerQuestion: 'q', relatedPageId: 'home', conversionPath: 'c', priority: 'high', why: 'w', included: true, estimatedCost: 0 }],
    addons: [{ sku: 'addon-booking', name: 'Online booking', category: 'booking', purpose: 'p', setupCost: 400, monthlyCost: 20, recommended: true, reason: 'r', evidence: [], included: true }],
    pricing: {
      catalogVersion: 'x', websiteType: { sku: 'site-standard', name: 'Standard', basePrice: 1250, includedPages: 5 }, pagesSelected: 1,
      pagesCoveredByBase: [], extraPages: [], content: [], addons: [],
      totals: { base: 1250, extraPages: 0, content: 0, addonSetup: 400, initialInvestment: 1650, monthly: 20 },
    },
    facts: [], notices: [], status: 'complete', generatedAt: '2026-11-09T00:00:00Z',
    ...overrides,
  };
}

export const research = () => ({
  status: 'complete', notices: [],
  sites: [{ key: 'c1', role: 'competitor', name: 'Comp', host: 'comp.com', url: 'https://comp.com', source: 'discovered', status: 'read', pagesRead: 4 }],
  findings: { competitors: [], patterns: [], ownSite: null, opportunities: [] },
});

export const chatTurn = (over: Record<string, unknown> = {}) => ({
  sessionId: SID, reply: 'Hello!', quickReplies: ['A', 'B'], notices: [], locked: false, stage: 'intake',
  progress: { required: 4, filled: 1 },
  slots: { businessName: null, industry: null, services: [], serviceArea: null, primaryGoal: null, ownUrl: null, competitorUrls: [], noWebsite: false },
  ...over,
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const sseBlock = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** A streaming SSE response. `chunks` are written in order; the stream then closes unless `hold`. */
export function sse(chunks: string[], opts: { hold?: boolean; signal?: AbortSignal; status?: number; type?: string } = {}) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      if (!opts.hold) controller.close();
      opts.signal?.addEventListener('abort', () => { try { controller.error(new Error('aborted')); } catch { /* already closed */ } });
    },
  });
  return new Response(stream, { status: opts.status ?? 200, headers: { 'content-type': opts.type ?? 'text/event-stream; charset=utf-8' } });
}

export interface Call { url: string; init: RequestInit }

/** Fake fetch: each call consumes the next scripted step (a Response, or a function of the call). */
export function fakeFetch(steps: (Response | Error | ((c: Call) => Response | Error | Promise<Response>))[]) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    const out = typeof step === 'function' ? await step(call) : step;
    if (out instanceof Error) throw out;
    return out;
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

export const instantSleep = async () => {};
export const BASE = 'http://api.test';
