// backend/src/app.ts
// The Express app, separate from process start-up so it can be built in tests.
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config/index.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestContext } from './middleware/requestContext.js';
import { log } from './services/log/logger.js';
import { POLICIES, rateLimit } from './services/ratelimit/limiter.js';
import { healthRouter } from './routes/health.js';
import { sessionRouter } from './routes/session.js';
import { chatRouter } from './routes/chat.js';
import { blueprintRouter } from './routes/blueprint.js';
import { auditRouter } from './routes/audit.js';
import { pricingRouter } from './routes/pricing.js';
import { kbRouter } from './routes/kb.js';
import { metricsRouter } from './routes/metrics.js';
import { researchRouter } from './routes/research.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  // First, so every later log line (and background work started by a request) carries its id.
  app.use(requestContext);
  app.use(corsMiddleware);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Health must never be throttled (platform probes), so it is mounted before the limiters.
  app.use(healthRouter);

  // Burst throttling runs before the body is parsed, so a throttled client costs almost nothing.
  // The general limit covers every /api request; the endpoint limits below add to it.
  app.use('/api', rateLimit(POLICIES.general));
  app.post('/api/chat/start', rateLimit(POLICIES.chatStart));
  app.post('/api/chat', rateLimit(POLICIES.chat));
  app.post('/api/research', rateLimit(POLICIES.research));
  app.post('/api/blueprint', rateLimit(POLICIES.blueprint));
  app.post('/api/blueprint/edit', rateLimit(POLICIES.blueprintEdit));
  app.use('/api/kb', rateLimit(POLICIES.admin));
  app.use('/api/admin', rateLimit(POLICIES.admin));

  app.use(express.json({ limit: '32kb' }));

  app.use(pricingRouter);
  app.use(kbRouter);
  app.use(metricsRouter);
  app.use(chatRouter);
  app.use(sessionRouter);
  app.use(researchRouter);
  app.use(blueprintRouter);
  app.use(auditRouter);

  // Express 5 forwards async errors here.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // body-parser (bad JSON, payload too large) and CORS rejections carry a 4xx status.
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
    if (status >= 500) log.error('unhandled error', { err });
    if (!res.headersSent) {
      res.status(status >= 400 && status < 500 ? status : 500).json({ error: status < 500 ? 'Invalid request.' : 'Internal server error' });
    }
  });

  return app;
}
