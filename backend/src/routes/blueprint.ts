// backend/src/routes/blueprint.ts
// POST /api/blueprint { sessionId } → SSE progress, then the finished blueprint.
// Same rules as research: runs only from server-side session state once the stage machine is
// at "blueprint", one generation per session (atomic claim), replay from storage, capped
// concurrency, and a hard time ceiling so a stuck run cannot hold a slot.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { OfflineBlueprintLlm, OpenAiBlueprintLlm } from '../services/blueprint/llm.js';
import { generateBlueprint, repriceBlueprint, type BlueprintEvent } from '../services/blueprint/generate.js';
import { applyOps, estimateLine, type Op } from '../services/blueprint/refine.js';
import type { Blueprint, BlueprintLlm } from '../services/blueprint/types.js';
import type { KbSearch } from '../services/blueprint/retrieval.js';
import { log } from '../services/log/logger.js';
import { metrics } from '../services/log/metrics.js';
import { ragService } from '../services/rag/index.js';
import {
  SessionError, claimBlueprint, editBlueprint, loadBlueprintView, releaseBlueprint, saveBlueprint,
} from '../services/conversation/sessions.js';
import type { CatalogItem } from '../types/index.js';
import { createSse } from './sse.js';

const body = z.object({ sessionId: z.string().uuid() }).strict();

// Manual edits (UI toggles): a deterministic subset of the refine operations, no model involved.
const editBody = z.object({
  sessionId: z.string().uuid(),
  ops: z.array(z.object({
    op: z.enum(['remove_page', 'restore_page', 'toggle_addon', 'toggle_article']),
    id: z.string().max(60).nullish(),
    sku: z.string().max(40).nullish(),
    on: z.boolean().nullish(),
  }).strict()).min(1).max(20),
}).strict();

export const MAX_CONCURRENT_BLUEPRINTS = 3;
export const BLUEPRINT_TIMEOUT_MS = 180_000;
let active = 0;

export interface BlueprintRouteDeps {
  llm: BlueprintLlm;
  search: KbSearch;
  getCatalog: () => Promise<CatalogItem[]>;
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: NodeJS.Timeout;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => { onTimeout?.(); reject(new Error('blueprint timed out')); }, ms); });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

export function createBlueprintRouter(
  deps: BlueprintRouteDeps, options: { requireKey: boolean; timeoutMs?: number } = { requireKey: true },
): Router {
  const router = Router();

  router.post('/api/blueprint', async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid request.', code: 'invalid' });
    const { sessionId } = parsed.data;

    let view;
    try {
      view = await loadBlueprintView(sessionId);
    } catch (err) {
      if (err instanceof SessionError) return void res.status(404).json({ error: 'That conversation has expired. Please start a new one.', code: 'not_found' });
      throw err;
    }

    const sse = createSse(res);
    if (view.blueprint) {
      sse.open();
      sse.send('done', view.blueprint);
      return void sse.end();
    }
    if (view.stage !== 'blueprint') return void res.status(409).json({ error: 'Your blueprint is not ready to be built yet.', code: 'not_ready' });
    if (options.requireKey && !config.openaiApiKey) return void res.status(503).json({ error: 'The assistant is not available right now.', code: 'unavailable' });
    if (active >= MAX_CONCURRENT_BLUEPRINTS) return void res.status(503).json({ error: 'Busy right now. Please try again in a minute.', code: 'busy' });

    // The concurrency slot is held until the work REALLY ends (not merely until the request
    // times out), so abandoned runs can never pile up beyond the cap.
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    let started = false;
    const startedAt = Date.now();
    let catalog: CatalogItem[] | null = null;
    try {
      if (!(await claimBlueprint(sessionId))) return void res.status(409).json({ error: 'Your blueprint is already being built.', code: 'in_progress' });
      sse.open();
      try {
        catalog = await deps.getCatalog();
        const abort = new AbortController();
        const run = generateBlueprint(
          { slots: view.slots, research: view.research, catalog }, { llm: deps.llm, search: deps.search },
          (e: BlueprintEvent) => sse.send(e.type, e), abort.signal,
        );
        started = true;
        run.then(release, release);
        const blueprint: Blueprint = await withTimeout(run, options.timeoutMs ?? BLUEPRINT_TIMEOUT_MS, () => abort.abort());
        await saveBlueprint(sessionId, blueprint); // saved even if the visitor disconnected
        metrics.inc('jobs_total', { job: 'blueprint', outcome: blueprint.status });
        metrics.observe('job_duration_ms', { job: 'blueprint' }, Date.now() - startedAt);
        log.info('blueprint finished', { status: blueprint.status, ms: Date.now() - startedAt });
        sse.send('done', blueprint);
      } catch (err) {
        // Failed or out of time. The per-pass fallbacks inside the generator did not save us, so
        // build the deterministic blueprint from the visitor's own answers (no model, no network)
        // rather than leaving them stuck on a step that may keep failing.
        log.error('blueprint failed; building from answers only', { err, ms: Date.now() - startedAt });
        metrics.inc('jobs_total', { job: 'blueprint', outcome: 'degraded' });
        metrics.observe('job_duration_ms', { job: 'blueprint' }, Date.now() - startedAt);
        try {
          const fallback = await generateBlueprint(
            { slots: view.slots, research: view.research, catalog: catalog ?? await deps.getCatalog() },
            { llm: new OfflineBlueprintLlm(), search: async () => [] }, () => {},
          );
          await saveBlueprint(sessionId, fallback);
          sse.send('done', fallback);
        } catch (fallbackErr) {
          log.error('could not build the fallback blueprint', { err: fallbackErr });
          await releaseBlueprint(sessionId).catch(() => {});
          sse.send('error', { message: 'Something went wrong while building your blueprint. Please try again.' });
        }
      }
    } finally {
      if (!started) release();
      sse.end();
    }
  });

  router.post('/api/blueprint/edit', async (req, res) => {
    const parsed = editBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid request.', code: 'invalid' });
    const { sessionId, ops } = parsed.data;
    const normalized: Op[] = ops.map((o) => ({ op: o.op, id: o.id ?? null, sku: o.sku ?? null, on: o.on ?? null, title: null, parentId: null, category: null }));
    try {
      const catalog = await deps.getCatalog();
      const out = await editBlueprint(sessionId, (bp) => {
        const applied = applyOps(bp, normalized, catalog);
        const { blueprint, notice } = repriceBlueprint(applied.blueprint, catalog);
        const changed = applied.changes.length > 0;
        return {
          blueprint: changed ? blueprint : null,
          result: { blueprint: changed ? blueprint : bp, changes: applied.changes, refused: applied.refused, notice, estimate: estimateLine(changed ? blueprint : bp) },
        };
      });
      res.json(out);
    } catch (err) {
      if (err instanceof SessionError) {
        const notReady = err.code === 'not_ready';
        return void res.status(notReady ? 409 : 404).json({ error: notReady ? 'Your blueprint is not ready yet.' : 'That conversation has expired. Please start a new one.', code: notReady ? 'not_ready' : 'not_found' });
      }
      throw err;
    }
  });

  return router;
}

export const blueprintRouter = createBlueprintRouter({
  llm: new OpenAiBlueprintLlm(),
  search: (q, n) => ragService.searchKnowledgeBase(q, n),
  getCatalog: () => ragService.getCatalog(),
});
