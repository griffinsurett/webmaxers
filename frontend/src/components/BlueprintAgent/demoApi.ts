// src/components/BlueprintAgent/demoApi.ts
// An in-browser stand-in for the backend, used only when the visitor CHOOSES "Try a demo" because
// the live assistant is unreachable. It offers exactly the same calls as the real client, so the
// controller and the whole screen run unchanged.
//
// Honesty rules:
//  - it never reads or analyzes what the visitor types: it says so in plain words
//  - it shows ONE clearly labelled example business (not the visitor's), never fake "research"
//    about their real competitors
//  - its prices come from the sample data, so the UI labels them "example", never a quote
// No network, no model, no storage; loaded lazily so it costs the normal page nothing.
import { apiError, type ApiResult, type ClientOptions } from './api';
import { INITIAL_BLUEPRINT } from './mockData';
import type { AgentApi } from './controller';
import type {
  BlueprintProgress, ChatTurn, EditOp, EditResult, ResearchProgress, WireAddon, WireBlueprint, WirePage, WirePriceLine, WireResearch,
} from './wire';

export const DEMO_SESSION_ID = '0de00000-0000-4000-8000-000000000000';
const ESSENTIAL = new Set(['home', 'contact']);
const INCLUDED_PAGES = 5;

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });
const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------------------------------------------------------------------------
// The example blueprint (converted from the sample data into the server's shape)
// ---------------------------------------------------------------------------

const pageId = (id: string) => id.replace(/^page-/, '');

function samplePages(): WirePage[] {
  return INITIAL_BLUEPRINT.pages.map((p) => {
    const id = pageId(p.id);
    const parentId = id === 'home' ? null : p.parentId ? pageId(p.parentId) : 'home';
    const segments = p.slug.split('/').filter(Boolean);
    return {
      id,
      parentId,
      title: p.title,
      slug: segments[segments.length - 1] ?? '',
      path: p.slug || '/',
      category: p.category,
      classification: p.classification,
      sku: 'page-standard',
      purpose: p.purpose,
      whyRecommended: p.whyRecommended,
      primaryCta: p.primaryCta,
      sections: [{
        heading: 'Planned content',
        purpose: p.purpose,
        subsections: p.recommendedContent.map((c) => ({ heading: c.slice(0, 80), content: '' })),
      }],
      contentStatus: 'written',
      evidence: [],
      basis: 'reasonable_recommendation',
      included: p.included,
      estimatedCost: p.classification === 'core' ? 0 : p.estimatedCost,
    };
  });
}

function sampleAddons(): WireAddon[] {
  return INITIAL_BLUEPRINT.addons.map((a) => ({
    sku: a.id, name: a.name, category: a.category, purpose: a.purpose, setupCost: a.setupCost, monthlyCost: a.monthlyCost,
    recommended: a.recommended, reason: a.whyRecommended, evidence: [], included: a.included,
  }));
}

/** Example pricing from the sample data. Only ever shown labelled as an example. */
export function priceSample(pages: WirePage[], addons: WireAddon[]) {
  const extra: WirePriceLine[] = pages.filter((p) => p.included && p.classification !== 'core')
    .map((p) => ({ id: p.id, sku: p.sku, title: p.title, amount: p.estimatedCost, monthly: 0 }));
  const on = addons.filter((a) => a.included);
  const extraPages = extra.reduce((s, l) => s + l.amount, 0);
  const addonSetup = on.reduce((s, a) => s + a.setupCost, 0);
  const monthly = on.reduce((s, a) => s + a.monthlyCost, 0);
  const base = INITIAL_BLUEPRINT.basePrice;
  return {
    catalogVersion: 'demo',
    websiteType: { sku: 'demo-example', name: 'Example Plan', basePrice: base, includedPages: INCLUDED_PAGES },
    pagesSelected: pages.filter((p) => p.included).length,
    pagesCoveredByBase: pages.filter((p) => p.included && p.classification === 'core').map((p) => ({ id: p.id, sku: p.sku, title: p.title, amount: 0, monthly: 0 })),
    extraPages: extra,
    content: [] as WirePriceLine[],
    addons: on.map((a) => ({ id: a.sku, sku: a.sku, title: a.name, amount: a.setupCost, monthly: a.monthlyCost })),
    totals: { base, extraPages, content: 0, addonSetup, initialInvestment: base + extraPages + addonSetup, monthly },
  };
}

export function sampleBlueprint(): WireBlueprint {
  const pages = samplePages();
  const addons = sampleAddons();
  return {
    version: 1,
    summary: { ...INITIAL_BLUEPRINT.summary },
    websiteTypeSku: 'demo-example',
    pages,
    articles: [],
    addons,
    pricing: priceSample(pages, addons),
    facts: [],
    notices: ['Demo mode: this is an example plan for a sample business, not a plan or a quote for yours.'],
    status: 'complete',
    generatedAt: new Date(0).toISOString(),
  };
}

function sampleResearch(): WireResearch {
  const claim = (point: string) => ({ point, why: '', evidence: [] as string[], support: 'evidenced' });
  const comp = (key: string, name: string, host: string) => ({
    key, name, host, whatWorks: [claim('Prominent phone number and an estimate button on every page.')],
    gaps: [claim('No upfront pricing guidance.')], limitedVisibility: false, thin: false,
  });
  return {
    status: 'complete',
    notices: ['Demo mode: these competitors are made-up examples, not real research.'],
    sites: [
      { key: 'c1', role: 'competitor', name: 'Example Roofing A', host: 'roofing-a.example', url: 'https://roofing-a.example', source: 'discovered', status: 'read', pagesRead: 6 },
      { key: 'c2', role: 'competitor', name: 'Example Roofing B', host: 'roofing-b.example', url: 'https://roofing-b.example', source: 'discovered', status: 'read', pagesRead: 5 },
      { key: 'c3', role: 'competitor', name: 'Example Roofing C', host: 'roofing-c.example', url: 'https://roofing-c.example', source: 'discovered', status: 'read', pagesRead: 4 },
    ],
    findings: {
      competitors: [comp('c1', 'Example Roofing A', 'roofing-a.example'), comp('c2', 'Example Roofing B', 'roofing-b.example'), comp('c3', 'Example Roofing C', 'roofing-c.example')],
      patterns: [],
      ownSite: null,
      opportunities: [claim('Publish a transparent cost guide: the example competitors hide their pricing.')],
    },
  };
}

// ---------------------------------------------------------------------------
// The scripted API
// ---------------------------------------------------------------------------

export interface DemoOptions {
  /** Pause between scripted progress steps. Tests pass 0. */
  stepMs?: number;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const NOTICE = 'Demo mode: I am not reading your answers. This shows an example plan for a sample roofing company.';

export function createDemoApi(options: DemoOptions = {}): AgentApi {
  const stepMs = options.stepMs ?? 700;
  const wait = options.wait ?? ((ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  }));

  let intakeTurns = 0;
  let stage: ChatTurn['stage'] = 'greet';
  let blueprint: WireBlueprint | null = null;

  const turn = (over: Partial<ChatTurn>): ChatTurn => ({
    sessionId: DEMO_SESSION_ID, reply: '', quickReplies: [], notices: [], locked: false, stage,
    progress: { required: 5, filled: 5 },
    slots: { businessName: null, industry: null, services: [], serviceArea: null, primaryGoal: null, ownUrl: null, competitorUrls: [], noWebsite: false },
    blueprint: null,
    ...over,
  });

  const reprice = (bp: WireBlueprint): WireBlueprint => ({ ...bp, pricing: priceSample(bp.pages, bp.addons) });
  const estimate = (bp: WireBlueprint) => {
    const t = bp.pricing.totals;
    return `Your estimate is ${dollars(t.initialInvestment)}${t.monthly > 0 ? ` plus ${dollars(t.monthly)} a month` : ''}.`;
  };
  const aborted = (o?: ClientOptions) => !!o?.signal?.aborted;

  async function stream<E>(events: E[], onProgress: ((e: E) => void) | undefined, o?: ClientOptions): Promise<boolean> {
    for (const e of events) {
      await wait(stepMs, o?.signal);
      if (aborted(o)) return false;
      onProgress?.(e);
    }
    await wait(stepMs, o?.signal);
    return !aborted(o);
  }

  return {
    checkBackendHealth: async () => true,

    async startSession() {
      // A new conversation (the controller's reset() reuses this instance) starts from scratch.
      stage = 'greet';
      intakeTurns = 0;
      blueprint = null;
      return ok(turn({ reply: 'Demo greeting', stage: 'greet', progress: { required: 5, filled: 0 } }));
    },

    // A demo never persists, so there is nothing to restore.
    async restoreSession() {
      return { ok: false, error: apiError('expired') };
    },

    async sendChatMessage(_id, message) {
      if (stage === 'research' || stage === 'blueprint') {
        return ok(turn({ reply: 'I am still working on the example plan. One moment.' }));
      }
      if (stage === 'refine' || stage === 'close') {
        const wantsPrice = /price|cost|total|how much|estimate|\$/i.test(message);
        return ok(turn({
          stage: 'refine',
          reply: wantsPrice && blueprint
            ? `${estimate(blueprint)} (Example numbers from the sample plan.)`
            : "In demo mode I can't edit with free text. Use the ✕ buttons and the switches to change the example plan, or exit the demo to try the live assistant.",
          blueprint,
        }));
      }
      intakeTurns++;
      if (intakeTurns === 1) {
        stage = 'intake';
        return ok(turn({ stage, progress: { required: 5, filled: 2 }, notices: [NOTICE], reply: "Thanks! In the live assistant I'd now ask what services you offer and where. Tell me anything and we'll keep going." }));
      }
      if (intakeTurns === 2) {
        stage = 'intake';
        return ok(turn({ stage, progress: { required: 5, filled: 4 }, reply: 'What is the main thing you want your website to do?', quickReplies: ['More phone calls', 'More quote requests', 'More bookings'] }));
      }
      stage = 'research';
      return ok(turn({ stage, reply: "That's everything I need. I'll look at the competition and put the example plan together." }));
    },

    async streamResearch(_id, onProgress, o) {
      const events: ResearchProgress[] = [
        { type: 'step', step: 'discovering', message: 'Finding local competitors' },
        { type: 'competitors', items: sampleResearch().sites.map((s) => ({ name: s.name, host: s.host, source: 'discovered' as const })) },
        { type: 'step', step: 'reading', message: 'Reading their websites' },
        ...sampleResearch().sites.flatMap((s): ResearchProgress[] => [
          { type: 'site', host: s.host, role: 'competitor', status: 'reading' },
          { type: 'site', host: s.host, role: 'competitor', status: 'done', pages: s.pagesRead },
        ]),
        { type: 'step', step: 'analyzing', message: 'Analyzing' },
      ];
      if (!(await stream(events, onProgress, o))) return { ok: false, error: apiError('aborted') };
      stage = 'blueprint';
      return ok(sampleResearch());
    },

    async streamBlueprint(_id, onProgress, o) {
      const total = INITIAL_BLUEPRINT.pages.length;
      const events: BlueprintProgress[] = [
        { type: 'step', step: 'retrieving', message: 'Gathering' },
        { type: 'step', step: 'structuring', message: 'Planning' },
        { type: 'step', step: 'writing', message: 'Outlining' },
        ...Array.from({ length: total }, (_, i): BlueprintProgress => ({ type: 'page', done: i + 1, total })),
        { type: 'step', step: 'pricing', message: 'Pricing' },
      ];
      if (!(await stream(events, onProgress, o))) return { ok: false, error: apiError('aborted') };
      stage = 'refine';
      blueprint = sampleBlueprint();
      return ok(blueprint);
    },

    async editBlueprint(_id, ops: EditOp[]): Promise<ApiResult<EditResult>> {
      if (!blueprint) return { ok: false, error: apiError('not_ready') };
      let bp = blueprint;
      const changes: string[] = [];
      const refused: string[] = [];
      for (const op of ops) {
        if (op.op === 'remove_page' || op.op === 'restore_page') {
          const page = bp.pages.find((p) => p.id === op.id);
          if (!page) { refused.push("I couldn't find that page in your plan."); continue; }
          const want = op.op === 'restore_page';
          if (!want && ESSENTIAL.has(page.id)) { refused.push(`I've kept ${page.title}: every website needs a Home and a Contact page.`); continue; }
          if (page.included === want) { refused.push(`${page.title} is already ${want ? 'in' : 'out of'} your plan.`); continue; }
          bp = { ...bp, pages: bp.pages.map((p) => (p.id === page.id ? { ...p, included: want } : p)) };
          changes.push(want ? `Added "${page.title}".` : `Removed "${page.title}".`);
        } else if (op.op === 'toggle_addon') {
          const addon = bp.addons.find((a) => a.sku === op.sku);
          if (!addon) { refused.push("I couldn't find that add-on."); continue; }
          if (addon.included === op.on) { refused.push(`${addon.name} is already ${op.on ? 'in' : 'out of'} your plan.`); continue; }
          bp = { ...bp, addons: bp.addons.map((a) => (a.sku === addon.sku ? { ...a, included: op.on } : a)) };
          changes.push(op.on ? `Added ${addon.name}.` : `Removed ${addon.name}.`);
        } else {
          refused.push("This example plan has no articles to change.");
        }
      }
      if (changes.length > 0) blueprint = reprice(bp);
      return ok({ blueprint: blueprint, changes, refused, notice: null, estimate: estimate(blueprint) });
    },
  };
}
