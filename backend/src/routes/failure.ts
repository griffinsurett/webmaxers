// backend/src/routes/failure.ts
// One way to answer a request whose model call failed: classify it, log it once, and tell the
// visitor something accurate and retryable, never provider details.
import type { Response } from 'express';
import { classifyLlmError, visitorFailure } from '../services/llm/errors.js';
import { log } from '../services/log/logger.js';

export function sendModelFailure(res: Response, err: unknown, what: string): void {
  const failure = classifyLlmError(err);
  // An unclassified error is more likely our bug than the provider's.
  log[failure.kind === 'unknown' ? 'error' : 'warn'](`${what} failed`, { kind: failure.kind, err: failure });
  const visitor = visitorFailure(failure);
  if (visitor.retryAfter) res.setHeader('Retry-After', String(visitor.retryAfter));
  res.status(visitor.status).json({ error: visitor.error, code: visitor.code });
}
