#!/usr/bin/env node
// Checks that the website is wired to the Blueprint Agent backend, so the live site cannot quietly
// ship showing "assistant unavailable". It reads configuration only: no network, no secrets.
//
//   npm run check:agent-wiring                 report problems as warnings (exit 0)
//   npm run check:agent-wiring -- --strict     fail (exit 1) on any problem: use before a release
//   npm run check:agent-wiring -- --url=https://api.example.com   check a URL instead of the env var
//
// What must agree (see backend/DEPLOY.md, section 5):
//   1. PUBLIC_AGENT_API_URL is set for the site build and points at the backend over https.
//   2. vercel.json's page Content-Security-Policy lists that origin in connect-src, or the browser
//      blocks every request to it.
//   3. The backend's CORS_ORIGINS includes the site origin (verified by `npm run smoke` in backend/).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

/** The CSP header applied to every page (the "/(.*)" rule). */
export function pageCsp(vercelJson) {
  const rule = (vercelJson.headers ?? []).find((h) => h.source === '/(.*)');
  return rule?.headers?.find((h) => h.key === 'Content-Security-Policy')?.value ?? null;
}

/** Whether a CSP source expression allows the origin (exact match, or a `*.host` wildcard). */
export function sourceAllows(source, origin) {
  const url = new URL(origin);
  const s = source.trim();
  if (s === origin || s === `${url.protocol}//${url.host}`) return true;
  const wild = /^(?:https?:\/\/)?\*\.(.+)$/.exec(s);
  if (wild && url.hostname.endsWith(`.${wild[1]}`)) return !/^https?:/.test(s) || s.startsWith(`${url.protocol}//`);
  return false;
}

/**
 * @param {{ url?: string, vercelJson: object }} input
 * @returns {{ problems: string[], origin: string | null }}
 */
export function checkWiring({ url, vercelJson }) {
  const problems = [];
  if (!url || !url.trim()) {
    problems.push('PUBLIC_AGENT_API_URL is not set: a production build will not try to reach any backend and will offer only the demo.');
    return { problems, origin: null };
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    problems.push(`PUBLIC_AGENT_API_URL is not a valid URL: "${url}"`);
    return { problems, origin: null };
  }
  if (!/^https?:$/.test(parsed.protocol)) problems.push(`PUBLIC_AGENT_API_URL must start with https:// (got ${parsed.protocol})`);
  else if (parsed.protocol !== 'https:') problems.push('PUBLIC_AGENT_API_URL must use https: the site is served over https and browsers block mixed content.');
  if (LOCAL.test(parsed.hostname)) problems.push(`PUBLIC_AGENT_API_URL points at ${parsed.hostname}: a visitor's browser cannot reach that.`);
  if (parsed.search || parsed.hash) problems.push('PUBLIC_AGENT_API_URL must not include a query string or fragment.');
  if (/\/$/.test(url.trim()) === false && parsed.pathname !== '/') problems.push('PUBLIC_AGENT_API_URL should be the origin only (no path), e.g. https://api.example.com');

  const csp = pageCsp(vercelJson);
  if (!csp) {
    problems.push('vercel.json has no page Content-Security-Policy to check.');
  } else {
    const connect = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src'));
    const sources = connect ? connect.split(/\s+/).slice(1) : [];
    if (!sources.some((s) => sourceAllows(s, parsed.origin))) {
      problems.push(`vercel.json: the page Content-Security-Policy connect-src does not allow ${parsed.origin}. The browser would block every request to the backend. Add "${parsed.origin}" to connect-src on the "/(.*)" rule.`);
    }
  }
  return { problems, origin: parsed.origin };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const urlArg = args.find((a) => a.startsWith('--url='))?.slice(6);
  const vercelJson = JSON.parse(readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'));
  const { problems, origin } = checkWiring({ url: urlArg ?? process.env.PUBLIC_AGENT_API_URL, vercelJson });

  if (problems.length === 0) {
    console.log(`Agent wiring OK: ${origin} is configured and allowed by the Content-Security-Policy.`);
    console.log('Also confirm the backend allows this site: npm run smoke -- <backend-url> <site-origin> (in backend/).');
    return;
  }
  for (const p of problems) console.log(`${strict ? 'ERROR' : 'WARN '} ${p}`);
  process.exit(strict ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
