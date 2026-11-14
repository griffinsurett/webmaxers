// backend/src/services/research/robots.ts
// robots.txt parsing and matching. We obey it: the visitor named a site, but the site owner
// still decides what bots may read.
//
// Group choice (RFC 9309): every group naming our product token exactly; if none, every `*`
// group. Matching groups are merged. Rule choice: the longest matching pattern wins, and
// Allow beats Disallow on a tie.
//
// Patterns are matched with a linear-time glob matcher, never a regex: robots.txt is written
// by the (possibly hostile) site owner, and "a*a*a*…b" must not be able to freeze the server.
import { BOT_NAME, safeFetch, type FetchDeps, type FetchFailure } from './safeFetch.js';

export interface RobotsRule { allow: boolean; pattern: string; anchored: boolean; length: number }

export interface RobotsRules {
  rules: RobotsRule[];
  /** Seconds between requests asked for by the site, capped so a site can't stall us. */
  crawlDelay: number;
  /** True when robots.txt could not be read safely; everything is then treated as disallowed. */
  blockAll: boolean;
  /** Why robots.txt could not be read, so callers report the real problem (bad host, timeout...). */
  failure?: FetchFailure;
}

export const ALLOW_ALL: RobotsRules = { rules: [], crawlDelay: 0, blockAll: false };
export const BLOCK_ALL: RobotsRules = { rules: [], crawlDelay: 0, blockAll: true };
const MAX_CRAWL_DELAY = 5;
const MAX_ROBOTS_BYTES = 200_000;
const MAX_RULES = 200;
const MAX_PATTERN_LENGTH = 100;
const MAX_PATH_LENGTH = 512;

/**
 * Glob match where `*` matches any run of characters and a trailing `$` (stored as
 * `anchored`) pins the end; otherwise the pattern is a prefix match. Greedy two-pointer
 * algorithm: O(pattern × path) worst case, no exponential backtracking.
 */
export function globMatch(pattern: string, anchored: boolean, path: string): boolean {
  const pat = anchored ? pattern : `${pattern}*`;
  let p = 0;
  let s = 0;
  let star = -1;
  let mark = 0;
  while (s < path.length) {
    if (p < pat.length && pat[p] === '*') {
      star = p++;
      mark = s;
    } else if (p < pat.length && pat[p] === path[s]) {
      p++;
      s++;
    } else if (star >= 0) {
      p = star + 1;
      s = ++mark;
    } else {
      return false;
    }
  }
  while (p < pat.length && pat[p] === '*') p++;
  return p === pat.length;
}

function toRule(allow: boolean, raw: string): RobotsRule | null {
  let value = raw.trim();
  if (!value || value.length > MAX_PATTERN_LENGTH) return null;
  const anchored = value.endsWith('$');
  if (anchored) value = value.slice(0, -1);
  value = value.replace(/\*{2,}/g, '*'); // collapsing runs keeps matching cheap and identical
  return { allow, pattern: value, anchored, length: value.length };
}

export function parseRobots(text: string): RobotsRules {
  type Group = { agents: string[]; rules: RobotsRule[]; delay: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.slice(0, MAX_ROBOTS_BYTES).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: 0 };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      if (value === '' || current.rules.length >= MAX_RULES) continue; // "Disallow:" allows everything
      const rule = toRule(field === 'allow', value);
      if (rule) current.rules.push(rule);
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) current.delay = Math.min(n, MAX_CRAWL_DELAY);
    }
  }

  const bot = BOT_NAME.toLowerCase();
  const named = groups.filter((g) => g.agents.includes(bot));
  const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes('*'));
  if (chosen.length === 0) return ALLOW_ALL;
  return {
    rules: chosen.flatMap((g) => g.rules).slice(0, MAX_RULES),
    crawlDelay: Math.max(...chosen.map((g) => g.delay)),
    blockAll: false,
  };
}

export function isAllowed(robots: RobotsRules, urlPath: string): boolean {
  if (robots.blockAll) return false;
  if (urlPath === '/robots.txt') return true;
  const path = urlPath.slice(0, MAX_PATH_LENGTH);
  let best: RobotsRule | undefined;
  for (const rule of robots.rules) {
    if (!globMatch(rule.pattern, rule.anchored, path)) continue;
    if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

/**
 * Reads a site's robots.txt through the safe fetcher.
 *  - no file, a client error, or an HTML "soft 404" page → no restrictions (the convention)
 *  - server error, timeout, oversize, or anything unsafe → block, to be conservative
 */
export async function loadRobots(origin: string, deps: FetchDeps = {}): Promise<RobotsRules> {
  const res = await safeFetch(`${origin}/robots.txt`, 'text', { ...deps, limits: { maxBytes: MAX_ROBOTS_BYTES, ...deps.limits } });
  if (res.ok) return parseRobots(res.body);
  if (res.reason === 'bad_content_type') return ALLOW_ALL; // many sites answer /robots.txt with their HTML shell
  if (res.reason === 'http_error' && res.status && res.status >= 400 && res.status < 500) return ALLOW_ALL;
  return { ...BLOCK_ALL, failure: res.reason };
}
