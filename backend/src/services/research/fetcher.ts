// backend/src/services/research/fetcher.ts
// The fetcher the crawler uses: safeFetch plus robots.txt compliance (checked on EVERY hop,
// including redirects) plus a per-job fetch budget. One instance per site/job, so robots
// rules, crawl-delay spacing and the budget are isolated.
import { validateUrlSyntax } from '../security/urlGuard.js';
import { isSafeMarkup } from './html.js';
import { isAllowed, loadRobots, type RobotsRules } from './robots.js';
import { safeFetch, type ContentKind, type FetchDeps, type FetchFailure, type FetchResult } from './safeFetch.js';

export const MAX_FETCHES_PER_JOB = 40;

export class PoliteFetcher {
  private robots = new Map<string, Promise<RobotsRules>>();
  private lastRequest = new Map<string, number>();
  private spacing = new Map<string, Promise<void>>();
  private fetches = 0;

  constructor(private readonly deps: FetchDeps = {}, private readonly maxFetches = MAX_FETCHES_PER_JOB) {}

  /** Fetches an HTML page if the site's robots.txt allows it, spacing requests per site. */
  fetchHtml(url: string): Promise<FetchResult> {
    return this.fetchAllowed(url, 'html');
  }

  /** Same rules for plain-text/XML files such as sitemap.xml. */
  fetchText(url: string): Promise<FetchResult> {
    return this.fetchAllowed(url, 'text');
  }

  private async fetchAllowed(url: string, kind: ContentKind): Promise<FetchResult> {
    const checked = validateUrlSyntax(url);
    if (!checked.ok) return { ok: false, reason: checked.reason };
    const res = await safeFetch(checked.url, kind, { ...this.deps, guard: (hop) => this.checkHop(hop) });
    // Refuse hostile markup before any parser sees it (parsers are quadratic on deep nesting).
    if (res.ok && kind === 'html' && !isSafeMarkup(res.body)) return { ok: false, reason: 'too_complex' };
    return res;
  }

  /** Budget, robots.txt and crawl-delay for one hop. Counting is synchronous, so concurrent callers cannot overshoot. */
  private async checkHop(hopUrl: string): Promise<FetchFailure | null> {
    const parsed = new URL(hopUrl);
    const origin = `${parsed.protocol}//${parsed.hostname}`;

    if (this.fetches >= this.maxFetches) return 'budget_exceeded';
    this.fetches++; // the page request itself

    let rules = this.robots.get(origin);
    if (!rules) {
      if (this.fetches >= this.maxFetches) return 'budget_exceeded';
      this.fetches++; // the robots.txt request
      rules = loadRobots(origin, this.deps);
      this.robots.set(origin, rules);
    }
    const robots = await rules;
    if (robots.blockAll && robots.failure && robots.failure !== 'http_error') return robots.failure;
    if (!isAllowed(robots, parsed.pathname || '/')) return 'robots_disallowed';

    if (robots.crawlDelay > 0) {
      // Fetches run concurrently, so spacing must be serialized per site or the delay is moot.
      const previous = this.spacing.get(origin) ?? Promise.resolve();
      const turn = previous.then(async () => {
        const wait = robots.crawlDelay * 1000 - (Date.now() - (this.lastRequest.get(origin) ?? 0));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        this.lastRequest.set(origin, Date.now());
      });
      this.spacing.set(origin, turn);
      await turn;
    }
    return null;
  }
}
