// backend/src/routes/pricing.ts
import { Router } from 'express';
import { z } from 'zod';
import { ragService } from '../services/rag/index.js';
import { PricingError, pricingService } from '../services/pricing/index.js';

export const pricingRouter = Router();

const selection = z.object({
  id: z.string().min(1).max(120),
  sku: z.string().min(1).max(80),
  title: z.string().max(200).optional(),
  included: z.boolean(),
  classification: z.enum(['core', 'recommended', 'future']).optional(),
});

const priceRequest = z.object({
  websiteTypeSku: z.string().min(1).max(80),
  pages: z.array(selection).max(100),
  content: z.array(selection).max(100).optional(),
  addons: z.array(selection).max(50).optional(),
});

/** GET /api/catalog: active pricing catalog (lets the UI price toggles instantly). */
pricingRouter.get('/api/catalog', async (_req, res) => {
  const catalog = await ragService.getCatalog();
  res.json({ version: catalog[0]?.version ?? null, items: catalog });
});

/** POST /api/price: authoritative deterministic price breakdown for a selection. */
pricingRouter.post('/api/price', async (req, res) => {
  const parsed = priceRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid price request', issues: parsed.error.issues });
  }
  try {
    const catalog = await ragService.getCatalog();
    res.json(pricingService.calculate(parsed.data, catalog));
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ error: err.message });
    throw err;
  }
});
