// src/components/BlueprintAgent/ErrorBoundary.tsx
// Last line of defence: if rendering ever throws, show a calm message with a way out instead of
// blanking the page. "Start over" forgets the stored conversation, so a conversation whose data
// somehow cannot be drawn can never trap the visitor in a crash loop on reload.
import React from 'react';
import { clearSessionId } from './session';

interface State { failed: boolean }

export class AgentErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[BlueprintAgent] render failed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ '--tool-accent': 'oklch(from var(--color-accent, #5e76f6) 0.52 c h)' } as React.CSSProperties} className="w-full max-w-3xl mx-auto my-6 rounded-3xl bg-[#09090b] border border-white/10 p-8 text-center space-y-4" role="alert">
        <p className="text-sm text-zinc-200">Something went wrong showing your blueprint. Your progress is saved on our side.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-[var(--tool-accent)] text-white text-xs font-semibold">
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              clearSessionId();
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-200 text-xs font-semibold"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }
}
