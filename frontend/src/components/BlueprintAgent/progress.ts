// src/components/BlueprintAgent/progress.ts
// Turns the server's streamed progress events into the checklist shown while research and the
// blueprint are being built. Pure: events in, new state out.
import type { BlueprintProgress, ResearchProgress } from './wire';

export type StepStatus = 'pending' | 'active' | 'done';
export interface ProgressStep { key: string; text: string; status: StepStatus; detail?: string }
export interface JobProgress {
  kind: 'research' | 'blueprint';
  steps: ProgressStep[];
  /** Per-site status while competitors are being read. */
  sites: Record<string, 'reading' | 'done' | 'failed'>;
  found: string[];
}

const RESEARCH_STEPS: [string, string][] = [
  ['discovering', 'Finding local competitors'],
  ['reading', 'Reading their websites'],
  ['analyzing', 'Working out what works and what is missing'],
];
const BLUEPRINT_STEPS: [string, string][] = [
  ['retrieving', 'Gathering what works for sites like yours'],
  ['structuring', 'Planning your sitemap'],
  ['writing', 'Outlining each page'],
  ['pricing', 'Working out your price'],
];

const make = (kind: JobProgress['kind'], defs: [string, string][]): JobProgress => ({
  kind, sites: {}, found: [],
  steps: defs.map(([key, text], i) => ({ key, text, status: i === 0 ? 'active' : 'pending' })),
});

export const startResearchProgress = (): JobProgress => make('research', RESEARCH_STEPS);
export const startBlueprintProgress = (): JobProgress => make('blueprint', BLUEPRINT_STEPS);

/** Marks `key` active and everything before it done. Never moves backwards. */
function advance(steps: ProgressStep[], key: string): ProgressStep[] {
  const idx = steps.findIndex((s) => s.key === key);
  if (idx === -1) return steps;
  const current = steps.findIndex((s) => s.status === 'active');
  if (current > idx) return steps; // a late or repeated event: ignore
  return steps.map((s, i): ProgressStep => (i < idx ? { ...s, status: 'done' } : i === idx ? { ...s, status: 'active' } : s));
}

const siteDetail = (sites: JobProgress['sites']): string | undefined => {
  const entries = Object.entries(sites);
  if (entries.length === 0) return undefined;
  return entries.map(([host, st]) => `${host} ${st === 'done' ? '✓' : st === 'failed' ? "(couldn't read)" : '…'}`).join('  ·  ');
};

export function applyResearchEvent(p: JobProgress, e: ResearchProgress): JobProgress {
  if (e.type === 'step') return { ...p, steps: advance(p.steps, e.step) };
  if (e.type === 'competitors') {
    const found = e.items.map((i) => i.host);
    return { ...p, found, steps: p.steps.map((s) => (s.key === 'discovering' && found.length ? { ...s, detail: `Found ${found.join(', ')}` } : s)) };
  }
  const sites = { ...p.sites, [e.host]: e.status };
  return { ...p, sites, steps: p.steps.map((s) => (s.key === 'reading' ? { ...s, detail: siteDetail(sites) } : s)) };
}

export function applyBlueprintEvent(p: JobProgress, e: BlueprintProgress): JobProgress {
  if (e.type === 'step') return { ...p, steps: advance(p.steps, e.step) };
  const steps = advance(p.steps, 'writing').map((s) => (s.key === 'writing' ? { ...s, detail: `${e.done} of ${e.total} pages` } : s));
  return { ...p, steps };
}

export const finishProgress = (p: JobProgress): JobProgress => ({ ...p, steps: p.steps.map((s): ProgressStep => ({ ...s, status: 'done' })) });
