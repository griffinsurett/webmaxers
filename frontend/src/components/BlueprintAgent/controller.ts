// src/components/BlueprintAgent/controller.ts
// The Blueprint Agent's brain on the browser side: one plain state machine that owns the
// conversation, the research/blueprint jobs, manual edits, error recovery and resuming after a
// page refresh. The React component only renders `getState()` and calls the methods here.
//
// Rules this file enforces:
//  - the server is the source of truth (stage, prices, blueprint); we never compute or guess them
//  - one thing at a time: a message, an edit and a job can never overlap
//  - every async step re-checks the "epoch", so a reset or unmount can never be overwritten by a
//    slow reply from the conversation that came before
//  - sessions are created lazily (on the first message), so merely viewing the page never uses up
//    a visitor's per-network session allowance
import * as realApi from './api';
import { apiError, type ApiError, type ApiResult, type ClientOptions } from './api';
import { describeBlueprint, describeResearch, estimateText, toViewBlueprint } from './adapter';
import {
  applyBlueprintEvent, applyResearchEvent, finishProgress, startBlueprintProgress, startResearchProgress, type JobProgress,
} from './progress';
import { clearSessionId, loadSessionId, saveSessionId } from './session';
import type { ChatMessage } from './types';
import type {
  BlueprintProgress, ChatTurn, EditOp, EditResult, ResearchProgress, SessionSnapshot, Stage, WireBlueprint, WireResearch,
} from './wire';

/** Same text the server opens with, shown before a session exists. */
export const LOCAL_GREETING =
  "Hi, I'm the Webmaxxers Blueprint Agent. In a few quick questions I'll map out the pages your website should have, and show you a clear price for each one. To start: what's your business called, and what do you do?";

export const MAX_SESSION_MESSAGES = 40;

export interface AgentApi {
  checkBackendHealth(o?: ClientOptions): Promise<boolean>;
  startSession(o?: ClientOptions): Promise<ApiResult<ChatTurn>>;
  sendChatMessage(id: string, message: string, o?: ClientOptions): Promise<ApiResult<ChatTurn>>;
  restoreSession(id: string, o?: ClientOptions): Promise<ApiResult<SessionSnapshot>>;
  streamResearch(id: string, onProgress?: (e: ResearchProgress) => void, o?: ClientOptions): Promise<ApiResult<WireResearch>>;
  streamBlueprint(id: string, onProgress?: (e: BlueprintProgress) => void, o?: ClientOptions): Promise<ApiResult<WireBlueprint>>;
  editBlueprint(id: string, ops: EditOp[], o?: ClientOptions): Promise<ApiResult<EditResult>>;
}

export interface SessionStore {
  load(): string | null;
  save(id: string): void;
  clear(): void;
}

const defaultStore: SessionStore = { load: () => loadSessionId(), save: (id) => saveSessionId(id), clear: () => clearSessionId() };

export type RetryAction = 'send' | 'job' | 'init' | 'none';

export interface AgentState {
  /** checking: first health check / restore. offline: backend unreachable. ready: usable. */
  boot: 'checking' | 'ready' | 'offline';
  sessionId: string | null;
  stage: Stage | 'new';
  messages: ChatMessage[];
  progress: { required: number; filled: number };
  /** Set while research or the blueprint is being built. */
  job: JobProgress | null;
  /** A request is in flight: no other action may start. */
  busy: 'chat' | 'edit' | null;
  blueprint: WireBlueprint | null;
  /** The conversation can no longer continue (locked out, or hit a limit). Shown to the visitor. */
  blockedMessage: string | null;
  error: { error: ApiError; action: RetryAction } | null;
  userMessageCount: number;
  /** True when running on the example backend instead of the real assistant. */
  demo: boolean;
}

export interface ControllerDeps {
  api?: AgentApi;
  store?: SessionStore;
  /** Test seam: how long to wait for client-side timing. */
  now?: () => number;
  /** Demo mode (the in-browser example backend): labelled in the UI, never saved. */
  demo?: boolean;
}

/** A demo conversation is never remembered: a refresh goes back to the live check. */
const noStore: SessionStore = { load: () => null, save: () => {}, clear: () => {} };

const freshState = (): AgentState => ({
  boot: 'checking', sessionId: null, stage: 'new', messages: [], progress: { required: 0, filled: 0 }, job: null, busy: null,
  blueprint: null, blockedMessage: null, error: null, userMessageCount: 0, demo: false,
});

export class AgentController {
  private state: AgentState = freshState();
  private listeners = new Set<() => void>();
  private api: AgentApi;
  private store: SessionStore;
  private now: () => number;
  private seq = 0;
  /** Bumped by reset()/dispose(): any async step from an older epoch must stop touching state. */
  private epoch = 0;
  private abort: AbortController | null = null;
  private jobRunning = false;
  private pendingText: string | null = null;
  private disposed = false;
  private demo = false;

  constructor(deps: ControllerDeps = {}) {
    this.api = deps.api ?? (realApi as AgentApi);
    this.store = deps.demo ? noStore : (deps.store ?? defaultStore); // a demo can never save, whatever the caller passes
    this.now = deps.now ?? Date.now;
    this.state = { ...freshState(), demo: !!deps.demo, messages: [this.greeting()] };
    this.demo = !!deps.demo;
  }

  // ----- subscription (React's useSyncExternalStore) -----
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = (): AgentState => this.state;

  private set(patch: Partial<AgentState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const fn of [...this.listeners]) fn();
  }

  private id(): string { return `m${++this.seq}`; }
  private greeting(): ChatMessage { return { id: this.id(), role: 'assistant', content: LOCAL_GREETING, timestamp: this.now() }; }
  private push(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}) {
    this.set({ messages: [...this.state.messages, { id: this.id(), role, content, timestamp: this.now(), ...extra }] });
  }
  private options(): ClientOptions { return { signal: this.abort?.signal }; }
  private fresh() { this.abort?.abort(); this.abort = new AbortController(); }

  // ----- lifecycle -----

  /** Call once on mount: checks the backend, then resumes a stored conversation if there is one. */
  async init(): Promise<void> {
    this.disposed = false; // a remount (e.g. React StrictMode) revives a disposed controller
    const epoch = this.epoch;
    this.set({ boot: 'checking', error: null });
    if (!this.abort || this.abort.signal.aborted) this.abort = new AbortController();
    const healthy = await this.api.checkBackendHealth();
    if (epoch !== this.epoch) return;
    if (!healthy) return this.set({ boot: 'offline' });

    const id = this.store.load();
    if (!id) return this.set({ boot: 'ready' });

    const r = await this.api.restoreSession(id, this.options());
    if (epoch !== this.epoch) return;
    if (r.ok) {
      this.hydrate(r.data);
      this.set({ boot: 'ready' });
      return void this.resume(r.data.stage);
    }
    if (r.error.kind === 'expired') {
      // Gone (older than a day, or never existed): quietly start over.
      this.store.clear();
      return this.set({ boot: 'ready' });
    }
    // Transient (offline, server hiccup): keep the stored id so a retry can still resume it.
    this.set({ boot: 'ready', error: { error: r.error, action: 'init' } });
  }

  dispose(): void {
    this.epoch++;
    this.abort?.abort();
    this.jobRunning = false;
    this.disposed = true;
    this.listeners.clear();
  }

  /** Start a brand-new conversation. */
  reset(): void {
    this.epoch++;
    this.abort?.abort();
    this.abort = new AbortController();
    this.jobRunning = false;
    this.pendingText = null;
    this.store.clear();
    this.state = { ...freshState(), demo: this.demo, boot: this.state.boot === 'offline' ? 'offline' : 'ready', messages: [this.greeting()] };
    for (const fn of [...this.listeners]) fn();
  }

  dismissError(): void { this.set({ error: null }); }

  /** Do again whatever the visible error was about. */
  retry(): void {
    const e = this.state.error;
    if (!e) return;
    this.set({ error: null });
    if (e.action === 'init') void this.init();
    else if (e.action === 'send' && this.pendingText) void this.send(this.pendingText, true);
    else if (e.action === 'job' && this.state.stage !== 'new') void this.resume(this.state.stage);
  }

  // ----- restore -----

  private hydrate(s: SessionSnapshot) {
    const messages: ChatMessage[] = s.messages.map((m) => ({ id: this.id(), role: m.role, content: m.content, timestamp: this.now() }));
    if (messages.length === 0) messages.push(this.greeting());
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && s.quickReplies.length > 0) last.quickActions = s.quickReplies.map((label) => ({ label, action: label }));
    this.set({
      sessionId: s.sessionId, stage: s.stage, messages, progress: s.progress, blueprint: s.blueprint,
      blockedMessage: s.locked ? (last?.content ?? 'This chat has been closed.') : null,
      userMessageCount: s.messages.filter((m) => m.role === 'user').length,
    });
  }

  /** Continue whatever the server is in the middle of. */
  private async resume(stage: Stage): Promise<void> {
    if (stage === 'research') return this.runResearchThenBlueprint();
    if (stage === 'blueprint') return this.runBlueprint();
  }

  // ----- chat -----

  async send(raw: string, isRetry = false): Promise<void> {
    const text = raw.trim();
    const s = this.state;
    if (!text || s.busy || s.job || s.blockedMessage || s.boot !== 'ready') return;
    if (text.length > realApi.MAX_MESSAGE_CHARS) {
      return this.set({ error: { error: { kind: 'invalid', message: `Please keep your message under ${realApi.MAX_MESSAGE_CHARS} characters.`, retryable: false }, action: 'none' } });
    }
    const epoch = this.epoch;
    this.fresh();
    this.pendingText = text;
    // Clear the quick-reply buttons: they belonged to the message being answered.
    const cleared = s.messages.map((m) => (m.quickActions ? { ...m, quickActions: undefined } : m));
    this.set({ busy: 'chat', error: null, messages: cleared });
    if (!isRetry) {
      this.push('user', text);
      this.set({ userMessageCount: this.state.userMessageCount + 1 });
    }

    let id = this.state.sessionId;
    if (!id) {
      const started = await this.api.startSession(this.options());
      if (epoch !== this.epoch) return;
      if (!started.ok) return this.failChat(started.error);
      id = started.data.sessionId;
      this.store.save(id);
      this.set({ sessionId: id });
    }

    const r = await this.api.sendChatMessage(id, text, this.options());
    if (epoch !== this.epoch) return;
    if (!r.ok) return this.failChat(r.error);
    this.pendingText = null;
    this.applyTurn(r.data);
  }

  private failChat(error: ApiError) {
    if (error.kind === 'limit') return this.set({ busy: null, blockedMessage: error.message });
    // Not retryable by resending (expired / invalid): the visitor needs a new conversation or a new message.
    this.set({ busy: null, error: { error, action: error.retryable ? 'send' : 'none' } });
  }

  private applyTurn(turn: ChatTurn) {
    this.push('assistant', turn.reply, {
      quickActions: turn.quickReplies.length > 0 && !turn.locked ? turn.quickReplies.map((label) => ({ label, action: label })) : undefined,
      notices: turn.notices.length > 0 ? turn.notices : undefined,
    });
    this.set({
      busy: null, stage: turn.stage, progress: turn.progress,
      blueprint: turn.blueprint ?? this.state.blueprint,
      blockedMessage: turn.locked ? turn.reply : null,
    });
    if (turn.locked) return;
    // The visitor typing after a failed job restarts it (the server's chat reply at these stages is only a holding line).
    if (turn.stage === 'research') void this.runResearchThenBlueprint();
    else if (turn.stage === 'blueprint') void this.runBlueprint();
  }

  // ----- jobs -----

  private async runResearchThenBlueprint(): Promise<void> {
    if (this.jobRunning) return;
    const id = this.state.sessionId;
    if (!id) return;
    const epoch = this.epoch;
    this.jobRunning = true;
    this.fresh();
    let job = startResearchProgress();
    this.set({ job, stage: 'research', error: null });
    const r = await this.api.streamResearch(id, (e) => {
      if (epoch !== this.epoch) return;
      job = applyResearchEvent(job, e);
      this.set({ job });
    }, this.options());
    if (epoch !== this.epoch) return;
    this.jobRunning = false;
    if (!r.ok) return this.set({ job: null, error: { error: r.error, action: r.error.kind === 'aborted' ? 'none' : 'job' } });
    try {
      this.push('assistant', describeResearch(r.data, this.demo), { notices: r.data.notices.length > 0 ? r.data.notices : undefined });
    } catch (err) {
      console.error('[BlueprintAgent] could not summarize research', err); // not fatal: the blueprint is the point
    }
    this.set({ job: finishProgress(job), stage: 'blueprint' });
    return this.runBlueprint();
  }

  private async runBlueprint(): Promise<void> {
    if (this.jobRunning) return;
    const id = this.state.sessionId;
    if (!id) return;
    const epoch = this.epoch;
    this.jobRunning = true;
    this.fresh();
    let job = startBlueprintProgress();
    this.set({ job, stage: 'blueprint', error: null });
    const r = await this.api.streamBlueprint(id, (e) => {
      if (epoch !== this.epoch) return;
      job = applyBlueprintEvent(job, e);
      this.set({ job });
    }, this.options());
    if (epoch !== this.epoch) return;
    this.jobRunning = false;
    if (!r.ok) return this.set({ job: null, error: { error: r.error, action: r.error.kind === 'aborted' ? 'none' : 'job' } });
    try {
      const view = toViewBlueprint(r.data);
      this.push('assistant', describeBlueprint(view, this.demo), { notices: view.notices.length > 0 ? view.notices : undefined });
    } catch (err) {
      // A blueprint we cannot draw must not leave the page stuck "working".
      console.error('[BlueprintAgent] could not read the blueprint', err);
      return this.set({ job: null, error: { error: apiError('bad_response'), action: 'none' } });
    }
    this.set({ job: null, blueprint: r.data, stage: 'refine' });
  }

  // ----- manual edits (page ✕/add, add-on switch) -----

  async edit(ops: EditOp[]): Promise<void> {
    const s = this.state;
    const id = s.sessionId;
    if (!id || !s.blueprint || s.busy || s.job || s.blockedMessage) return;
    const epoch = this.epoch;
    this.fresh();
    this.set({ busy: 'edit', error: null });
    const r = await this.api.editBlueprint(id, ops, this.options());
    if (epoch !== this.epoch) return;
    if (!r.ok) return this.set({ busy: null, error: { error: r.error, action: 'none' } });
    const { changes, refused, estimate, notice } = r.data;
    let view;
    try {
      view = toViewBlueprint(r.data.blueprint);
    } catch (err) {
      console.error('[BlueprintAgent] could not read the edited blueprint', err);
      return this.set({ busy: null, error: { error: apiError('bad_response'), action: 'none' } });
    }
    // The server's own wording for what changed, plus the server-computed estimate.
    const said = [...changes, ...refused].join(' ');
    const line = changes.length > 0 ? `${this.demo ? 'The example estimate is now' : 'Your estimate is now'} ${estimateText(view.price)}.` : estimate;
    this.push('assistant', `${said ? `${said} ` : ''}${line}`.trim(), {
      notices: notice ? [notice] : undefined,
    });
    this.set({ busy: null, blueprint: r.data.blueprint });
  }
}
