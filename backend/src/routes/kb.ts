// backend/src/routes/kb.ts
// Admin-only knowledge base routes. Disabled unless ADMIN_TOKEN is set.
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { hasActivePricingUploads } from '../services/kbadmin/store.js';
import { ragService } from '../services/rag/index.js';

export const kbRouter = Router();

/** POST /api/kb/sync: re-seed catalog and re-embed chunks from backend/kb/. */
kbRouter.post('/api/kb/sync', requireAdmin, async (req, res) => {
  // Once an admin has published prices from an upload, the database is the source of truth. Re-importing the
  // seed files would silently put the old demo prices back, so it needs an explicit "force".
  const force = (req.body as { force?: unknown } | undefined)?.force === true;
  if (!force && (await hasActivePricingUploads())) {
    return void res.status(409).json({
      error: 'Prices were published from an upload. Syncing from the seed files would replace them. Send {"force": true} only if that is what you want.',
      code: 'uploads_published',
    });
  }
  res.json(await ragService.syncKnowledgeBase());
});

/** POST /api/kb/search: inspect what RAG retrieves for a query. */
kbRouter.post('/api/kb/search', requireAdmin, async (req, res) => {
  const parsed = z
    .object({ query: z.string().min(1).max(500), matchCount: z.number().int().min(1).max(20).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'query is required' });
  res.json(await ragService.searchKnowledgeBase(parsed.data.query, parsed.data.matchCount));
});
