// backend/src/routes/chat.ts
// Conversation endpoints. The client sends only { sessionId, message }: stage, slots and
// history live on the server, so a visitor cannot forge state (e.g. skip stages or inject slots).
// During intake the engine converses; once a blueprint exists (stage "refine") messages are
// interpreted as edits to it.
import { Router } from 'express';
import { z } from 'zod';
import { OpenAiBlueprintLlm } from '../services/blueprint/llm.js';
import { runRefineTurn, type RefineFlowDeps } from '../services/blueprint/refineFlow.js';
import { OpenAiRefineLlm } from '../services/blueprint/refine.js';
import { OpenAiTurnLlm, type TurnLlm } from '../services/conversation/llm.js';
import { processTurn, type ConversationState } from '../services/conversation/engine.js';
import { MAX_MESSAGE_CHARS } from '../services/security/inputGuard.js';
import { REQUIRED_SLOTS, missingRequired } from '../services/conversation/slots.js';
import { GREETING } from '../services/conversation/stages.js';
import { SessionError, beginTurn, createSession, refundTurn, saveSession, withSessionLock } from '../services/conversation/sessions.js';
import { sendModelFailure } from './failure.js';
import { ragService } from '../services/rag/index.js';

const turnBody = z
  .object({
    sessionId: z.string().uuid(),
    // Generous raw cap; the real limit and content checks run in the input guard.
    message: z.string().max(MAX_MESSAGE_CHARS * 4),
  })
  .strict();

/** What the browser may see of a session. Never includes strikes or raw history. */
export function publicView(state: ConversationState) {
  const { slots } = state;
  return {
    stage: state.stage,
    progress: { required: REQUIRED_SLOTS.length, filled: REQUIRED_SLOTS.length - missingRequired(slots).length },
    slots: {
      businessName: slots.businessName ?? null,
      industry: slots.industry ?? null,
      services: slots.services,
      serviceArea: slots.serviceArea ?? null,
      primaryGoal: slots.primaryGoal ?? null,
      ownUrl: slots.ownUrl ?? null,
      competitorUrls: slots.competitorUrls,
      noWebsite: slots.noWebsite,
    },
  };
}

const LIMIT_MESSAGES = {
  message_limit: 'This conversation has reached its length limit. Please book a strategy call with the Webmaxxers team to continue.',
  ip_limit: 'Too many conversations started from your network today. Please contact Webmaxxers directly.',
  not_found: 'That conversation has expired. Please start a new one.',
  not_ready: 'Your blueprint is not ready yet.',
  busy: "I'm still working on your last message. Please wait a moment.",
} as const;
const LIMIT_STATUS = { message_limit: 429, ip_limit: 429, not_found: 404, not_ready: 409, busy: 409 } as const;

export interface ChatDeps extends RefineFlowDeps {
  turnLlm: TurnLlm;
}

export function createChatRouter(deps: ChatDeps): Router {
  const router = Router();

  router.post('/api/chat/start', async (req, res) => {
    try {
      const { id, state } = await createSession(req.ip ?? 'unknown');
      res.json({ sessionId: id, reply: GREETING, quickReplies: [], notices: [], ...publicView(state) });
    } catch (err) {
      if (err instanceof SessionError) return void res.status(LIMIT_STATUS[err.code]).json({ error: LIMIT_MESSAGES[err.code], code: err.code });
      throw err;
    }
  });

  router.post('/api/chat', async (req, res) => {
    const body = turnBody.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: 'Invalid request.', code: 'invalid' });

    const { sessionId, message } = body.data;
    try {
      await withSessionLock(sessionId, async () => {
        const state = await beginTurn(sessionId);

        // Refinement: the visitor is editing their blueprint.
        if (state.stage === 'refine' || state.stage === 'close') {
          try {
            const r = await runRefineTurn(sessionId, state, message, deps);
            return void res.json({
              sessionId, reply: r.reply, quickReplies: r.quickReplies, notices: r.notices, locked: r.locked,
              blueprint: r.blueprint, ...publicView(r.state),
            });
          } catch (err) {
            if (err instanceof SessionError) throw err;
            // Nothing was saved, so the visitor can simply resend, and the message is not held against them.
            await refundTurn(sessionId).catch(() => {});
            return void sendModelFailure(res, err, 'refine turn');
          }
        }

        let result;
        try {
          result = await processTurn(state, message, { llm: deps.turnLlm });
        } catch (err) {
          await refundTurn(sessionId).catch(() => {});
          return void sendModelFailure(res, err, 'chat turn');
        }

        // Nothing to save when the engine only held the line (a background job may own the stage).
        if (result.state !== state) await saveSession(sessionId, result.state, state.stage);
        res.json({
          sessionId,
          reply: result.reply,
          quickReplies: result.quickReplies,
          notices: result.notices,
          locked: result.locked,
          ...publicView(result.state),
        });
      });
    } catch (err) {
      if (err instanceof SessionError) return void res.status(LIMIT_STATUS[err.code]).json({ error: LIMIT_MESSAGES[err.code], code: err.code });
      throw err;
    }
  });

  return router;
}

export const chatRouter = createChatRouter({
  turnLlm: new OpenAiTurnLlm(),
  refineLlm: new OpenAiRefineLlm(),
  contentLlm: new OpenAiBlueprintLlm(),
  getCatalog: () => ragService.getCatalog(),
});
