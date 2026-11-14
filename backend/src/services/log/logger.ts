// backend/src/services/log/logger.ts
// Structured (one JSON object per line) logging with a request id and redaction.
//
// Rules this enforces, because logs outlive the conversation and are read by more people:
//   - no secrets (API keys, tokens, auth headers),
//   - no visitor message text, model prompts or replies,
//   - no session ids (the only credential a visitor has).
// Fields with those names are replaced outright, and every remaining string is scrubbed for key,
// bearer-token, session-id and email shapes, so a stray error message cannot smuggle them in.
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from '../../config/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// ---------------------------------------------------------------------------
// Request context: the request id follows the request into background work.
// ---------------------------------------------------------------------------

interface Context { requestId: string }
const storage = new AsyncLocalStorage<Context>();

export const runWithRequestId = <T>(requestId: string, fn: () => T): T => storage.run({ requestId }, fn);
export const currentRequestId = (): string | undefined => storage.getStore()?.requestId;

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const SENSITIVE_KEY = /^(message|messages|content|text|prompt|reply|history|query|input|body|headers|authorization|cookie|set-cookie|api[-_]?key|token|access[-_]?token|password|secret|session[-_]?id|session)$/i;
const REDACTED = '[redacted]';
const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;

const SCRUBBERS: [RegExp, string][] = [
  [/\bsk-[A-Za-z0-9_*-]{6,}/g, '[key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [token]'],
  // Supabase API keys are JWTs (three base64url parts).
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
];

export function scrubString(value: string): string {
  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  for (const [pattern, replacement] of SCRUBBERS) out = out.replace(pattern, replacement);
  return out;
}

/** An error reduced to what is useful and safe: its type, status and a scrubbed description. */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & { status?: unknown; code?: unknown; kind?: unknown; issues?: unknown };
    const out: Record<string, unknown> = { name: e.name, detail: scrubString(e.message) };
    if (typeof e.status === 'number') out.status = e.status;
    if (typeof e.code === 'string' || typeof e.code === 'number') out.code = e.code;
    if (typeof e.kind === 'string') out.kind = e.kind;
    // Validation failures: which fields failed, never the offending values.
    if (Array.isArray(e.issues)) {
      out.issues = e.issues.slice(0, MAX_ITEMS).map((i) => ({
        path: Array.isArray(i?.path) ? i.path.join('.') : undefined,
        code: typeof i?.code === 'string' ? i.code : undefined,
      }));
    }
    return out;
  }
  if (Array.isArray(err) && err.every((i) => i && typeof i === 'object' && 'code' in i && 'path' in i)) {
    return { name: 'ValidationIssues', issues: sanitize(err.map((i) => ({ path: Array.isArray(i.path) ? i.path.join('.') : undefined, code: i.code }))) };
  }
  return { name: 'NonError', detail: scrubString(typeof err === 'string' ? err : JSON.stringify(sanitize(err)) ?? String(err)) };
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) return serializeError(value);
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value).slice(0, MAX_ITEMS * 2)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
  }
  return undefined; // functions, symbols
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export type Fields = Record<string, unknown>;
export type Sink = (level: LogLevel, line: string) => void;

const stdoutSink: Sink = (level, line) => {
  (ORDER[level] >= ORDER.warn ? process.stderr : process.stdout).write(`${line}\n`);
};

/** Test hook: route the default logger's output somewhere else (null restores stdout/stderr). */
let override: Sink | null = null;
export const captureLogs = (sink: Sink | null): void => { override = sink; };
const defaultSink: Sink = (level, line) => (override ?? stdoutSink)(level, line);

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
}

export function createLogger(options: { level?: () => string; sink?: Sink; now?: () => Date } = {}): Logger {
  const levelOf = options.level ?? (() => config.logLevel);
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());

  const emit = (level: LogLevel, msg: string, fields?: Fields) => {
    const threshold = levelOf();
    if (threshold === 'silent' || ORDER[level] < (ORDER[threshold as LogLevel] ?? ORDER.info)) return;
    const requestId = currentRequestId();
    // Reserved keys come from us only: a field can never overwrite (or invent) them.
    const { ts: _ts, level: _level, msg: _msg, requestId: _requestId, ...safe } = sanitize(fields ?? {}) as Fields;
    const record = { ...safe, ts: now().toISOString(), level, msg: scrubString(msg), ...(requestId ? { requestId } : {}) };
    let line: string;
    try { line = JSON.stringify(record); } catch { line = JSON.stringify({ ts: record.ts, level, msg: record.msg, logError: 'unserializable fields' }); }
    sink(level, line);
  };

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
  };
}

export const log = createLogger();
