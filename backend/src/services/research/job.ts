// backend/src/services/research/job.ts
// The research job: discover competitors (if needed) → read each site → extract facts →
// analyze → one ResearchRecord. Storage-free and fully injectable, so it is testable offline;
// the route owns the session claim, SSE and persistence.
//
// Failure policy: the job never throws for a bad site. Unreadable sites are reported (with a
// visitor-safe reason) and skipped; if analysis fails the record keeps the raw facts. The
// conversation always moves on, using intake answers where research is thin.
import { analyzeResearch, type AnalysisSite, type Findings, type FindingsLlm } from './analysis.js';
import { crawlSite } from './crawler.js';
import { discoverCompetitors, type CompetitorSearch } from './discovery.js';
import { extractSite } from './extractor.js';
import { toFacts, type Fact } from './facts.js';
import { PoliteFetcher } from './fetcher.js';
import type { FetchFailure } from './safeFetch.js';
import { log } from '../log/logger.js';

export const MAX_COMPETITOR_SITES = 3;
const SITE_CONCURRENCY = 2;

export interface ResearchInput {
  businessName?: string;
  industry: string;
  serviceArea: string;
  services: string[];
  primaryGoal?: string;
  ownUrl?: string;
  competitorUrls: string[];
}

export interface ResearchDeps {
  search: CompetitorSearch;
  llm: FindingsLlm;
  /** One fetcher per site keeps robots rules, crawl-delay and fetch budgets isolated. */
  makeFetcher: () => PoliteFetcher;
}

export type ProgressEvent =
  | { type: 'step'; step: 'discovering' | 'reading' | 'analyzing'; message: string }
  | { type: 'competitors'; items: { name: string; host: string; source: 'visitor' | 'discovered'; reason?: string }[] }
  | { type: 'site'; host: string; role: 'own' | 'competitor'; status: 'reading' | 'done' | 'failed'; pages?: number; note?: string };

export interface SiteRecord {
  key: string;
  role: 'own' | 'competitor';
  name: string;
  host: string;
  url: string;
  source: 'visitor' | 'discovered';
  status: 'read' | 'limited' | 'failed';
  pagesRead: number;
  /** Visitor-safe explanation when the site could not be (fully) read. */
  note?: string;
  facts: Fact[];
}

export interface ResearchRecord {
  version: 1;
  status: 'complete' | 'partial' | 'failed';
  completedAt: string;
  sites: SiteRecord[];
  /** Null when analysis could not run; the raw facts in `sites` are still stored. */
  findings: Findings | null;
  notices: string[];
}

/**
 * What the visitor gets when the research run itself fails or runs out of time. It is a normal
 * "nothing could be read" result, so the conversation moves on and the blueprint is built from the
 * visitor's own answers instead of leaving them stuck.
 */
export function failedResearchRecord(): ResearchRecord {
  return {
    version: 1,
    status: 'failed',
    completedAt: new Date().toISOString(),
    sites: [],
    findings: null,
    notices: ["I couldn't finish the research this time, so I'll build your blueprint from what you told me."],
  };
}

/** Why a site could not be read, in words safe to show the visitor. */
export function friendlyReason(reason: FetchFailure, status?: number): string {
  if (reason === 'robots_disallowed') return "its owner asks automated tools not to read it";
  if (reason === 'http_error' && status && [401, 403, 429].includes(status)) return 'it blocks automated readers';
  if (reason === 'timeout' || reason === 'network' || (reason === 'http_error' && status && status >= 500)) return "it didn't respond in time";
  if (reason === 'unresolvable') return "I couldn't find that website";
  return "I couldn't read it safely";
}

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

async function pool<T, R>(items: T[], size: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

interface Target { key: string; role: 'own' | 'competitor'; name: string; url: string; source: 'visitor' | 'discovered' }

export async function runResearch(
  input: ResearchInput, deps: ResearchDeps, emit: (e: ProgressEvent) => void = () => {},
): Promise<ResearchRecord> {
  const notices: string[] = [];
  const targets: Target[] = [];
  if (input.ownUrl) targets.push({ key: 'own', role: 'own', name: input.businessName ?? hostOf(input.ownUrl), url: input.ownUrl, source: 'visitor' });

  // 1. Competitors: the visitor's, or find them.
  let competitorTargets: Target[] = input.competitorUrls.slice(0, MAX_COMPETITOR_SITES)
    .map((url, i) => ({ key: `c${i + 1}`, role: 'competitor' as const, name: hostOf(url), url, source: 'visitor' as const }));

  if (competitorTargets.length === 0 && (!input.industry || !input.serviceArea)) {
    notices.push("I didn't have enough about your business to look up competitors, so this analysis is based on what you told me.");
  } else if (competitorTargets.length === 0) {
    emit({ type: 'step', step: 'discovering', message: `Finding local ${input.industry} competitors in ${input.serviceArea}…` });
    const found = await discoverCompetitors(
      { industry: input.industry, serviceArea: input.serviceArea, services: input.services, ownUrl: input.ownUrl },
      { search: deps.search, fetcher: deps.makeFetcher() },
    ).catch((err): Awaited<ReturnType<typeof discoverCompetitors>> => {
      log.error('discovery crashed', { err });
      return { ok: false, reason: 'search_failed', rejected: [] };
    });
    if (found.ok) {
      competitorTargets = found.competitors.map((c, i) => ({ key: `c${i + 1}`, role: 'competitor' as const, name: c.name, url: c.url, source: 'discovered' as const }));
      emit({ type: 'competitors', items: found.competitors.map((c) => ({ name: c.name, host: c.host, source: 'discovered' as const, reason: c.reason || undefined })) });
      if (found.competitors.some((c) => !c.matches.area)) notices.push("Some competitors didn't clearly mention your area, so treat those comparisons with care.");
    } else {
      notices.push(found.reason === 'search_failed'
        ? "I couldn't look up local competitors just now, so this analysis is based on what you told me."
        : "I couldn't find local competitors I could verify, so this analysis is based on what you told me.");
    }
  } else {
    emit({ type: 'competitors', items: competitorTargets.map((c) => ({ name: c.name, host: hostOf(c.url), source: 'visitor' as const })) });
  }
  targets.push(...competitorTargets);

  // 2. Read every site: crawl → extract → facts.
  emit({ type: 'step', step: 'reading', message: 'Reading the websites…' });
  const sites = await pool(targets, SITE_CONCURRENCY, async (t): Promise<{ record: SiteRecord; analysis?: AnalysisSite }> => {
    const host = hostOf(t.url);
    emit({ type: 'site', host, role: t.role, status: 'reading' });
    const base = { key: t.key, role: t.role, name: t.name, host, url: t.url, source: t.source };
    let crawled;
    try {
      crawled = await crawlSite(t.url, deps.makeFetcher());
    } catch (err) {
      log.error('crawl crashed', { host, err });
      crawled = { ok: false as const, reason: 'network' as FetchFailure, status: undefined };
    }
    if (!crawled.ok) {
      const note = `I couldn't read ${host}: ${friendlyReason(crawled.reason, crawled.status)}.`;
      emit({ type: 'site', host, role: t.role, status: 'failed', note });
      return { record: { ...base, status: 'failed', pagesRead: 0, note, facts: [] } };
    }
    let facts: Fact[];
    let limited = crawled.crawl.limitedVisibility;
    try {
      const siteFacts = extractSite(crawled.crawl);
      facts = toFacts(siteFacts, t.key);
      limited ||= siteFacts.suspicious;
    } catch (err) {
      log.error('extract crashed', { host, err });
      emit({ type: 'site', host, role: t.role, status: 'failed', note: `I couldn't read ${host}: I couldn't read it safely.` });
      return { record: { ...base, status: 'failed', pagesRead: 0, note: "I couldn't read it safely.", facts: [] } };
    }
    const pagesRead = crawled.crawl.pages.length;
    const note = limited ? `${host} shows very little to automated readers, so I can only say so much about it.` : undefined;
    emit({ type: 'site', host, role: t.role, status: 'done', pages: pagesRead, note });
    return {
      record: { ...base, status: limited ? 'limited' : 'read', pagesRead, note, facts },
      analysis: { key: t.key, name: t.name, host, facts, limitedVisibility: limited },
    };
  });

  const records = sites.map((s) => s.record);
  for (const r of records) if (r.note && r.status === 'failed') notices.push(r.note);

  // 3. Analyze what we could read.
  const own = sites.find((s) => s.analysis?.key === 'own')?.analysis;
  const competitors = sites.flatMap((s) => (s.analysis && s.analysis.key !== 'own' ? [s.analysis] : []));
  let findings: Findings | null = null;

  if (own || competitors.length > 0) {
    emit({ type: 'step', step: 'analyzing', message: 'Analyzing what works and what is missing…' });
    const result = await analyzeResearch(
      { business: { industry: input.industry, serviceArea: input.serviceArea, services: input.services, primaryGoal: input.primaryGoal, businessName: input.businessName }, own, competitors },
      deps.llm,
    );
    if (result.ok) findings = result.findings;
    else notices.push("I couldn't finish the written analysis, so I'll build your blueprint from what I read and what you told me.");
  }

  const anyRead = records.some((r) => r.status !== 'failed');
  const status: ResearchRecord['status'] = !anyRead ? 'failed'
    : findings && records.every((r) => r.status === 'read') ? 'complete' : 'partial';
  if (!anyRead && records.length > 0 && notices.length === 0) notices.push("I couldn't read any websites, so I'll build your blueprint from what you told me.");

  return { version: 1, status, completedAt: new Date().toISOString(), sites: records, findings, notices };
}
