// src/components/BlueprintAgent/api.ts
// Client for the Blueprint Agent backend (backend/src/routes). Design rules:
//  - Never throws for expected failures: every call returns { ok, data | error }, so the UI
//    handles one shape. `error.kind` is stable and machine-readable; `error.message` is safe to show.
//  - Every request is bounded (timeouts) and cancellable (AbortSignal).
//  - Everything the server sends is validated before the UI sees it; a malformed reply becomes a
//    `bad_response` error, never a crash deep inside a component.
//  - The streaming calls (research, blueprint) survive a dropped connection: the server keeps
//    working and saves its result, so the client reconnects and picks it up.
//  - The browser sends only { sessionId, message } (and edit ops). It never sends a URL to fetch,
//    a stage, prices or slots: all state lives on the server.
import { createSseParser, SseOverflowError } from './sse';
import {
  STAGES,
  type BlueprintProgress,
  type ChatTurn,
  type EditOp,
  type EditResult,
  type ResearchProgress,
  type SessionSnapshot,
  type Stage,
  type WireBlueprint,
  type WireResearch,
} from './wire';
import { isSessionId } from './session';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Where the backend lives. Production builds must set PUBLIC_AGENT_API_URL; without it this
 * returns '' ("not configured") and the client makes no request at all, so the visitor is simply
 * offered the demo. The localhost fallback exists for development only.
 */
export const getAgentApiUrl = (): string => {
  const env = typeof import.meta !== 'undefined' ? (import.meta.env as Record<string, unknown> | undefined) : undefined;
  const fromEnv = env?.PUBLIC_AGENT_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, '');
  return env?.PROD ? '' : 'http://localhost:8000';
};

/** Mirrors the backend's MAX_MESSAGE_CHARS; the server enforces the real limit. */
export const MAX_MESSAGE_CHARS = 1000;

export const TIMEOUTS = {
  health: 4_000,
  start: 15_000,
  chat: 90_000, // a refine turn may call the model twice: the server allows up to 25s + 60s
  edit: 20_000,
  /** Server ceilings are 240s (research) and 180s (blueprint); leave room for the final save. */
  researchTotal: 270_000,
  blueprintTotal: 210_000,
  /** The server sends a keep-alive every 15s; three missed means the stream is dead. */
  streamIdle: 45_000,
} as const;

export interface ClientOptions {
  /** Cancel the call. Resolves with `{ ok:false, error:{ kind:'aborted' } }`. */
  signal?: AbortSignal;
  /** Test seams. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  timeouts?: Partial<Record<keyof typeof TIMEOUTS, number>>;
}

// ---------------------------------------------------------------------------
// Results and errors
// ---------------------------------------------------------------------------

export type ApiErrorKind =
  | 'offline' //      network failure / server unreachable
  | 'timeout' //      no answer in time
  | 'aborted' //      cancelled by the caller
  | 'busy' //         server at capacity, or still handling the previous message
  | 'in_progress' //  the job is already running (another tab / reconnect)
  | 'expired' //      the conversation no longer exists: start a new one
  | 'limit' //        conversation or network limit reached: not retryable
  | 'not_ready' //    asked for something this conversation hasn't reached
  | 'unavailable' //  assistant not configured / model down
  | 'invalid' //      the request was rejected as malformed
  | 'server' //       the job failed on the server
  | 'interrupted' //  the stream kept dropping and could not be resumed
  | 'bad_response'; // the reply was not what the protocol promises

export interface ApiError {
  kind: ApiErrorKind;
  /** Safe to show to the visitor as-is. */
  message: string;
  status?: number;
  /** Whether trying the same thing again can reasonably succeed. */
  retryable: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  offline: "I can't reach the assistant right now. Check your connection and try again.",
  timeout: 'That took longer than expected. Please try again.',
  aborted: 'Cancelled.',
  busy: 'The assistant is busy right now. Please try again in a moment.',
  in_progress: 'This is already being worked on. One moment.',
  expired: 'That conversation has expired. Please start a new one.',
  limit: 'This conversation has reached its limit. Please book a strategy call with the Webmaxxers team to continue.',
  not_ready: 'That is not ready yet.',
  unavailable: 'The assistant is temporarily unavailable. Please try again.',
  invalid: 'Something went wrong with that request. Please try again.',
  server: 'Something went wrong on our side. Please try again.',
  interrupted: 'The connection dropped before I finished. Please try again.',
  bad_response: 'I got an unexpected reply. Please try again.',
};

const RETRYABLE: Record<ApiErrorKind, boolean> = {
  offline: true, timeout: true, aborted: false, busy: true, in_progress: true, expired: false, limit: false,
  not_ready: false, unavailable: true, invalid: false, server: true, interrupted: true, bad_response: true,
};

export function apiError(kind: ApiErrorKind, message?: string, status?: number): ApiError {
  return { kind, message: message || DEFAULT_MESSAGES[kind], status, retryable: RETRYABLE[kind] };
}
const fail = (kind: ApiErrorKind, message?: string, status?: number): { ok: false; error: ApiError } =>
  ({ ok: false, error: apiError(kind, message, status) });
const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });

/** The server's own wording is only shown for the kinds where it is fixed, visitor-facing text. */
const SERVER_TEXT_KINDS = new Set<ApiErrorKind>(['limit', 'expired', 'not_ready', 'busy', 'in_progress']);

function kindFromResponse(status: number, code: unknown): ApiErrorKind {
  switch (code) {
    case 'message_limit': case 'ip_limit': return 'limit';
    case 'not_found': return 'expired';
    case 'not_ready': return 'not_ready';
    // Burst throttle (too many requests in a few seconds): retryable, unlike the daily caps above.
    case 'busy': case 'rate_limited': return 'busy';
    case 'in_progress': return 'in_progress';
    case 'unavailable': return 'unavailable';
    case 'invalid': return 'invalid';
  }
  if (status === 400 || status === 413 || status === 415) return 'invalid';
  if (status === 404) return 'expired';
  if (status === 409) return 'not_ready';
  if (status === 429) return 'limit'; // a 429 with no known code (e.g. from a proxy) is treated as a hard limit
  if (status === 503) return 'unavailable';
  return 'server';
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    const text = await res.text();
    body = text.length <= 20_000 ? JSON.parse(text) : null;
  } catch {
    /* not JSON (a proxy error page, for instance): fall back to the status */
  }
  const rec = isRecord(body) ? body : {};
  const kind = kindFromResponse(res.status, rec.code);
  const text = typeof rec.error === 'string' && rec.error.length > 0 && rec.error.length <= 300 ? rec.error : undefined;
  return apiError(kind, SERVER_TEXT_KINDS.has(kind) ? text : undefined, res.status);
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); signal?.removeEventListener('abort', done); resolve(); }
    signal?.addEventListener('abort', done, { once: true });
  });

function ctxOf(o: ClientOptions) {
  const base = (o.baseUrl ?? getAgentApiUrl()).replace(/\/+$/, '');
  return {
    base,
    // Not configured: fail like an unreachable server (offline, then the demo) without touching the network.
    fetchImpl: o.fetchImpl ?? (base
      ? (...a: Parameters<typeof fetch>) => fetch(...a)
      : () => Promise.reject(new TypeError('The assistant API address is not configured'))),
    sleep: o.sleep ?? defaultSleep,
    t: { ...TIMEOUTS, ...o.timeouts } as Record<keyof typeof TIMEOUTS, number>,
    signal: o.signal,
  };
}
type Ctx = ReturnType<typeof ctxOf>;

/** Abort `child` when `parent` aborts. Returns an unlink function. */
function link(parent: AbortSignal | undefined, child: AbortController): () => void {
  if (!parent) return () => {};
  if (parent.aborted) { child.abort(); return () => {}; }
  const on = () => child.abort();
  parent.addEventListener('abort', on, { once: true });
  return () => parent.removeEventListener('abort', on);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown, max = 200): string[] => (Array.isArray(v) ? v.filter(isStr).slice(0, max) : []);

/** One JSON request with a timeout. Returns the parsed body, or a classified error. */
async function postJson(path: string, body: unknown, timeoutMs: number, c: Ctx, method: 'POST' | 'GET' = 'POST'): Promise<ApiResult<unknown>> {
  if (c.signal?.aborted) return fail('aborted');
  const ctl = new AbortController();
  const unlink = link(c.signal, ctl);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  try {
    const res = await c.fetchImpl(`${c.base}${path}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, error: await errorFromResponse(res) };
    try {
      return ok(await res.json());
    } catch {
      return fail('bad_response', undefined, res.status);
    }
  } catch {
    if (c.signal?.aborted) return fail('aborted');
    return fail(timedOut ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

// ---------------------------------------------------------------------------
// Validation of server replies
// ---------------------------------------------------------------------------

export function parseBlueprint(v: unknown): WireBlueprint | null {
  if (!isRecord(v) || v.version !== 1) return null;
  const { summary, pages, articles, addons, pricing } = v;
  if (!isRecord(summary) || !isStr(summary.businessName)) return null;
  if (!Array.isArray(pages) || !Array.isArray(articles) || !Array.isArray(addons)) return null;
  if (pages.length > 100 || articles.length > 50 || addons.length > 50) return null;
  if (!pages.every((p) => isRecord(p) && isStr(p.id) && isStr(p.title) && isStr(p.classification) && typeof p.included === 'boolean' && isNum(p.estimatedCost))) return null;
  if (!articles.every((a) => isRecord(a) && isStr(a.id) && isStr(a.title) && typeof a.included === 'boolean')) return null;
  if (!addons.every((a) => isRecord(a) && isStr(a.sku) && isStr(a.name) && isNum(a.setupCost) && isNum(a.monthlyCost) && typeof a.included === 'boolean')) return null;
  if (!isRecord(pricing) || !isRecord(pricing.totals) || !isNum(pricing.totals.initialInvestment) || !isNum(pricing.totals.monthly)) return null;
  const wt = pricing.websiteType;
  if (!isRecord(wt) || !isNum(wt.basePrice) || !isStr(wt.name) || !isNum(wt.includedPages)) return null;
  const rec = v as unknown as WireBlueprint;
  // Everything the UI dereferences is normalized here, so a render can never throw on server data.
  const cleanSections = (sections: unknown) =>
    (Array.isArray(sections) ? sections : [])
      .filter((x): x is Record<string, unknown> => isRecord(x) && isStr(x.heading))
      .slice(0, 20)
      .map((x) => ({
        heading: x.heading as string,
        purpose: isStr(x.purpose) ? x.purpose : '',
        subsections: (Array.isArray(x.subsections) ? x.subsections : [])
          .filter((y): y is Record<string, unknown> => isRecord(y) && isStr(y.heading))
          .slice(0, 20)
          .map((y) => ({ heading: y.heading as string, content: isStr(y.content) ? y.content : '' })),
      }));
  return {
    ...rec,
    pages: rec.pages.map((p) => ({ ...p, sections: cleanSections(p.sections), evidence: strings(p.evidence), purpose: isStr(p.purpose) ? p.purpose : '', whyRecommended: isStr(p.whyRecommended) ? p.whyRecommended : '', primaryCta: isStr(p.primaryCta) ? p.primaryCta : '', slug: isStr(p.slug) ? p.slug : '', path: isStr(p.path) ? p.path : '' })),
    addons: rec.addons.map((a) => ({ ...a, evidence: strings(a.evidence), purpose: isStr(a.purpose) ? a.purpose : '', reason: isStr(a.reason) ? a.reason : '' })),
    articles: rec.articles.map((a) => ({ ...a, customerQuestion: isStr(a.customerQuestion) ? a.customerQuestion : '', estimatedCost: isNum(a.estimatedCost) ? a.estimatedCost : 0 })),
    pricing: { ...rec.pricing, extraPages: Array.isArray(rec.pricing.extraPages) ? rec.pricing.extraPages : [] },
    summary: {
      ...rec.summary,
      industry: isStr(rec.summary.industry) ? rec.summary.industry : '',
      primaryAudience: isStr(rec.summary.primaryAudience) ? rec.summary.primaryAudience : '',
      primaryGoal: isStr(rec.summary.primaryGoal) ? rec.summary.primaryGoal : '',
      recommendedStrategy: isStr(rec.summary.recommendedStrategy) ? rec.summary.recommendedStrategy : '',
    },
    facts: (Array.isArray(rec.facts) ? rec.facts : []).filter((f) => isRecord(f) && isStr(f.id) && isStr(f.text)),
    notices: strings(rec.notices),
    status: rec.status === 'partial' ? 'partial' : 'complete',
  };
}

export function parseChatTurn(v: unknown): ChatTurn | null {
  if (!isRecord(v) || !isSessionId(v.sessionId) || !isStr(v.reply)) return null;
  if (!isStr(v.stage) || !(STAGES as readonly string[]).includes(v.stage)) return null;
  let blueprint: WireBlueprint | null = null;
  if (v.blueprint != null) {
    blueprint = parseBlueprint(v.blueprint);
    if (!blueprint) return null;
  }
  const progress = isRecord(v.progress) && isNum(v.progress.required) && isNum(v.progress.filled)
    ? { required: v.progress.required, filled: v.progress.filled } : { required: 0, filled: 0 };
  const s = isRecord(v.slots) ? v.slots : {};
  return {
    sessionId: v.sessionId,
    reply: v.reply,
    quickReplies: strings(v.quickReplies, 8),
    notices: strings(v.notices, 8),
    locked: v.locked === true,
    stage: v.stage as Stage,
    progress,
    slots: {
      businessName: isStr(s.businessName) ? s.businessName : null,
      industry: isStr(s.industry) ? s.industry : null,
      services: strings(s.services, 20),
      serviceArea: isStr(s.serviceArea) ? s.serviceArea : null,
      primaryGoal: isStr(s.primaryGoal) ? s.primaryGoal : null,
      ownUrl: isStr(s.ownUrl) ? s.ownUrl : null,
      competitorUrls: strings(s.competitorUrls, 10),
      noWebsite: s.noWebsite === true,
    },
    blueprint,
  };
}

export function parseResearch(v: unknown): WireResearch | null {
  if (!isRecord(v) || !['complete', 'partial', 'failed'].includes(v.status as string) || !Array.isArray(v.sites)) return null;
  if (!v.sites.every((s) => isRecord(s) && isStr(s.key) && isStr(s.host) && isStr(s.name) && isStr(s.status))) return null;
  let findings: WireResearch['findings'] = null;
  if (v.findings != null) {
    const f = v.findings;
    if (!isRecord(f) || !Array.isArray(f.competitors)) return null;
    const claims = (x: unknown) => (Array.isArray(x) ? x : []).filter((c) => isRecord(c) && isStr(c.point)) as never[];
    findings = {
      competitors: (f.competitors as unknown[]).filter((c) => isRecord(c) && isStr(c.name) && isStr(c.host)).map((c) => ({
        ...(c as Record<string, unknown>), whatWorks: claims((c as Record<string, unknown>).whatWorks), gaps: claims((c as Record<string, unknown>).gaps),
      })) as never,
      patterns: claims(f.patterns),
      ownSite: isRecord(f.ownSite) ? (f.ownSite as never) : null,
      opportunities: claims(f.opportunities).map((o: Record<string, unknown>) => ({ ...o, support: isStr(o.support) ? o.support : '' })) as never,
    };
  }
  return { status: v.status as WireResearch['status'], notices: strings(v.notices), sites: v.sites as never, findings };
}

export function parseSnapshot(v: unknown): SessionSnapshot | null {
  // Reuse the chat-turn validation for the shared fields (session id, stage, slots, blueprint).
  if (!isRecord(v) || !Array.isArray(v.messages)) return null;
  const turn = parseChatTurn({ ...v, reply: '' });
  if (!turn) return null;
  const messages = v.messages
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => isRecord(m) && (m.role === 'user' || m.role === 'assistant') && isStr(m.content))
    .slice(-100);
  let research: WireResearch | null = null;
  if (v.research != null) {
    research = parseResearch(v.research);
    if (!research) return null;
  }
  return {
    sessionId: turn.sessionId, stage: turn.stage, progress: turn.progress, slots: turn.slots, locked: turn.locked,
    quickReplies: turn.quickReplies, messages, research, blueprint: turn.blueprint,
  };
}

export function parseEditResult(v: unknown): EditResult | null {
  if (!isRecord(v)) return null;
  const blueprint = parseBlueprint(v.blueprint);
  if (!blueprint || !isStr(v.estimate)) return null;
  return { blueprint, changes: strings(v.changes), refused: strings(v.refused), notice: isStr(v.notice) ? v.notice : null, estimate: v.estimate };
}

function parseResearchEvent(name: string, d: unknown): ResearchProgress | null {
  if (!isRecord(d)) return null;
  if (name === 'step' && isStr(d.message) && ['discovering', 'reading', 'analyzing'].includes(d.step as string)) return { type: 'step', step: d.step as never, message: d.message };
  if (name === 'competitors' && Array.isArray(d.items)) {
    const items = d.items.filter((i): i is Record<string, unknown> => isRecord(i) && isStr(i.name) && isStr(i.host))
      .map((i) => ({ name: i.name as string, host: i.host as string, source: i.source === 'visitor' ? ('visitor' as const) : ('discovered' as const), reason: isStr(i.reason) ? i.reason : undefined }));
    return { type: 'competitors', items };
  }
  if (name === 'site' && isStr(d.host) && ['reading', 'done', 'failed'].includes(d.status as string)) {
    return { type: 'site', host: d.host, role: d.role === 'own' ? 'own' : 'competitor', status: d.status as never, pages: isNum(d.pages) ? d.pages : undefined, note: isStr(d.note) ? d.note : undefined };
  }
  return null;
}

function parseBlueprintEvent(name: string, d: unknown): BlueprintProgress | null {
  if (!isRecord(d)) return null;
  if (name === 'step' && isStr(d.message) && ['retrieving', 'structuring', 'writing', 'pricing'].includes(d.step as string)) return { type: 'step', step: d.step as never, message: d.message };
  if (name === 'page' && isNum(d.done) && isNum(d.total) && d.total > 0) return { type: 'page', done: Math.max(0, Math.min(d.done, d.total)), total: d.total };
  return null;
}

// ---------------------------------------------------------------------------
// Public API: plain requests
// ---------------------------------------------------------------------------

export async function checkBackendHealth(options: ClientOptions = {}): Promise<boolean> {
  const c = ctxOf(options);
  const r = await postJson('/health', null, c.t.health, c, 'GET');
  return r.ok;
}

/** Begin a conversation. Returns the greeting turn. */
export async function startSession(options: ClientOptions = {}): Promise<ApiResult<ChatTurn>> {
  const c = ctxOf(options);
  const r = await postJson('/api/chat/start', {}, c.t.start, c);
  if (!r.ok) return r;
  const turn = parseChatTurn(r.data);
  return turn ? ok(turn) : fail('bad_response');
}

/** One visitor message. In the refine stage the reply may carry an updated blueprint. */
export async function sendChatMessage(sessionId: string, message: string, options: ClientOptions = {}): Promise<ApiResult<ChatTurn>> {
  if (!isSessionId(sessionId)) return fail('expired');
  const text = message.trim();
  if (!text) return fail('invalid', 'Please type a message first.');
  if (text.length > MAX_MESSAGE_CHARS) return fail('invalid', `Please keep your message under ${MAX_MESSAGE_CHARS} characters.`);
  const c = ctxOf(options);
  const r = await postJson('/api/chat', { sessionId, message: text }, c.t.chat, c);
  if (!r.ok) return r;
  const turn = parseChatTurn(r.data);
  return turn ? ok(turn) : fail('bad_response');
}

/** Pick a conversation back up after a refresh. `expired` means it is gone: start a new one. */
export async function restoreSession(sessionId: string, options: ClientOptions = {}): Promise<ApiResult<SessionSnapshot>> {
  if (!isSessionId(sessionId)) return fail('expired');
  const c = ctxOf(options);
  const r = await postJson(`/api/session/${sessionId}`, null, c.t.start, c, 'GET');
  if (!r.ok) return r;
  const snap = parseSnapshot(r.data);
  return snap ? ok(snap) : fail('bad_response');
}

const MAX_EDIT_OPS = 20;

/** Toggle pages, add-ons or articles. The server re-prices; the returned blueprint is the truth. */
export async function editBlueprint(sessionId: string, ops: EditOp[], options: ClientOptions = {}): Promise<ApiResult<EditResult>> {
  if (!isSessionId(sessionId)) return fail('expired');
  if (ops.length === 0 || ops.length > MAX_EDIT_OPS) return fail('invalid');
  const body = ops.map((o) => {
    switch (o.op) {
      case 'remove_page': case 'restore_page': return { op: o.op, id: o.id };
      case 'toggle_addon': return { op: o.op, sku: o.sku, on: o.on };
      case 'toggle_article': return { op: o.op, id: o.id, on: o.on };
    }
  });
  const c = ctxOf(options);
  const r = await postJson('/api/blueprint/edit', { sessionId, ops: body }, c.t.edit, c);
  if (!r.ok) return r;
  const out = parseEditResult(r.data);
  return out ? ok(out) : fail('bad_response');
}

// ---------------------------------------------------------------------------
// Public API: streaming jobs
// ---------------------------------------------------------------------------

type Attempt<R> =
  | { kind: 'done'; data: R }
  | { kind: 'failed'; error: ApiError }
  | { kind: 'interrupted' }
  | { kind: 'http'; error: ApiError };

interface JobSpec<E, R> {
  path: string;
  parseEvent: (name: string, data: unknown) => E | null;
  parseDone: (data: unknown) => R | null;
  onEvent?: (e: E) => void;
  totalMs: number;
}

const RECONNECT_BACKOFF_MS = [1_500, 3_000, 5_000];

/**
 * Runs a server job over SSE. The server keeps working if the connection drops and saves the
 * result (a repeat call replays it), so on a dropped stream we reconnect: a finished job replays
 * immediately; one still running answers "in_progress" and we wait and ask again.
 */
async function runJob<E, R>(sessionId: string, spec: JobSpec<E, R>, c: Ctx): Promise<ApiResult<R>> {
  if (!isSessionId(sessionId)) return fail('expired');
  if (c.signal?.aborted) return fail('aborted');

  const overall = new AbortController();
  const unlink = link(c.signal, overall);
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; overall.abort(); }, spec.totalMs);
  const stopped = (): ApiResult<R> | null => {
    if (c.signal?.aborted) return fail('aborted');
    if (timedOut) return fail('timeout');
    return null;
  };

  try {
    let reconnects = 0;
    let connected = false; // once a stream has opened, transient failures are worth retrying
    for (;;) {
      const attempt = await readStream(sessionId, spec, c, overall.signal);
      const halted = stopped();
      if (halted) return halted;

      if (attempt.kind === 'done') return ok(attempt.data);
      if (attempt.kind === 'failed') return { ok: false, error: attempt.error };

      if (attempt.kind === 'interrupted') connected = true;
      if (attempt.kind === 'http') {
        // Another run is still going (or the server is momentarily full): wait and ask again.
        // After a dropped stream, a flaky network or a restarting server is also worth waiting out.
        const waitable = ['in_progress', 'busy'].includes(attempt.error.kind)
          || (connected && ['offline', 'unavailable', 'server'].includes(attempt.error.kind));
        if (!waitable) return { ok: false, error: attempt.error };
      }
      // Interrupted, or still running elsewhere: back off, then reconnect.
      const delay = RECONNECT_BACKOFF_MS[Math.min(reconnects, RECONNECT_BACKOFF_MS.length - 1)];
      reconnects++;
      await c.sleep(delay, overall.signal);
      const after = stopped();
      if (after) return after;
    }
  } finally {
    clearTimeout(deadline);
    unlink();
  }
}

async function readStream<E, R>(sessionId: string, spec: JobSpec<E, R>, c: Ctx, overallSignal: AbortSignal): Promise<Attempt<R>> {
  const ctl = new AbortController();
  const unlink = link(overallSignal, ctl);
  let idleHit = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(idle);
    idle = setTimeout(() => { idleHit = true; ctl.abort(); }, c.t.streamIdle);
  };

  let terminal = null as Attempt<R> | null; // assigned inside the parser callback
  try {
    arm(); // also covers a server that accepts the connection but never answers
    let res: Response;
    try {
      res = await c.fetchImpl(`${c.base}${spec.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ sessionId }),
        cache: 'no-store',
        signal: ctl.signal,
      });
    } catch {
      return overallSignal.aborted ? { kind: 'interrupted' } : idleHit ? { kind: 'interrupted' } : { kind: 'http', error: apiError('offline') };
    }

    if (!res.ok) return { kind: 'http', error: await errorFromResponse(res) };
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/event-stream') || !res.body) {
      await res.body?.cancel().catch(() => {});
      return { kind: 'failed', error: apiError('bad_response', undefined, res.status) };
    }

    const decoder = new TextDecoder('utf-8');
    const parser = createSseParser(({ event, data }) => {
      if (terminal) return;
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { return; } // a garbled event is skipped, not fatal
      if (event === 'done') {
        const result = spec.parseDone(parsed);
        terminal = result ? { kind: 'done', data: result } : { kind: 'failed', error: apiError('bad_response') };
      } else if (event === 'error') {
        // The server released the job: a retry would start a fresh run, so report instead of looping.
        terminal = { kind: 'failed', error: apiError('server', isRecord(parsed) && isStr(parsed.message) && parsed.message.length <= 300 ? parsed.message : undefined) };
      } else {
        const e = spec.parseEvent(event, parsed);
        if (e && spec.onEvent) {
          try { spec.onEvent(e); } catch (err) { console.error('[BlueprintAgent] progress handler failed', err); }
        }
      }
    });

    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        parser.push(decoder.decode(value, { stream: true }));
        if (terminal) break;
      }
      if (!terminal) parser.push(decoder.decode());
    } catch (err) {
      if (err instanceof SseOverflowError) return { kind: 'failed', error: apiError('bad_response') };
      return { kind: 'interrupted' };
    } finally {
      parser.end();
      reader.cancel().catch(() => {});
    }
    return terminal ?? { kind: 'interrupted' };
  } finally {
    clearTimeout(idle);
    unlink();
  }
}

/** Run the competitor research. Resolves with the finished (or replayed) research record. */
export function streamResearch(
  sessionId: string, onProgress?: (e: ResearchProgress) => void, options: ClientOptions = {},
): Promise<ApiResult<WireResearch>> {
  const c = ctxOf(options);
  return runJob(sessionId, { path: '/api/research', parseEvent: parseResearchEvent, parseDone: parseResearch, onEvent: onProgress, totalMs: c.t.researchTotal }, c);
}

/** Build the blueprint. Resolves with the finished (or replayed) blueprint. */
export function streamBlueprint(
  sessionId: string, onProgress?: (e: BlueprintProgress) => void, options: ClientOptions = {},
): Promise<ApiResult<WireBlueprint>> {
  const c = ctxOf(options);
  return runJob(sessionId, { path: '/api/blueprint', parseEvent: parseBlueprintEvent, parseDone: parseBlueprint, onEvent: onProgress, totalMs: c.t.blueprintTotal }, c);
}
