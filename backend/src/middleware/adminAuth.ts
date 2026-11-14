// backend/src/middleware/adminAuth.ts
// Bearer-token guard for operator routes. The routes do not exist at all unless ADMIN_TOKEN is set.
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!config.adminToken) return res.status(404).end();
  const given = Buffer.from(req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(config.adminToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
