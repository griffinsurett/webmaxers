// backend/src/routes/health.ts
// Liveness and readiness in one: the service is only "ok" when its database answers, so a
// platform health check restarts or withholds traffic from an instance that cannot serve visitors.
import { Router } from 'express';
import { pingDatabase } from '../db/index.js';
import { isShuttingDown } from '../lifecycle.js';

export function createHealthRouter(ping: () => Promise<boolean> = () => pingDatabase(), shuttingDown: () => boolean = isShuttingDown) {
  const router = Router();
  router.get('/health', async (_req, res) => {
    // A draining instance reports not-ready so the platform routes new visitors elsewhere.
    if (shuttingDown()) return void res.status(503).json({ status: 'shutting_down', service: 'webmaxxers-blueprint-agent-backend', timestamp: new Date().toISOString() });
    const databaseOk = await ping();
    res.status(databaseOk ? 200 : 503).json({
      status: databaseOk ? 'ok' : 'degraded',
      service: 'webmaxxers-blueprint-agent-backend',
      database: databaseOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}

export const healthRouter = createHealthRouter();
