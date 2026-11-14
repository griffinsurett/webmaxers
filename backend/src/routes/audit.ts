// backend/src/routes/audit.ts
// Phase 4. Intentionally NOT a public "scrape any URL" endpoint: research will run only on
// the verified URLs stored in a server-side session. Disabled until then.
import { Router } from 'express';

export const auditRouter = Router();

auditRouter.post('/api/audit', (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet.' });
});
