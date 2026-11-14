// backend/src/services/conversation/engine.ts
// Runs one visitor turn. Pure with respect to storage: takes the session state, returns the
// new state plus the reply. The LLM and DNS resolver are injected so it is testable offline.
//
// Pipeline: screen message → extract + verify URLs → (redacted text) LLM extraction →
// validate/merge slots → code decides stage, question fallbacks and quick replies.
import { extractUrls, normalizeText, screenMessage, screenMessageReply, looksUnsafe } from '../security/inputGuard.js';
import { rejectionMessage, verifyUrl, type Resolver, type UrlRejection } from '../security/urlGuard.js';
import type { TurnLlm } from './llm.js';
import { mergeModelSlots, missingRequired, type RequiredSlot, type Slots } from './slots.js';
import { READY_FOR_RESEARCH, nextStage, type Stage } from './stages.js';

export const MAX_STRIKES = 3;
export const MAX_COMPETITORS = 3;

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export interface ConversationState {
  stage: Stage;
  slots: Slots;
  history: ChatTurn[];
  strikes: number;
  stageTurns: number;
}

export interface TurnResult {
  state: ConversationState;
  reply: string;
  quickReplies: string[];
  notices: string[];
  /** true once the visitor's strikes are used up: no further messages are processed. */
  locked: boolean;
}

export interface EngineDeps {
  llm: TurnLlm;
  resolver?: Resolver;
}

/** Rejections that hint at probing (internal addresses, credential tricks), not typos. */
const SUSPICIOUS: ReadonlySet<UrlRejection> = new Set([
  'ip_literal', 'internal_host', 'bad_scheme', 'has_credentials', 'bad_port',
  'look_alike_host', 'non_public_address',
]);

const LOCKED_REPLY =
  'This chat has been closed because of unusual input. If you need a website quote, please contact the Webmaxxers team directly.';
const HOLD_REPLIES: Record<Exclude<Stage, 'greet' | 'intake' | 'competitors'>, string> = {
  research: "I'm still looking at the competition. This takes a moment, and I'll have your results shortly.",
  blueprint: 'Your research is done. Your blueprint is the next step.',
  refine: 'Your blueprint is ready. Tell me what you would like to change.',
  close: 'Your estimate is ready. The next step is a strategy call with the Webmaxxers team.',
};
const REDIRECT = "I'm here to help plan your website, so let's keep to that.";

const QUESTIONS: Record<RequiredSlot, string> = {
  businessName: "What's your business called?",
  industry: 'What kind of business is it?',
  services: 'What are the main services or products you offer?',
  serviceArea: 'Which city or area do you serve?',
  primaryGoal: 'What do you most want the website to do: bring phone calls, quote requests, bookings or online sales?',
};
const COMPETITOR_QUESTION =
  'Do you know 1-3 competitor websites you admire? Paste the addresses, or say "none" and I\'ll find some in your area.';

const GOAL_REPLIES = ['Phone calls', 'Quote requests', 'Bookings', 'Online sales'];
const COMPETITOR_REPLIES = ["I don't know any, find some", "I don't have a website yet"];

/** Strips anything that could carry a link, markup or placeholder out of model-written text. */
function cleanReply(text: string, fallback: string, max = 300): string {
  const cleaned = normalizeText(text)
    .replace(/\[(?:URL\d+|INVALID_URL|EMAIL)\]/g, '')
    .replace(/https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|us|app|dev|biz|info)\b\S*/gi, '')
    .replace(/[<>`]/g, '')
    .trim()
    .slice(0, max);
  return cleaned.length < 3 || looksUnsafe(cleaned) ? fallback : cleaned;
}

function questionFor(stage: Stage, slots: Slots): string {
  if (stage === 'competitors') return COMPETITOR_QUESTION;
  const [first] = missingRequired(slots);
  return first ? QUESTIONS[first] : COMPETITOR_QUESTION;
}

export function quickRepliesFor(stage: Stage, slots: Slots): string[] {
  if (stage === 'competitors') return COMPETITOR_REPLIES;
  if (stage === 'intake' && missingRequired(slots)[0] === 'primaryGoal') return GOAL_REPLIES;
  return [];
}

export async function processTurn(
  state: ConversationState,
  rawMessage: unknown,
  { llm, resolver }: EngineDeps,
): Promise<TurnResult> {
  if (state.strikes >= MAX_STRIKES) {
    return { state, reply: LOCKED_REPLY, quickReplies: [], notices: [], locked: true };
  }

  const strike = (reply: string, notices: string[] = []): TurnResult => {
    const strikes = state.strikes + 1;
    const locked = strikes >= MAX_STRIKES;
    return {
      state: { ...state, strikes },
      reply: locked ? LOCKED_REPLY : reply,
      quickReplies: [],
      notices,
      locked,
    };
  };

  // Later stages are driven by their own endpoints (research, blueprint); chat just holds the line.
  if (state.stage !== 'greet' && state.stage !== 'intake' && state.stage !== 'competitors') {
    return { state, reply: HOLD_REPLIES[state.stage], quickReplies: [], notices: [], locked: false };
  }

  // 1. Screen the raw message. Rejected input never reaches the model or the stored history.
  const screened = screenMessage(rawMessage);
  if (!screened.ok) {
    return screened.reason === 'empty' || screened.reason === 'too_long'
      ? { state, reply: screenMessageReply(screened.reason), quickReplies: [], notices: [], locked: false }
      : strike(screenMessageReply(screened.reason));
  }

  // 2. Pull addresses out and verify each one (syntax already checked; now DNS).
  const extracted = extractUrls(screened.text);
  const notices = new Set<string>();
  let suspicious = false;
  for (const { reason } of extracted.rejected) {
    notices.add(rejectionMessage(reason));
    suspicious ||= SUSPICIOUS.has(reason);
  }
  const verified = new Map<string, { url: string; host: string }>();
  await Promise.all(
    extracted.candidates.map(async (c) => {
      const check = await verifyUrl(c.url, resolver);
      if (check.ok) verified.set(c.ref, { url: check.url, host: check.host });
      else {
        notices.add(rejectionMessage(check.reason));
        suspicious ||= SUSPICIOUS.has(check.reason);
      }
    }),
  );
  let message = extracted.redactedText;
  for (const c of extracted.candidates) {
    if (!verified.has(c.ref)) message = message.replaceAll(`[${c.ref}]`, '[INVALID_URL]');
  }

  // 3. Model call on the redacted text only.
  const missing = missingRequired(state.slots);
  const out = await llm.runTurn({
    stage: state.stage,
    slots: state.slots,
    missing,
    history: state.history,
    message,
    urlRefs: [...verified.keys()],
  });

  // 4. Merge validated slots. URLs come from code, never from model text.
  let slots = mergeModelSlots(state.slots, out.slots);
  if (out.noWebsite) slots = { ...slots, noWebsite: true };
  if (out.competitorsSkipped && state.stage === 'competitors') slots = { ...slots, competitorsSkipped: true };

  const roles = new Map(out.urlRoles.map((r) => [r.ref, r.role]));
  for (const [ref, { url, host }] of verified) {
    const role = roles.get(ref) ?? 'unknown';
    const asCompetitor = role === 'competitor' || (role === 'unknown' && state.stage === 'competitors');
    const hostOf = (u: string) => new URL(u).hostname.replace(/^www\./, '');
    const bare = host.replace(/^www\./, '');
    if (asCompetitor) {
      const dup = slots.competitorUrls.some((u) => hostOf(u) === bare) || (slots.ownUrl && hostOf(slots.ownUrl) === bare);
      if (dup) notices.add('I already have that website.');
      else if (slots.competitorUrls.length >= MAX_COMPETITORS) notices.add(`I can compare up to ${MAX_COMPETITORS} competitors. I'll use the first ${MAX_COMPETITORS}.`);
      else slots = { ...slots, competitorUrls: [...slots.competitorUrls, url] };
    } else if (!slots.ownUrl && !slots.competitorUrls.some((u) => hostOf(u) === bare)) {
      slots = { ...slots, ownUrl: url, noWebsite: false };
    }
  }

  // 5. Code decides the stage.
  const stageTurns = state.stageTurns + 1;
  const stage = nextStage({ stage: state.stage, slots, turnsInStage: stageTurns });
  const advanced = stage !== state.stage;

  // 6. Compose the reply. Off-topic and stage changes use fixed wording, so a manipulated
  //    model cannot answer off-topic questions or ask for the wrong thing.
  const fallbackQuestion = questionFor(stage, slots);
  let reply: string;
  if (stage === 'research') {
    reply = READY_FOR_RESEARCH;
  } else if (out.offTopic) {
    reply = `${REDIRECT} ${fallbackQuestion}`;
  } else {
    const ack = cleanReply(out.acknowledgement, 'Got it.', 200);
    const question = advanced || stage === 'competitors' ? fallbackQuestion : cleanReply(out.question, fallbackQuestion);
    reply = `${ack} ${question}`;
  }

  const history: ChatTurn[] = [
    ...state.history,
    { role: 'user' as const, content: message },
    { role: 'assistant' as const, content: reply },
  ].slice(-20);

  const next: ConversationState = {
    stage,
    slots,
    history,
    strikes: suspicious ? state.strikes + 1 : state.strikes,
    stageTurns: advanced ? 0 : stageTurns,
  };
  const locked = next.strikes >= MAX_STRIKES;
  return {
    state: next,
    reply: locked ? LOCKED_REPLY : reply,
    quickReplies: locked ? [] : quickRepliesFor(stage, slots),
    notices: [...notices],
    locked,
  };
}
