// backend/src/middleware/requestContext.ts
// Gives every request an id (returned as X-Request-Id and attached to all log lines, including
// background work the request started) and writes one access-log line per request.
import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { log, runWithRequestId } from '../services/log/logger.js';
import { metrics } from '../services/log/metrics.js';

const INBOUND_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const newRequestId = () => randomBytes(8).toString('hex');

export const requestContext: RequestHandler = (req, res, next) => {
  const inbound = req.get('x-request-id');
  const requestId = inbound && INBOUND_ID.test(inbound) ? inbound : newRequestId();
  res.setHeader('X-Request-Id', requestId);
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    // The route pattern (/api/session/:id), never the real URL: paths and queries can carry ids.
    const route = req.route ? `${req.baseUrl}${req.route.path}` : '(unmatched)';
    metrics.inc('http_requests_total', { route, status: `${Math.floor(res.statusCode / 100)}xx` });
    const level = route === '/health' ? 'debug' : res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    runWithRequestId(requestId, () => log[level]('request', { method: req.method, route, status: res.statusCode, ms: Math.round(ms) }));
  });

  runWithRequestId(requestId, next);
};
