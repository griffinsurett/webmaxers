// backend/src/routes/session.ts
// GET /api/session/:id → what a returning visitor needs to pick up where they left off after a
// page refresh: stage, the visible conversation, research results and the blueprint. Read-only.
// No login exists, so the unguessable random session id is the only credential (same as /api/chat).
import { Router } from 'express';
import { z } from 'zod';
import { MAX_STRIKES, quickRepliesFor } from '../services/conversation/engine.js';
import { SessionError, loadSnapshot } from '../services/conversation/sessions.js';
import { publicView } from './chat.js';
import { publicRecord } from './research.js';

const params = z.object({ id: z.string().uuid() }).strict();
const MAX_RESTORED_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 4000;

export const sessionRouter = Router();

sessionRouter.get('/api/session/:id', async (req, res) => {
  const p = params.safeParse(req.params);
  if (!p.success) return void res.status(400).json({ error: 'Invalid request.', code: 'invalid' });
  try {
    const { state, research, blueprint } = await loadSnapshot(p.data.id);
    const locked = state.strikes >= MAX_STRIKES;
    res.json({
      sessionId: p.data.id,
      ...publicView(state),
      locked,
      quickReplies: locked ? [] : quickRepliesFor(state.stage, state.slots),
      messages: state.history.slice(-MAX_RESTORED_MESSAGES).map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_LENGTH) })),
      research: research ? publicRecord(research) : null,
      blueprint,
    });
  } catch (err) {
    if (err instanceof SessionError) return void res.status(404).json({ error: 'That conversation has expired. Please start a new one.', code: 'not_found' });
    throw err;
  }
});
