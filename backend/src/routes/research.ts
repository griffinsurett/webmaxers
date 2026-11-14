// backend/src/routes/research.ts
// POST /api/research { sessionId } → Server-Sent Events with live progress, then the results.
//
// The browser never supplies a URL: research runs only on addresses already verified and
// stored in the server-side session, and only once the stage machine has reached "research".
// One run per session, claimed atomically in SQL; replays return the saved result.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { OpenAiFindingsLlm } from '../services/research/analysis.js';
import { OpenAiCompetitorSearch } from '../services/research/discovery.js';
import { PoliteFetcher } from '../services/research/fetcher.js';
import { failedResearchRecord, runResearch, type ProgressEvent, type ResearchDeps, type ResearchRecord } from '../services/research/job.js';
import {
  SessionError, claimResearch, loadResearchView, releaseResearch, saveResearch,
} from '../services/conversation/sessions.js';
import { log } from '../services/log/logger.js';
import { metrics } from '../services/log/metrics.js';

const body = z.object({ sessionId: z.string().uuid() }).strict();

export const MAX_CONCURRENT_JOBS = 3;
const HEARTBEAT_MS = 15_000;
/** Hard ceiling for one run. Every fetch and model call is individually bounded too, so a stuck job cannot pin a slot. */
export const JOB_TIMEOUT_MS = 240_000;
let activeJobs = 0;

/** What the browser receives: no raw facts, no internals. */
export function publicRecord(record: ResearchRecord) {
  const f = record.findings;
  return {
    status: record.status,
    notices: record.notices,
    sites: record.sites.map(({ facts: _facts, ...site }) => site),
    findings: f && {
      competitors: f.competitors,
      patterns: f.patterns,
      ownSite: f.ownSite,
      opportunities: f.opportunities,
    },
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('research job timed out')), ms); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

export function createResearchRouter(deps: ResearchDeps, options: { requireKey: boolean; jobTimeoutMs?: number } = { requireKey: true }): Router {
  const router = Router();

  router.post('/api/research', async (req, res) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid request.', code: 'invalid' });
    const { sessionId } = parsed.data;

    // Plain JSON errors until the stream is open.
    let view;
    try {
      view = await loadResearchView(sessionId);
    } catch (err) {
      if (err instanceof SessionError) return void res.status(404).json({ error: 'That conversation has expired. Please start a new one.', code: 'not_found' });
      throw err;
    }

    const open = () => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
    };
    let closed = false;
    res.on('close', () => { closed = true; });
    const send = (event: string, data: unknown) => {
      if (closed || res.writableEnded) return;
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { closed = true; }
    };

    // Already finished: replay the saved result.
    if (view.findings) {
      open();
      send('done', publicRecord(view.findings));
      return void res.end();
    }
    if (view.stage !== 'research') return void res.status(409).json({ error: 'Research is not ready for this conversation yet.', code: 'not_ready' });
    if (options.requireKey && !config.openaiApiKey) return void res.status(503).json({ error: 'The assistant is not available right now.', code: 'unavailable' });
    // Reserve a slot first so concurrent requests cannot overshoot the cap.
    if (activeJobs >= MAX_CONCURRENT_JOBS) return void res.status(503).json({ error: 'Busy right now. Please try again in a minute.', code: 'busy' });
    // The slot is held until the job REALLY ends, not merely until the request times out.
    activeJobs++;
    let released = false;
    const release = () => { if (!released) { released = true; activeJobs--; } };
    let started = false;
    let heartbeat: NodeJS.Timeout | undefined;
    try {
      if (!(await claimResearch(sessionId))) return void res.status(409).json({ error: 'Research is already running for this conversation.', code: 'in_progress' });

      open();
      heartbeat = setInterval(() => { if (!closed && !res.writableEnded) res.write(': keep-alive\n\n'); }, HEARTBEAT_MS);
      const started_at = Date.now();
      try {
        const { slots } = view;
        const job = runResearch({
          businessName: slots.businessName,
          industry: slots.industry ?? '',
          serviceArea: slots.serviceArea ?? '',
          services: slots.services,
          primaryGoal: slots.primaryGoal,
          ownUrl: slots.ownUrl,
          competitorUrls: slots.competitorUrls,
        }, deps, (e: ProgressEvent) => send(e.type, e));
        started = true;
        job.then(release, release);
        const record = await withTimeout(job, options.jobTimeoutMs ?? JOB_TIMEOUT_MS);
        // The job keeps running if the visitor disconnects, so results are saved for a reconnect.
        await saveResearch(sessionId, record);
        metrics.inc('jobs_total', { job: 'research', outcome: record.status });
        metrics.observe('job_duration_ms', { job: 'research' }, Date.now() - started_at);
        log.info('research finished', { status: record.status, sites: record.sites.length, ms: Date.now() - started_at });
        send('done', publicRecord(record));
      } catch (err) {
        // The run crashed or ran out of time. Do not strand the visitor on a step that may keep
        // failing: record "nothing could be read" and let the blueprint be built from their answers.
        log.error('research failed; continuing without it', { err, ms: Date.now() - started_at });
        metrics.inc('jobs_total', { job: 'research', outcome: 'degraded' });
        metrics.observe('job_duration_ms', { job: 'research' }, Date.now() - started_at);
        try {
          const fallback = failedResearchRecord();
          await saveResearch(sessionId, fallback);
          send('done', publicRecord(fallback));
        } catch (saveErr) {
          log.error('could not save the fallback research result', { err: saveErr });
          await releaseResearch(sessionId).catch(() => {});
          send('error', { message: 'Something went wrong while researching. Please try again.' });
        }
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (!started) release();
      if (res.headersSent && !res.writableEnded) res.end();
    }
  });

  return router;
}

export const researchRouter = createResearchRouter({
  search: new OpenAiCompetitorSearch(),
  llm: new OpenAiFindingsLlm(),
  makeFetcher: () => new PoliteFetcher({}, 20),
});
