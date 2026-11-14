// backend/src/middleware/cors.ts
import cors from 'cors';
import { config } from '../config/index.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl) or if origin is in whitelist
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // A 403 (not a bare Error) so the app's error handler answers 4xx instead of logging a 500.
      callback(Object.assign(new Error(`Origin ${origin} not allowed by CORS`), { status: 403 }));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  // Lets the site read how long to wait after a 429/503, and quote the id when reporting a problem.
  exposedHeaders: ['Retry-After', 'X-Request-Id'],
});

