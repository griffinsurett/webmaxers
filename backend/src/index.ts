// backend/src/index.ts
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { checkConfig } from './config/validate.js';
import { migrate, pool } from './db/index.js';
import { markShuttingDown } from './lifecycle.js';
import { log } from './services/log/logger.js';
import { startRateLimitCleanup } from './services/ratelimit/limiter.js';
import { seedKnowledgeBaseIfEmpty, ragService } from './services/rag/index.js';
import { OpenAiPricingExtractor } from './services/kbadmin/pricingExtract.js';
import { createSupabaseStorage, startKnowledgeSync } from './services/kbadmin/knowledgeSync.js';

const MIGRATE_ATTEMPTS = 10;
const MIGRATE_RETRY_MS = 3000;
/** How long in-flight requests and jobs get to finish after a stop signal. */
const SHUTDOWN_GRACE_MS = 25_000;

/** Applies the schema before serving. The database may still be starting, so retry for a while. */
async function prepareDatabase(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate();
      return;
    } catch (err) {
      if (attempt >= MIGRATE_ATTEMPTS) throw err;
      log.warn('database not ready', { attempt, of: MIGRATE_ATTEMPTS, err });
      await new Promise((resolve) => setTimeout(resolve, MIGRATE_RETRY_MS));
    }
  }
}

function installShutdown(server: Server, stopCleanup: () => void): void {
  let started = false;
  const shutdown = (signal: string) => {
    if (started) return;
    started = true;
    log.info('shutting down', { signal, graceMs: SHUTDOWN_GRACE_MS });
    markShuttingDown(); // /health now answers 503 so the platform stops routing here
    stopCleanup();
    const force = setTimeout(() => { log.warn('grace period over; exiting with work in flight'); process.exit(1); }, SHUTDOWN_GRACE_MS);
    force.unref();
    server.close(async () => {
      await pool.end().catch(() => {});
      log.info('shutdown complete');
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function main() {
  const report = checkConfig(process.env);
  for (const warning of report.warnings) log.warn(warning);
  if (report.errors.length > 0) {
    for (const error of report.errors) log.error(`configuration error: ${error}`);
    process.exit(1);
  }

  await prepareDatabase();
  const seeded = await seedKnowledgeBaseIfEmpty();
  if (seeded !== 'already_seeded') log.info('knowledge base loaded on first start', { result: seeded });
  const stopRateCleanup = startRateLimitCleanup();
  // Pricing and guidance files dropped into the Supabase "knowledge" bucket are picked up here.
  let stopKnowledgeSync = () => {};
  if (config.supabaseUrl && config.supabaseServiceKey) {
    stopKnowledgeSync = startKnowledgeSync({
      storage: createSupabaseStorage({ url: config.supabaseUrl, serviceKey: config.supabaseServiceKey, bucket: config.kbBucket }),
      extractor: new OpenAiPricingExtractor(),
      getCatalog: () => ragService.getCatalog(),
      hasModel: () => Boolean(config.openaiApiKey),
    });
    log.info('watching the Supabase storage bucket for knowledge files', { bucket: config.kbBucket, everySeconds: config.kbPollSeconds });
  }
  const stopCleanup = () => { stopRateCleanup(); stopKnowledgeSync(); };

  const server = createApp().listen(config.port, () => {
    log.info('backend listening', { port: config.port, env: config.nodeEnv, origins: config.corsOrigins });
  });
  installShutdown(server, stopCleanup);
}

main().catch((err) => {
  log.error('failed to start', { err });
  process.exit(1);
});
