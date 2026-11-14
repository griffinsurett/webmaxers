// src/components/BlueprintAgent/BlueprintAgent.tsx
// The Blueprint Agent UI. All behavior lives in AgentController (controller.ts): this file only
// renders its state and forwards clicks. Everything shown as text is rendered as plain text by
// React (never as HTML), because it originates from a model or from visitor input.
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  LuArrowRight,
  LuBot,
  LuBriefcase,
  LuCalendar,
  LuCheck,
  LuChevronRight,
  LuCircleCheck,
  LuGlobe,
  LuLayers,
  LuLoader,
  LuLock,
  LuMaximize2,
  LuMessageSquare,
  LuMinimize2,
  LuPlus,
  LuDownload,
  LuReceipt,
  LuRefreshCw,
  LuRotateCcw,
  LuSend,
  LuSlidersHorizontal,
  LuSparkles,
  LuTriangleAlert,
  LuWifiOff,
  LuX,
} from 'react-icons/lu';
import { CALENDLY_URL, ctaData } from '@/content/siteData';
import { money, toViewBlueprint, type ViewPage } from './adapter';
import { MAX_MESSAGE_CHARS } from './api';
import { downloadBlueprintPdf } from './pdf';
import { AgentController, MAX_SESSION_MESSAGES, type AgentState } from './controller';
import type { ChatMessage } from './types';
import { AgentErrorBoundary } from './ErrorBoundary';

type Tab = 'sitemap' | 'strategy' | 'addons' | 'cost';

/** Derived from the site's accent at a fixed lightness, so text contrast holds whichever accent a visitor picks. */
const TOOL_COLORS = {
  '--tool-accent': 'oklch(from var(--color-accent, #5e76f6) 0.52 c h)',
  '--tool-accent-text': 'oklch(from var(--color-accent, #5e76f6) 0.8 c h)',
} as React.CSSProperties;

function BlueprintAgentInner() {
  // The controller can be swapped: live assistant <-> the in-browser demo (chosen by the visitor).
  const [ctrl, setCtrl] = useState<AgentController>(() => new AgentController());
  const state: AgentState = useSyncExternalStore(ctrl.subscribe, ctrl.getState, ctrl.getState);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoFailed, setDemoFailed] = useState(false);

  useEffect(() => {
    void ctrl.init();
    return () => ctrl.dispose();
  }, [ctrl]);

  // Always the controller currently on screen, so a slow demo download can check what is true NOW.
  const ctrlRef = useRef(ctrl);
  ctrlRef.current = ctrl;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startDemo = async () => {
    if (demoLoading || ctrlRef.current.getState().demo) return;
    setDemoLoading(true);
    setDemoFailed(false);
    try {
      const { createDemoApi } = await import('./demoApi'); // loaded only when chosen
      // The visitor chose the demo while the assistant was unreachable. If anything changed while the
      // file downloaded (they retried and the assistant came back), a demo must never replace it.
      if (mountedRef.current && ctrlRef.current.getState().boot === 'offline') {
        setCtrl(new AgentController({ api: createDemoApi(), demo: true }));
      }
    } catch (err) {
      console.error('[BlueprintAgent] demo failed to load', err);
      if (mountedRef.current) setDemoFailed(true);
    } finally {
      if (mountedRef.current) setDemoLoading(false);
    }
  };
  const exitDemo = () => setCtrl(new AgentController());

  const view = useMemo(() => (state.blueprint ? toViewBlueprint(state.blueprint) : null), [state.blueprint]);

  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sitemap');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  // View mode for desktop: 'split' (chat left + sitemap right) or 'full-canvas'
  const [desktopView, setDesktopView] = useState<'split' | 'full-canvas'>('split');
  const [mobileTab, setMobileTab] = useState<'sitemap' | 'chat'>('sitemap');
  // The page-details popup, and the visitor's note about what content a page should have.
  const [detailOpen, setDetailOpen] = useState(false);
  const [contentNote, setContentNote] = useState('');
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'failed'>('idle');
  useEffect(() => {
    setInput('');
    setUrlInput('');
    setShowUrlField(false);
    setActiveTab('sitemap');
    setSelectedPageId(null);
    setMobileTab('sitemap');
    setDetailOpen(false);
    setContentNote('');
    setDesktopView('split');
  }, [ctrl]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state.messages, state.job, state.busy, state.error]);

  // A new error / notice must be seen even if the visitor is scrolled far down (phones).
  const hasStatus = !!(state.error || state.blockedMessage);
  useEffect(() => {
    if (hasStatus) statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hasStatus, state.error]);

  // Keep a valid page selected as the blueprint appears or pages change.
  useEffect(() => {
    if (!view) return setSelectedPageId(null);
    if (selectedPageId && view.pages.some((p) => p.id === selectedPageId)) return;
    const first = view.groups.recommended[0] ?? view.pages[0];
    setSelectedPageId(first ? first.id : null);
  }, [view, selectedPageId]);

  // Clicking a page card opens its details in a popup, so something visible always happens.
  const selectPage = (id: string) => {
    setSelectedPageId(id);
    setContentNote('');
    setDetailOpen(true);
  };
  const closeDetail = () => setDetailOpen(false);

  const downloadPdf = async () => {
    if (!view || pdfState === 'working') return;
    setPdfState('working');
    try {
      await downloadBlueprintPdf(view, { demo: state.demo });
      setPdfState('idle');
    } catch {
      setPdfState('failed');
    }
  };

  // Esc closes the popup (or leaves full screen); the page behind does not scroll while either is open.
  useEffect(() => {
    if (!detailOpen && desktopView !== 'full-canvas') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (detailOpen) setDetailOpen(false);
      else setDesktopView('split');
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [detailOpen, desktopView]);

  const selectedPage = view?.pages.find((p) => p.id === selectedPageId) ?? null;

  const working = state.busy !== null || state.job !== null;
  const inputEnabled = state.boot === 'ready' && !working && !state.blockedMessage;
  const canEdit = !!view && !working && !state.blockedMessage;

  const handleSend = (override?: string) => {
    if (!inputEnabled) return;
    const canned = override !== undefined;
    const text = (override ?? input).trim();
    const url = canned ? '' : urlInput.trim();
    const full = url ? `${text}${text ? '\n' : ''}${url}` : text;
    if (!full) return;
    if (full.length > MAX_MESSAGE_CHARS) {
      // Keep the draft so nothing typed is lost; the controller explains why it was not sent.
      void ctrl.send(full);
      return;
    }
    if (!canned) {
      setInput('');
      setUrlInput('');
      setShowUrlField(false);
    }
    void ctrl.send(full);
  };

  const togglePage = (p: ViewPage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canEdit) return;
    void ctrl.edit([{ op: p.included ? 'remove_page' : 'restore_page', id: p.id }]);
  };

  const confirmReset = () => {
    if (!state.sessionId || window.confirm('Start a new conversation? Your current plan will be cleared.')) ctrl.reset();
  };

  const badge = state.demo
    ? 'Demo mode'
    : state.boot === 'offline'
    ? 'Offline'
    : state.boot === 'checking'
    ? 'Connecting…'
    : view
    ? 'Blueprint Active'
    : 'Discovery Mode';
  const amber = state.demo || state.boot === 'offline';

  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------

  const errorBanner = (
      state.error && (
        <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100" role="alert">
          <LuTriangleAlert className="w-4 h-4 flex-shrink-0 text-amber-300 mt-0.5" />
          <div className="space-y-2 min-w-0">
            <p className="leading-relaxed text-amber-100">{state.error.error.message}</p>
            <div className="flex flex-wrap gap-2">
              {state.error.action !== 'none' && state.error.error.retryable && (
                <button type="button" onClick={() => ctrl.retry()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5">
                  <LuRefreshCw className="w-3 h-3" />
                  <span>Try again</span>
                </button>
              )}
              {state.error.error.kind === 'expired' && (
                <button type="button" onClick={() => ctrl.reset()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40">
                  Start a new conversation
                </button>
              )}
              {!(state.error.action === 'job' && state.error.error.retryable) && (
                <button type="button" onClick={() => ctrl.dismissError()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg text-amber-200/80 hover:text-white">
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )
  );

  const messageList = (compact: boolean) => (
    <>
      {state.messages.map((msg: ChatMessage) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={`flex ${compact ? 'gap-3' : 'gap-3.5'} ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
              <div
                className={`${compact ? 'w-7 h-7 rounded-lg' : 'w-8 h-8 rounded-xl'} bg-accent/20 border border-accent/40 flex-shrink-0 flex items-center justify-center text-[var(--tool-accent-text)] mt-0.5`}
              >
                <LuBot className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </div>
            )}
            <div
              className={`${compact ? 'max-w-[92%] sm:max-w-[88%] px-4 py-3 text-sm' : 'max-w-[92%] sm:max-w-[80%] px-4 sm:px-5 py-3 sm:py-4 text-sm'} rounded-2xl leading-relaxed ${
                isUser
                  ? 'bg-[var(--tool-accent)] text-white font-medium rounded-tr-none shadow-md'
                  : 'bg-[#121217] border border-white/10 text-zinc-200 rounded-tl-none space-y-3'
              }`}
            >
              <div className="whitespace-pre-line break-words">{msg.content}</div>

              {msg.notices && msg.notices.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {msg.notices.map((n, i) => (
                    <li key={i} className="flex gap-2 text-[11px] text-amber-300/90 leading-relaxed">
                      <LuTriangleAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}

              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {msg.quickActions.map((qa) => (
                    <button
                      key={qa.label}
                      type="button"
                      disabled={!inputEnabled}
                      onClick={() => handleSend(qa.action)}
                      className="px-3.5 py-2.5 lg:py-2 min-h-[44px] lg:min-h-0 rounded-xl bg-white/5 hover:bg-accent/20 disabled:opacity-50 border border-white/10 hover:border-accent/40 text-sm lg:text-xs text-zinc-300 hover:text-white transition-all text-left flex items-center gap-1.5"
                    >
                      <span>{qa.label}</span>
                      <LuChevronRight className="w-3 h-3 text-[var(--tool-accent-text)]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Live progress while research / the blueprint is being built */}
      {state.job && (
        <div className="flex gap-3.5 justify-start">
          <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex-shrink-0 flex items-center justify-center text-[var(--tool-accent-text)] mt-0.5">
            <LuBot className="w-4 h-4" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-[#121217] border border-white/10 p-5 space-y-3" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tool-accent-text)] uppercase tracking-wider">
              <LuSparkles className="w-4 h-4 animate-spin text-[var(--tool-accent-text)]" />
              <span>{state.job.kind === 'research' ? 'Researching your competitors' : 'Building your blueprint'}</span>
            </div>
            <div className="space-y-2 pt-1">
              {state.job.steps.map((step) => (
                <div key={step.key} className="text-xs">
                  <div className="flex items-center gap-2.5">
                    {step.status === 'done' ? (
                      <LuCircleCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : step.status === 'active' ? (
                      <LuLoader className="w-4 h-4 text-[var(--tool-accent-text)] animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />
                    )}
                    <span className={step.status === 'done' ? 'text-zinc-200' : step.status === 'active' ? 'text-white font-medium' : 'text-zinc-400'}>
                      {step.text}
                    </span>
                  </div>
                  {step.detail && step.status !== 'pending' && <p className="pl-[26px] pt-0.5 text-[11px] text-zinc-400 break-words">{step.detail}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-400 pt-1">This can take a minute or two. You can safely refresh the page.</p>
          </div>
        </div>
      )}

      {/* A reply is on its way */}
      {state.busy && !state.job && (
        <div className="flex items-center gap-2 text-xs text-[var(--tool-accent-text)] p-3 rounded-xl bg-[#14141a] border border-white/10 w-fit" role="status">
          <LuLoader className="w-4 h-4 animate-spin text-[var(--tool-accent-text)]" />
          <span>{state.busy === 'edit' ? 'Updating your plan…' : view ? 'Strategist is reviewing and recalculating…' : 'Thinking…'}</span>
        </div>
      )}

      {!view && offlineNotice}
      {!view && errorBanner}
      <div ref={chatEndRef} />
    </>
  );

  const blockedNotice = state.blockedMessage ? (
    <div className="flex gap-2.5 p-3.5 rounded-xl bg-[#141419] border border-white/10 text-xs text-zinc-300" role="alert">
      <LuLock className="w-4 h-4 flex-shrink-0 text-zinc-400 mt-0.5" />
      <div className="space-y-2">
        <p className="leading-relaxed text-zinc-200">{state.blockedMessage}</p>
        <button type="button" onClick={() => ctrl.reset()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
          Start a new conversation
        </button>
      </div>
    </div>
  ) : null;

  const offlineNotice =
    state.boot === 'offline' ? (
      <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100" role="alert">
        <LuWifiOff className="w-4 h-4 flex-shrink-0 text-amber-300 mt-0.5" />
        <div className="space-y-2">
          <p className="leading-relaxed text-amber-100">The blueprint assistant isn't reachable right now. Please try again in a moment.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void ctrl.init()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5">
              <LuRefreshCw className="w-3 h-3" />
              <span>Try again</span>
            </button>
            {!state.demo && (
              <button type="button" disabled={demoLoading} onClick={() => void startDemo()} className="px-4 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-60 border border-white/15 text-zinc-100">
                {demoLoading ? 'Loading demo…' : 'Try a demo'}
              </button>
            )}
          </div>
          <span role="status" className="sr-only">{demoLoading ? 'Loading the demo' : ''}</span>
          {demoFailed && <p className="text-[11px] text-amber-200/80">The demo couldn't load either. Please check your connection and try again.</p>}
          <p className="text-[11px] text-amber-200/70">The demo shows an example plan for a sample business. It is not a quote.</p>
        </div>
      </div>
    ) : null;

  // Visible on every tab and on mobile: errors, offline and "conversation ended" notices.
  const statusStrip =
    state.error || state.blockedMessage || state.boot === 'offline' ? (
      <div ref={statusRef} className="px-4 sm:px-6 py-3 bg-[#0b0b0e] border-b border-white/10 space-y-2 scroll-mt-40">
        {offlineNotice}
        {errorBanner}
        {blockedNotice}
      </div>
    ) : null;

  const placeholder = state.job
    ? 'Working on it. This takes a moment…'
    : state.blockedMessage
    ? 'This conversation has ended.'
    : state.boot === 'offline'
    ? 'Assistant unavailable…'
    : view
    ? 'Ask a question or adjust your blueprint...'
    : 'Describe your business, services, or paste your URL...';

  const pageCard = (page: ViewPage, kind: 'core' | 'recommended' | 'future') => {
    const isSelected = selectedPageId === page.id;
    const included = page.included;
    return (
      <div
        key={page.id}
        role="button"
        tabIndex={0}
        onClick={() => selectPage(page.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return; // keys from the nested ✕/Add button are its own
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectPage(page.id);
          }
        }}
        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all relative ${
          !included
            ? 'opacity-60 border-dashed border-white/20 bg-transparent'
            : isSelected
            ? 'bg-accent/10 border-accent text-white shadow-lg'
            : 'bg-[#14141a] border-white/10 hover:border-white/25 text-zinc-300'
        }`}
      >
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="font-bold text-xs text-white truncate">{page.title}</span>
          {included && page.removable && (
            <button
              type="button"
              disabled={!canEdit}
              onClick={(e) => togglePage(page, e)}
              title="Remove from your plan"
              aria-label={`Remove ${page.title}`}
              className="w-10 h-10 -mt-2 -mr-2 lg:w-5 lg:h-5 lg:m-0 rounded-lg lg:rounded-md bg-red-500/10 hover:bg-red-500 disabled:opacity-40 text-red-400 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              <LuX className="w-4 h-4 lg:w-3 lg:h-3" />
            </button>
          )}
          {!included && (
            <button
              type="button"
              disabled={!canEdit}
              onClick={(e) => togglePage(page, e)}
              title="Add to your plan"
              aria-label={`Add ${page.title}`}
              className="px-3 py-2 min-h-[40px] -mt-1 -mr-1 lg:m-0 lg:min-h-0 lg:px-1.5 lg:py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-40 text-xs lg:text-[11px] font-medium flex items-center gap-1 transition-colors flex-shrink-0"
            >
              <LuPlus className="w-2.5 h-2.5" />
              <span>Add</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{page.purpose}</p>
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          {included ? (
            page.estimatedCost > 0 ? (
              <span className="text-[var(--tool-accent-text)] font-bold">+{money(page.estimatedCost)}</span>
            ) : (
              <span className="text-emerald-400 font-medium">✓ {kind === 'core' ? 'Core page' : 'Included'}</span>
            )
          ) : (
            <span className="text-zinc-400">{kind === 'future' ? 'Optional idea' : 'Removed'}</span>
          )}
          <span className="font-mono text-zinc-400 truncate ml-2">{page.path}</span>
        </div>
      </div>
    );
  };

  const panelScroll = desktopView === 'full-canvas' ? '' : 'lg:overflow-y-auto lg:min-h-[680px] lg:max-h-[780px]';
  const gridCols = (full: string, split: string) => (desktopView === 'full-canvas' ? full : split);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={TOOL_COLORS}
      className={
        desktopView === 'full-canvas'
          ? 'fixed inset-0 z-[110] w-full overflow-y-auto bg-[#09090b] flex flex-col'
          : 'w-full max-w-7xl mx-auto rounded-3xl bg-[#09090b] border border-white/10 shadow-2xl overflow-clip flex flex-col my-4 sm:my-6'
      }
    >
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#0e0e12] flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-[var(--tool-accent-text)] shadow-inner">
            <LuBot className="w-5 h-5 text-[var(--tool-accent-text)]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-white text-sm sm:text-base font-semibold tracking-wide">Webmaxxers AI Website Strategist</h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                  amber
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${amber ? 'bg-amber-300' : 'bg-emerald-400'}`}></span>
                {badge}
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">
              {view
                ? `${view.summary.businessName} • ${view.summary.industry}`
                : state.progress.required > 0 && state.progress.filled < state.progress.required
                ? `${state.progress.filled} of ${state.progress.required} details gathered`
                : 'Information Architecture • Strategic Content Planning • Deterministic Estimator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs text-zinc-400 shrink-0">
          {view && (
            <div className="hidden lg:flex items-center gap-1 bg-[#14141a] p-1 rounded-xl border border-white/10">
              {(['split', 'full-canvas'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDesktopView(mode)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    desktopView === mode ? 'bg-[var(--tool-accent)] text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode === 'split' ? <LuSlidersHorizontal className="w-3.5 h-3.5" /> : <LuMaximize2 className="w-3.5 h-3.5" />}
                  <span>{mode === 'split' ? 'Split Workspace' : 'Full Canvas'}</span>
                </button>
              ))}
            </div>
          )}


          {!state.demo && (
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2" title="Messages sent in this conversation">
            <span className="hidden sm:inline">Messages:</span>
            <span className="text-white font-medium">
              {state.userMessageCount}/{MAX_SESSION_MESSAGES}
            </span>
          </div>
          )}

          <button
            type="button"
            onClick={confirmReset}
            title="Start a new conversation"
            aria-label="Start a new conversation"
            className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <LuRotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {state.demo && (
        <div className="px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100" role="note">
          <span>Demo mode: an example plan for a sample business. Prices are examples, not a quote.</span>
          <button type="button" onClick={exitDemo} className="px-4 py-2 min-h-[40px] lg:min-h-0 lg:px-3 lg:py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40">
            Exit demo
          </button>
        </div>
      )}

      {/* STATE 1: DISCOVERY (before a blueprint exists) */}
      {!view && (
        <div className="flex flex-col flex-1">
          <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 min-h-[50dvh] sm:min-h-[520px] max-h-[70dvh] sm:max-h-[680px] overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation">
            {messageList(false)}
          </div>

          <div className="p-4 sm:p-5 bg-[#0e0e12] border-t border-white/10 space-y-2">
            {blockedNotice}

            {showUrlField && !blockedNotice && (
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#141419] border border-white/10">
                <LuGlobe className="w-4 h-4 text-[var(--tool-accent-text)] ml-2" />
                <input
                  type="url"
                  placeholder="https://yourwebsite.com or competitor.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-transparent text-base lg:text-xs text-white placeholder-zinc-400 focus:outline-none px-2 py-2 lg:py-0"
                />
                <button type="button" onClick={() => setShowUrlField(false)} className="p-3 lg:p-1 text-zinc-400 hover:text-white" aria-label="Close URL field">
                  <LuX className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!blockedNotice && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2"
              >
                <div className="flex-1 rounded-2xl bg-[#141419] border border-white/10 focus-within:border-accent/60 transition-colors p-3 flex flex-col gap-1.5">
                  <textarea
                    rows={2}
                    value={input}
                    disabled={!inputEnabled}
                    maxLength={1000}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={placeholder}
                    aria-label="Your message"
                    className="w-full bg-transparent text-base lg:text-sm text-white placeholder-zinc-400 resize-none focus:outline-none disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <button
                      type="button"
                      disabled={!inputEnabled}
                      onClick={() => setShowUrlField(!showUrlField)}
                      className={`text-xs flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] lg:min-h-0 lg:py-1 whitespace-nowrap rounded-lg transition-colors disabled:opacity-50 ${
                        showUrlField || urlInput ? 'bg-accent/20 text-[var(--tool-accent-text)] font-medium' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <LuGlobe className="w-3.5 h-3.5" />
                      <span>{urlInput ? 'URL Attached' : 'Attach Website URL'}</span>
                    </button>
                    <span className="hidden sm:inline text-[11px] text-zinc-400">Press Enter ↵ to send</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!inputEnabled || (!input.trim() && !urlInput.trim())}
                  className="w-12 h-12 rounded-2xl bg-[var(--tool-accent)] hover:brightness-110 disabled:opacity-40  text-white flex items-center justify-center transition-all shadow-lg flex-shrink-0"
                  title="Send Message"
                  aria-label="Send message"
                >
                  <LuSend className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* STATE 2: BLUEPRINT WORKSPACE */}
      {view && statusStrip}
      {view && (
        <div className="lg:hidden sticky top-[3.8rem] z-30 grid grid-cols-2 gap-2 px-4 py-2 bg-[#0e0e12]/95 backdrop-blur border-b border-white/10" role="tablist" aria-label="Plan or chat">
          {(['sitemap', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                mobileTab === tab ? 'bg-[var(--tool-accent)] text-white shadow' : 'bg-white/5 text-zinc-300 border border-white/10'
              }`}
            >
              {tab === 'sitemap' ? <LuLayers className="w-4 h-4" /> : <LuMessageSquare className="w-4 h-4" />}
              <span>{tab === 'sitemap' ? 'Your plan' : 'Chat'}</span>
            </button>
          ))}
        </div>
      )}
      {view && (
        <div className={`w-full ${desktopView === 'split' ? 'lg:min-h-[900px] lg:grid lg:grid-cols-12' : 'flex flex-col flex-1'}`}>
          {/* LEFT: chat */}
          <div
            className={`border-r border-white/10 flex-col bg-[#0b0b0e] ${
              desktopView === 'full-canvas' ? 'hidden' : mobileTab === 'chat' ? 'flex lg:col-span-5' : 'hidden lg:flex lg:col-span-5'
            }`}
          >
            <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-[#0e0e13] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <LuMessageSquare className="w-4 h-4 text-[var(--tool-accent-text)]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Strategist Q&A & Refinements</h4>
              </div>
              <span className="hidden sm:inline text-[11px] text-zinc-400 whitespace-nowrap">Live Assistant</span>
            </div>

            <div className="flex-1 p-4 sm:p-5 space-y-4 lg:overflow-y-auto min-h-[45dvh] lg:min-h-[680px] lg:max-h-[780px]" role="log" aria-live="polite" aria-label="Conversation">
              {messageList(true)}
            </div>

            <div className="sticky bottom-[5.5rem] lg:static z-20 bg-[#0b0b0e]">
            {!blockedNotice && (
              <div className="px-4 py-2 border-t border-white/5 bg-[#0e0e13] flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-visible">
                {['Why dedicated service pages?', 'Can we add online booking?', "What's my total price?"].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    disabled={!inputEnabled}
                    onClick={() => handleSend(pill)}
                    className="shrink-0 whitespace-nowrap px-3 py-2 min-h-[40px] lg:min-h-0 lg:px-2.5 lg:py-1 rounded-lg bg-white/5 hover:bg-accent/20 disabled:opacity-50 border border-white/10 text-xs lg:text-[11px] text-zinc-300 hover:text-white transition-colors"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 bg-[#0a0a0d] border-t border-white/10 space-y-2">
              {/* blocked and error notices live in the shared strip above the workspace */}
              {!state.blockedMessage && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    disabled={!inputEnabled}
                    maxLength={1000}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={placeholder}
                    aria-label="Your message"
                    className="flex-1 min-w-0 bg-[#141419] border border-white/10 rounded-xl px-3 py-3 lg:py-2 text-base lg:text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-accent/60 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!inputEnabled || !input.trim()}
                    aria-label="Send message"
                    className="w-11 h-11 lg:w-auto lg:h-auto lg:p-2.5 flex items-center justify-center rounded-xl bg-[var(--tool-accent)] hover:brightness-110 disabled:opacity-40 text-white flex-shrink-0"
                  >
                    <LuSend className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
            </div>
          </div>

          {/* RIGHT: blueprint */}
          <div
            className={`flex-col bg-[#08080a] ${desktopView === 'split' ? 'lg:col-span-7' : 'w-full flex-1'} ${
              mobileTab === 'sitemap' || desktopView === 'full-canvas' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 sm:px-6 py-3 border-b border-white/10 bg-[#0e0e13] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible w-full sm:w-auto">
                {(
                  [
                    ['sitemap', LuLayers, `Visual Sitemap (${view.includedPageCount})`, `Pages (${view.includedPageCount})`],
                    ['strategy', LuBriefcase, 'Business Strategy', 'Strategy'],
                    ['addons', LuSlidersHorizontal, `Functionality Add-ons (${view.includedAddonCount})`, `Add-ons (${view.includedAddonCount})`],
                    ['cost', LuReceipt, `Project Cost (${money(view.price.total)})`, money(view.price.total)],
                  ] as const
                ).map(([key, Icon, label, short]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 sm:flex-none justify-center px-2 sm:px-3.5 py-2.5 min-h-[44px] lg:min-h-0 lg:px-3 lg:py-1.5 sm:shrink-0 whitespace-nowrap rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      activeTab === key ? 'bg-accent/20 text-[var(--tool-accent-text)] border border-accent/40' : 'text-zinc-400 hover:text-white bg-white/5 border border-white/5'
                    }`}
                  >
                    <Icon className="hidden sm:block w-3.5 h-3.5" />
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDesktopView(desktopView === 'full-canvas' ? 'split' : 'full-canvas')}
                aria-pressed={desktopView === 'full-canvas'}
                className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 px-3 py-2 min-h-[44px] lg:min-h-0 lg:py-1.5 rounded-lg border border-white/10 whitespace-nowrap"
              >
                {desktopView === 'full-canvas' ? <LuMinimize2 className="w-3.5 h-3.5" /> : <LuMaximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{desktopView === 'full-canvas' ? 'Show chat' : 'Hide chat · full screen'}</span>
                <span className="sm:hidden">{desktopView === 'full-canvas' ? 'Chat' : 'Full'}</span>
              </button>
            </div>

            {/* TAB 1: SITEMAP */}
            {activeTab === 'sitemap' && (
              <div className={`flex-1 p-4 sm:p-7 space-y-6 ${panelScroll}`}>
                <div className="p-3.5 rounded-2xl bg-accent/10 border border-accent/25 text-xs text-zinc-300 space-y-2">
                  <p className="text-zinc-200">
                    Click any page card to inspect planned content. Click <strong className="text-red-400">✕</strong> to remove a page and instantly recalculate
                    your investment.
                  </p>
                  {(view.partial || view.notices.length > 0) && (
                    <ul className="space-y-1 pt-1 border-t border-white/10">
                      {view.notices.map((n, i) => (
                        <li key={i} className="flex gap-2 text-[11px] text-amber-300/90 leading-relaxed pt-1">
                          <LuTriangleAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Core pages */}
                {view.groups.core.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {view.price.websiteName} ({money(view.price.base)})
                        </span>
                        <h5 className="text-xs font-semibold text-white">Core Pages</h5>
                      </div>
                      <span className="text-[11px] text-zinc-400">Base price covers up to {view.price.includedPages} pages</span>
                    </div>
                    <div className={`grid gap-2.5 ${gridCols('grid-cols-1 sm:grid-cols-2 lg:grid-cols-5', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}`}>
                      {view.groups.core.map((p) => pageCard(p, 'core'))}
                    </div>
                  </div>
                )}

                {/* Recommended pages */}
                {view.groups.recommended.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] uppercase font-bold tracking-wider bg-accent/15 text-[var(--tool-accent-text)] border border-accent/30">
                          Recommended Pages
                        </span>
                        <h5 className="text-xs font-semibold text-white">Built around what your customers search for</h5>
                      </div>
                      <span className="text-[11px] text-zinc-400">Click ✕ to remove</span>
                    </div>
                    <div className={`grid gap-2.5 ${gridCols('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}`}>
                      {view.groups.recommended.map((p) => pageCard(p, 'recommended'))}
                    </div>
                  </div>
                )}

                {/* Future ideas */}
                {view.groups.future.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] uppercase font-bold tracking-wider bg-white/5 text-zinc-300 border border-white/15">
                          Future Ideas
                        </span>
                        <h5 className="text-xs font-semibold text-white">Optional pages you can add now or later</h5>
                      </div>
                    </div>
                    <div className={`grid gap-2.5 ${gridCols('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}`}>
                      {view.groups.future.map((p) => pageCard(p, 'future'))}
                    </div>
                  </div>
                )}

                {/* Selected page: opens as a popup */}
                {selectedPage && detailOpen && (
                  <div
                    className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6"
                    onClick={closeDetail}
                  >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${selectedPage.title} page details`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 rounded-t-3xl sm:rounded-3xl bg-[#14141c] border border-white/10 shadow-2xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h5 className="text-sm font-bold text-white">{selectedPage.title}</h5>
                          <span className="text-xs font-mono text-[var(--tool-accent-text)]">{selectedPage.path}</span>
                          {selectedPage.outlineOnly && (
                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-zinc-400">Outline only</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-300">{selectedPage.purpose}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={closeDetail}
                          aria-label="Close page details"
                          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center"
                        >
                          <LuX className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-emerald-400">
                          {!selectedPage.included
                            ? 'Not in your plan'
                            : selectedPage.estimatedCost > 0
                            ? `+${money(selectedPage.estimatedCost)} Investment`
                            : `Included in base (${money(view.price.base)})`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
                      <div className="space-y-1">
                        <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[11px]">Why Webmaxxers Recommends It:</span>
                        <p className="text-zinc-300 leading-relaxed">{selectedPage.why}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[11px]">Primary Conversion CTA:</span>
                        <div className="flex items-center gap-1.5 text-[var(--tool-accent-text)] font-medium">
                          <LuArrowRight className="w-3.5 h-3.5" />
                          <span>{selectedPage.cta}</span>
                        </div>
                      </div>
                    </div>

                    {selectedPage.evidence.length > 0 && (
                      <div className="pt-1">
                        <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[11px] block mb-1.5">Based on what I found:</span>
                        <ul className="space-y-1 text-xs text-zinc-300">
                          {selectedPage.evidence.map((e, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5"></span>
                              <span>{e}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedPage.sections.length > 0 && (
                      <div className="pt-2">
                        <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[11px] block mb-1.5">Planned Content:</span>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
                          {selectedPage.sections.map((s, idx) => (
                            <li key={idx} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                              <div className="font-semibold text-white">{s.heading}</div>
                              {s.purpose && <div className="text-[11px] text-zinc-400 leading-relaxed">{s.purpose}</div>}
                              {s.subsections.length > 0 && (
                                <ul className="pt-1 space-y-0.5">
                                  {s.subsections.map((sub, j) => (
                                    <li key={j} className="flex gap-1.5 text-[11px] text-zinc-300">
                                      <span className="w-1 h-1 rounded-full bg-[var(--tool-accent)] flex-shrink-0 mt-1.5"></span>
                                      <span>{sub.heading}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <label htmlFor="page-content-note" className="font-semibold text-zinc-400 uppercase tracking-wider text-[11px] block">
                        Tell us what should be on this page
                      </label>
                      <textarea
                        id="page-content-note"
                        value={contentNote}
                        onChange={(e) => setContentNote(e.target.value)}
                        maxLength={600}
                        rows={3}
                        disabled={!inputEnabled}
                        placeholder="e.g. Show our 10-year warranty, add a gallery of finished roofs, and mention we serve Dallas and Plano."
                        className="w-full bg-[#0f0f14] border border-white/10 rounded-xl px-3 py-2 text-base sm:text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent/60 disabled:opacity-60"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-zinc-500">{inputEnabled ? 'The strategist will update the plan.' : 'Available when the strategist is idle.'}</span>
                        <button
                          type="button"
                          disabled={!inputEnabled || !contentNote.trim()}
                          onClick={() => {
                            const note = contentNote.trim();
                            const title = selectedPage.title;
                            const path = selectedPage.path;
                            closeDetail();
                            setContentNote('');
                            setMobileTab('chat');
                            handleSend(`For the ${title} page (${path}), here is what I want on it: ${note}`);
                          }}
                          className="px-4 py-2.5 min-h-[44px] sm:min-h-0 sm:py-2 rounded-xl bg-[var(--tool-accent)] hover:brightness-110 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <LuSend className="w-3.5 h-3.5" />
                          <span>Send to strategist</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STRATEGY */}
            {activeTab === 'strategy' && (
              <div className={`flex-1 p-4 sm:p-6 space-y-6 ${panelScroll} text-sm`}>
                <div className="p-5 rounded-2xl bg-[#14141c] border border-white/10 space-y-4">
                  <div className="border-b border-white/10 pb-3">
                    <span className="text-[11px] uppercase font-bold text-[var(--tool-accent-text)] tracking-wider block">Target Audience</span>
                    <p className="text-zinc-200 mt-1 text-sm">{view.summary.primaryAudience}</p>
                  </div>
                  <div className="border-b border-white/10 pb-3">
                    <span className="text-[11px] uppercase font-bold text-[var(--tool-accent-text)] tracking-wider block">Primary Website Goal</span>
                    <p className="text-zinc-200 mt-1 text-sm font-semibold">{view.summary.primaryGoal}</p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-[var(--tool-accent-text)] tracking-wider block">Recommended Strategic Posture</span>
                    <p className="text-zinc-300 mt-1 leading-relaxed">{view.summary.recommendedStrategy}</p>
                  </div>
                </div>

                {view.articles.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-xs font-semibold text-white">Content ideas</h5>
                      <p className="text-[11px] text-zinc-400">Articles that answer real customer questions and lead them to the right page.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {view.articles.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => void ctrl.edit([{ op: 'toggle_article', id: a.id, on: !a.included }])}
                          className={`p-3.5 rounded-2xl border text-left transition-all disabled:cursor-not-allowed ${
                            a.included ? 'bg-accent/10 border-accent text-white' : 'bg-[#14141a] border-white/10 text-zinc-400 opacity-70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <span className="font-bold text-xs text-white block">{a.title}</span>
                              <span className="text-[11px] text-zinc-400 block leading-relaxed">{a.customerQuestion}</span>
                              {a.estimatedCost > 0 && <span className="text-[11px] text-[var(--tool-accent-text)] font-bold">+{money(a.estimatedCost)}</span>}
                            </div>
                            <div className={`w-4 h-4 mt-0.5 rounded-md flex items-center justify-center border flex-shrink-0 ${a.included ? 'bg-[var(--tool-accent)] border-accent text-white' : 'border-white/20'}`}>
                              {a.included && <LuCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ADD-ONS */}
            {activeTab === 'addons' && (
              <div className={`flex-1 p-4 sm:p-6 space-y-4 ${panelScroll}`}>
                <p className="text-xs text-zinc-400">Toggle functional capabilities to fit your workflow. Pricing updates automatically.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {view.addons.map((addon) => (
                    <button
                      key={addon.sku}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => void ctrl.edit([{ op: 'toggle_addon', sku: addon.sku, on: !addon.included }])}
                      className={`p-4 rounded-2xl border text-left transition-all disabled:cursor-not-allowed ${
                        addon.included ? 'bg-accent/10 border-accent text-white' : 'bg-[#14141a] border-white/10 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="font-bold text-xs text-white">{addon.name}</span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[11px] border flex-shrink-0 ${addon.included ? 'bg-[var(--tool-accent)] border-accent text-white' : 'border-white/20'}`}>
                          {addon.included && <LuCheck className="w-3 h-3" />}
                        </div>
                      </div>
                      {addon.recommended && (
                        <span className="inline-block mb-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">Recommended for you</span>
                      )}
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{addon.purpose}</p>
                      {addon.reason && <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">{addon.reason}</p>}
                      {addon.evidence.length > 0 && <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">Based on: {addon.evidence.join(' · ')}</p>}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--tool-accent-text)] font-bold">+{money(addon.setupCost)} setup</span>
                        {addon.monthlyCost > 0 && <span className="text-zinc-400">+{money(addon.monthlyCost)}/mo</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PROJECT COST (the server's itemised price; it follows every page and add-on change) */}
            {activeTab === 'cost' && (
              <div className={`flex-1 p-4 sm:p-6 space-y-5 ${panelScroll}`}>
                <div>
                  <h5 className="text-sm font-bold text-white">{state.demo ? 'Example project cost' : 'Your project cost'}</h5>
                  <p className="text-[11px] text-zinc-400">
                    Updates instantly when you add or remove a page or add-on. {state.demo ? 'These are example figures.' : 'Every figure is calculated from our price list.'}
                  </p>
                </div>

                {(() => {
                  const b = view.breakdown;
                  const Row = ({ label, note, amount, monthly }: { label: string; note?: string; amount: number; monthly?: number }) => (
                    <li className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-200">{label}</div>
                        {note && <div className="text-[11px] text-zinc-500 leading-relaxed">{note}</div>}
                      </div>
                      <div className="text-right shrink-0 text-xs">
                        <div className="font-semibold text-white">{amount > 0 ? money(amount) : 'Included'}</div>
                        {!!monthly && monthly > 0 && <div className="text-[11px] text-zinc-400">+{money(monthly)}/mo</div>}
                      </div>
                    </li>
                  );
                  const Group = ({ title, sub, total, children }: { title: string; sub?: string; total: number; children: React.ReactNode }) => (
                    <section className="rounded-2xl bg-[#14141c] border border-white/10 p-4">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <div>
                          <h6 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h6>
                          {sub && <p className="text-[11px] text-zinc-400">{sub}</p>}
                        </div>
                        <span className="text-sm font-bold text-[var(--tool-accent-text)]">{money(total)}</span>
                      </div>
                      <ul>{children}</ul>
                    </section>
                  );
                  return (
                    <div className="space-y-3">
                      <Group title={b.package.name} sub={`Base price covers up to ${b.package.includedPages} pages`} total={b.package.base}>
                        {b.covered.length === 0 && <Row label="Core pages" amount={0} />}
                        {b.covered.map((l) => <Row key={l.id} label={l.title} note={l.note} amount={l.amount} />)}
                      </Group>
                      {b.extraPages.length > 0 && (
                        <Group title={`Extra pages (${b.extraPages.length})`} sub="Pages beyond the base allowance" total={view.price.extraPages}>
                          {b.extraPages.map((l) => <Row key={l.id} label={l.title} note={l.note} amount={l.amount} />)}
                        </Group>
                      )}
                      {b.content.length > 0 && (
                        <Group title="Content" total={view.price.content}>
                          {b.content.map((l) => <Row key={l.id} label={l.title} note={l.note} amount={l.amount} />)}
                        </Group>
                      )}
                      {b.addons.length > 0 && (
                        <Group title={`Add-ons (${b.addons.length})`} sub="Setup cost, with any monthly fee" total={view.price.addonSetup}>
                          {b.addons.map((l) => <Row key={l.id} label={l.title} note={l.note} amount={l.amount} monthly={l.monthly} />)}
                        </Group>
                      )}
                      <div className="rounded-2xl bg-accent/10 border border-accent/30 p-4 flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase font-bold tracking-wider text-zinc-300">{state.demo ? 'Example total' : 'Total upfront'}</div>
                          {view.price.monthly > 0 && <div className="text-xs text-zinc-300 mt-0.5">plus {money(view.price.monthly)} a month</div>}
                        </div>
                        <div className="text-2xl font-black text-white">{money(view.price.total)}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void downloadPdf()}
                          disabled={pdfState === 'working'}
                          className="px-4 py-3 min-h-[44px] lg:min-h-0 lg:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-60 border border-white/15 text-white text-xs font-semibold flex items-center gap-2"
                        >
                          {pdfState === 'working' ? <LuLoader className="w-3.5 h-3.5 animate-spin" /> : <LuDownload className="w-3.5 h-3.5" />}
                          <span>{pdfState === 'working' ? 'Preparing your PDF…' : 'Download PDF'}</span>
                        </button>
                        <span className="text-[11px] text-zinc-400">Plan, planned content and cost in one file.</span>
                      </div>
                      {pdfState === 'failed' && (
                        <p role="alert" className="text-[11px] text-red-300">We couldn't make the PDF in this browser. Please try again, or use your browser's Print and choose Save as PDF.</p>
                      )}
                      {b.cheaper && b.cheaper.saves > 0 && (
                        <p className="text-[11px] text-amber-300/90 leading-relaxed">
                          Tip: the {b.cheaper.name} package would cover your plan for {money(b.cheaper.initialInvestment)}, saving {money(b.cheaper.saves)}.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* INVESTMENT FOOTER (every number is the server's) */}
            <div className="sticky bottom-[5.25rem] lg:static z-20 p-3 sm:p-5 bg-[#0e0e13]/95 backdrop-blur border-t border-white/10 flex items-center justify-between gap-3 sm:gap-4">
              <div aria-live="polite" className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-full sm:w-auto text-[11px] uppercase font-bold text-zinc-400 tracking-wider">{state.demo ? 'Example Total:' : 'Total Estimated Build:'}</span>
                  <span className="text-xl sm:text-2xl font-black text-white">{money(view.price.total)}</span>
                  {view.price.monthly > 0 && <span className="text-xs text-zinc-400">(+{money(view.price.monthly)}/mo)</span>}
                  {state.busy === 'edit' && <LuLoader className="w-3.5 h-3.5 animate-spin text-[var(--tool-accent-text)] self-center" aria-label="Updating" />}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  {view.price.websiteName} ({money(view.price.base)})
                  {view.price.extraPages > 0 && ` + ${view.price.extraPagesCount} extra page${view.price.extraPagesCount === 1 ? '' : 's'} (+${money(view.price.extraPages)})`}
                  {view.price.content > 0 && ` + content (+${money(view.price.content)})`}
                  {view.price.addonSetup > 0 && ` + Add-ons (+${money(view.price.addonSetup)})`}
                </p>
                {activeTab !== 'cost' && (
                  <button type="button" onClick={() => setActiveTab('cost')} className="text-[11px] text-[var(--tool-accent-text)] hover:underline mt-0.5">
                    See full cost breakdown
                  </button>
                )}
              </div>

              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 sm:px-5 py-3 lg:py-2.5 min-h-[44px] lg:min-h-0 rounded-xl bg-[var(--tool-accent)] hover:brightness-110 text-white text-sm font-semibold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <LuCalendar className="w-4 h-4" />
                <span className="sm:hidden">Book a call</span>
                <span className="hidden sm:inline">{ctaData.text}</span>
                <LuArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlueprintAgent() {
  return (
    <AgentErrorBoundary>
      <BlueprintAgentInner />
    </AgentErrorBoundary>
  );
}
