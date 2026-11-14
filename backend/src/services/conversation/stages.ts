// backend/src/services/conversation/stages.ts
// The stage machine. Stages are decided by CODE from the slots, never by the model, so a
// manipulated model (or visitor) cannot skip ahead or jump to a later stage.
import { missingRequired, type Slots } from './slots.js';

export const STAGES = ['greet', 'intake', 'competitors', 'research', 'blueprint', 'refine', 'close'] as const;
export type Stage = (typeof STAGES)[number];

/** After this many visitor turns in intake we move on with whatever we have, to stay short. */
export const INTAKE_TURN_BUDGET = 6;
/** Turns allowed on the competitor question before it is treated as skipped. */
export const COMPETITOR_TURN_BUDGET = 3;

export interface StageContext {
  stage: Stage;
  slots: Slots;
  /** Visitor turns spent in the current stage, including the one just processed. */
  turnsInStage: number;
}

/**
 * Next stage after a turn. Phase 3 owns greet → intake → competitors → research; later
 * stages are entered by later phases and are never left by this function.
 */
export function nextStage({ stage, slots, turnsInStage }: StageContext): Stage {
  if (stage === 'greet') {
    return slots.businessName || slots.industry ? 'intake' : 'greet';
  }
  if (stage === 'intake') {
    const done = missingRequired(slots).length === 0 || turnsInStage >= INTAKE_TURN_BUDGET;
    return done ? 'competitors' : 'intake';
  }
  if (stage === 'competitors') {
    const done =
      slots.competitorUrls.length > 0 || slots.competitorsSkipped || turnsInStage >= COMPETITOR_TURN_BUDGET;
    return done ? 'research' : 'competitors';
  }
  return stage;
}

export const GREETING =
  "Hi, I'm the Webmaxxers Blueprint Agent. In a few quick questions I'll map out the pages your website should have, and show you a clear price for each one. To start: what's your business called, and what do you do?";

export const READY_FOR_RESEARCH =
  "Thanks, that's everything I need. I'm going to look at the competition now and put your blueprint together.";
