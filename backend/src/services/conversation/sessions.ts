// backend/src/services/conversation/sessions.ts
// Postgres-backed sessions. Session ids are minted by the server only (random UUIDs), so a
// client cannot create or guess sessions. Limits are enforced in SQL, so they survive
// restarts and cannot be raced by parallel requests.
import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { pool } from '../../db/index.js';
import { emptySlots, type Slots } from './slots.js';
import { GREETING, type Stage } from './stages.js';
import type { ConversationState } from './engine.js';
import type { ResearchRecord } from '../research/job.js';
import type { Blueprint } from '../blueprint/types.js';

export const SESSION_TTL_HOURS = 24;

export type SessionFailure = 'not_found' | 'message_limit' | 'ip_limit' | 'not_ready' | 'busy';

export class SessionError extends Error {
  constructor(public readonly code: SessionFailure) {
    super(code);
  }
}

interface Row {
  stage: Stage;
  slots: Slots;
  messages: ConversationState['history'];
  strikes: number;
  stage_turns: number;
}

const toState = (r: Row): ConversationState => ({
  stage: r.stage,
  slots: { ...emptySlots(), ...r.slots },
  history: r.messages,
  strikes: r.strikes,
  stageTurns: r.stage_turns,
});

/** Starts a session, unless this IP already started too many in the last 24 hours. */
export async function createSession(ip: string): Promise<{ id: string; state: ConversationState }> {
  const { rows: [{ n }] } = await pool.query(
    `select count(*)::int as n from sessions
     where ip = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours'`,
    [ip],
  );
  if (n >= config.maxSessionsPerIp) throw new SessionError('ip_limit');

  const id = randomUUID();
  const state: ConversationState = {
    stage: 'greet',
    slots: emptySlots(),
    history: [{ role: 'assistant', content: GREETING }],
    strikes: 0,
    stageTurns: 0,
  };
  await pool.query(
    `insert into sessions (id, ip, stage, slots, messages) values ($1,$2,$3,$4,$5)`,
    [id, ip, state.stage, state.slots, JSON.stringify(state.history)],
  );
  return { id, state };
}

/**
 * Loads the session and atomically counts this message against the per-session cap.
 * Throws SessionError('not_found' | 'message_limit').
 */
export async function beginTurn(id: string): Promise<ConversationState> {
  const { rows } = await pool.query(
    `update sessions set message_count = message_count + 1, updated_at = now()
     where id = $1 and message_count < $2
       and created_at > now() - interval '${SESSION_TTL_HOURS} hours'
     returning stage, slots, messages, strikes, stage_turns`,
    [id, config.maxMessagesPerSession],
  );
  if (rows[0]) return toState(rows[0] as Row);

  const { rowCount } = await pool.query(
    `select 1 from sessions where id = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours'`,
    [id],
  );
  throw new SessionError(rowCount ? 'message_limit' : 'not_found');
}

/**
 * Gives back the message that `beginTurn` counted, for a turn that failed on our side (the model was
 * down, say). The visitor should not lose one of their limited messages to an outage.
 */
export async function refundTurn(id: string): Promise<void> {
  await pool.query(`update sessions set message_count = greatest(message_count - 1, 0) where id = $1`, [id]);
}

/**
 * Saves conversation state. With `expectedStage` it is a compare-and-set: if a background job
 * (research, blueprint) moved the stage on in the meantime, this stale write is skipped instead of
 * dragging the session back. Returns whether anything was written.
 */
export async function saveSession(id: string, state: ConversationState, expectedStage?: Stage): Promise<boolean> {
  const { rowCount } = await pool.query(
    `update sessions set stage=$2, slots=$3, messages=$4, strikes=$5, stage_turns=$6, updated_at=now()
     where id=$1 and ($7::text is null or stage = $7)`,
    [id, state.stage, state.slots, JSON.stringify(state.history), state.strikes, state.stageTurns, expectedStage ?? null],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Runs `fn` while holding a per-session lock, so two messages from the same session can never
 * be processed at once (each would start from the same state and overwrite the other).
 * Throws SessionError('busy') if another message is still being processed.
 */
export async function withSessionLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let unlocked = false;
  try {
    const { rows } = await client.query('select pg_try_advisory_lock(hashtext($1)) as ok', [id]);
    if (!rows[0].ok) { unlocked = true; throw new SessionError('busy'); }
    try {
      return await fn();
    } finally {
      try { await client.query('select pg_advisory_unlock(hashtext($1))', [id]); unlocked = true; } catch { /* connection is discarded below */ }
    }
  } finally {
    client.release(!unlocked); // a connection that may still hold the lock is destroyed, never reused
  }
}

// ---------------------------------------------------------------------------
// Research (phase 4f): one run per session, claimed atomically in SQL.
// ---------------------------------------------------------------------------

export interface ResearchView {
  stage: Stage;
  slots: Slots;
  findings: ResearchRecord | null;
}

export async function loadResearchView(id: string): Promise<ResearchView> {
  const { rows } = await pool.query(
    `select stage, slots, findings from sessions
     where id = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours'`,
    [id],
  );
  if (!rows[0]) throw new SessionError('not_found');
  return { stage: rows[0].stage, slots: { ...emptySlots(), ...rows[0].slots }, findings: rows[0].findings };
}

/**
 * Marks research as started. False if a run already finished or is in progress (a run that
 * never saved results is treated as crashed after 5 minutes and may be claimed again).
 */
export async function claimResearch(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `update sessions set research_started_at = now(), updated_at = now()
     where id = $1 and stage = 'research' and findings is null
       and (research_started_at is null or research_started_at < now() - interval '5 minutes')`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

/** Stores the findings and moves the conversation on to the blueprint stage. */
export async function saveResearch(id: string, record: ResearchRecord): Promise<void> {
  await pool.query(
    `update sessions set findings = $2, stage = 'blueprint', stage_turns = 0, updated_at = now() where id = $1`,
    [id, JSON.stringify(record)],
  );
}

/** Lets the visitor retry immediately after a crashed run. */
export async function releaseResearch(id: string): Promise<void> {
  await pool.query(`update sessions set research_started_at = null where id = $1 and findings is null`, [id]);
}

// ---------------------------------------------------------------------------
// Blueprint (phase 5g): one generation per session, claimed atomically in SQL.
// ---------------------------------------------------------------------------

export interface BlueprintView {
  stage: Stage;
  slots: Slots;
  research: ResearchRecord | null;
  blueprint: Blueprint | null;
}

export async function loadBlueprintView(id: string): Promise<BlueprintView> {
  const { rows } = await pool.query(
    `select stage, slots, findings, blueprint from sessions
     where id = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours'`,
    [id],
  );
  if (!rows[0]) throw new SessionError('not_found');
  return { stage: rows[0].stage, slots: { ...emptySlots(), ...rows[0].slots }, research: rows[0].findings, blueprint: rows[0].blueprint };
}

/** False if a blueprint already exists or a run is in progress (stale after 5 minutes). */
export async function claimBlueprint(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `update sessions set blueprint_started_at = now(), updated_at = now()
     where id = $1 and stage = 'blueprint' and blueprint is null
       and (blueprint_started_at is null or blueprint_started_at < now() - interval '5 minutes')`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}

/** Stores the blueprint and moves the conversation to the refine stage. */
export async function saveBlueprint(id: string, blueprint: Blueprint): Promise<void> {
  await pool.query(
    `update sessions set blueprint = $2, stage = 'refine', stage_turns = 0, updated_at = now() where id = $1`,
    [id, JSON.stringify(blueprint)],
  );
}

export async function releaseBlueprint(id: string): Promise<void> {
  await pool.query(`update sessions set blueprint_started_at = null where id = $1 and blueprint is null`, [id]);
}

/**
 * Atomically read-modify-write the stored blueprint (row lock), so two edits at once cannot
 * overwrite each other. `fn` returns the new blueprint, or null to leave it unchanged.
 * Throws SessionError('not_found') for an unknown session, ('not_ready') if there is no
 * blueprint to edit yet.
 */
export async function editBlueprint<T>(
  id: string, fn: (current: Blueprint) => { blueprint: Blueprint | null; result: T },
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select stage, blueprint from sessions
       where id = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours' for update`,
      [id],
    );
    if (!rows[0]) throw new SessionError('not_found');
    if (!rows[0].blueprint || !['refine', 'close'].includes(rows[0].stage)) throw new SessionError('not_ready');
    const { blueprint, result } = fn(rows[0].blueprint as Blueprint);
    if (blueprint) await client.query(`update sessions set blueprint = $2, updated_at = now() where id = $1`, [id, JSON.stringify(blueprint)]);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Restore (a page refresh): read-only snapshot of everything the visitor may see again.
// ---------------------------------------------------------------------------

export interface SessionSnapshot {
  state: ConversationState;
  research: ResearchRecord | null;
  blueprint: Blueprint | null;
}

export async function loadSnapshot(id: string): Promise<SessionSnapshot> {
  const { rows } = await pool.query(
    `select stage, slots, messages, strikes, stage_turns, findings, blueprint from sessions
     where id = $1 and created_at > now() - interval '${SESSION_TTL_HOURS} hours'`,
    [id],
  );
  if (!rows[0]) throw new SessionError('not_found');
  return { state: toState(rows[0] as Row), research: rows[0].findings ?? null, blueprint: rows[0].blueprint ?? null };
}
