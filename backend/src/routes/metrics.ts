// backend/src/routes/metrics.ts
// GET /api/admin/metrics: counters and timings for this instance (requests, jobs, model calls,
// throttling). Admin-only; contains no visitor data.
import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { breakerFor, PROFILES, type LlmProfile } from '../services/llm/openai.js';
import { metrics } from '../services/log/metrics.js';

export const metricsRouter = Router();

metricsRouter.get('/api/admin/metrics', requireAdmin, (_req, res) => {
  const circuits = Object.fromEntries((Object.keys(PROFILES) as LlmProfile[]).map((p) => [p, breakerFor(p).state]));
  res.json({ ...metrics.snapshot(), circuits });
});
