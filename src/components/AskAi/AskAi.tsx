// src/components/AskAi/AskAi.tsx
// "Ask AI" UI — modeled on Adobe Firefly's "Ask a question" pattern: a compact
// centered trigger bar that opens a centered modal with a title, suggestion
// chips, and the same input bar. UI ONLY — no backend / chat functionality yet
// (submitting/clicking a chip just opens the modal and fills the field).
//
// Visual styling adapted from griffinswebservices' ChatInputBar.
import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";

/** Window event that opens the Ask-AI modal. Dispatch it from anywhere
 *  (any island or inline script) to open the same modal — see openAskAi(). */
export const ASK_AI_OPEN_EVENT = "ask-ai:open";

/** Open the Ask-AI modal from anywhere on the page. */
export function openAskAi() {
  window.dispatchEvent(new Event(ASK_AI_OPEN_EVENT));
}

interface Props {
  /** Heading shown inside the modal. */
  title?: string;
  /** Placeholder for the question input. */
  placeholder?: string;
  /** Suggestion chips shown in the modal. */
  suggestions?: string[];
  className?: string;
}

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4 10.2 11.5 5.3 9.7l4.9-1.8L12 3z"
        fill="currentColor"
      />
      <path d="M19 14l.7 1.9 1.9.7-1.9.7L19 19.2 18.3 17.3 16.4 16.6l1.9-.7L19 14z" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DEFAULT_SUGGESTIONS = [
  "What can you build for my business?",
  "How do you approach a website project?",
  "Can you create custom AI agents?",
  "What does branding work include?",
];

/** The pill-shaped "Ask a question" input bar (shared by the trigger + modal).
 *
 * Two modes:
 *  - `asButton`: the TRIGGER. The bar acts as a button — clicking anywhere on it
 *    (including the read-only "input") opens the modal via `onActivate`. The
 *    input is read-only and not focusable, so the modal's focus-restore on close
 *    can't land here and re-open it (that was the Escape→reopen loop).
 *  - default: the real input INSIDE the modal. Editable, optionally autofocused.
 */
function AskBar({
  value,
  onChange,
  onSubmit,
  onActivate,
  placeholder,
  autoFocus = false,
  big = false,
  asButton = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onActivate?: () => void;
  placeholder: string;
  autoFocus?: boolean;
  big?: boolean;
  asButton?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onClick={asButton ? onActivate : undefined}
      className={[
        "flex items-center gap-2 rounded-full border border-heading/15 bg-bg2",
        "shadow-sm transition-colors focus-within:border-primary/50",
        asButton ? "cursor-pointer" : "",
        big ? "px-5 py-3.5" : "px-4 py-2.5",
      ].join(" ")}
    >
      <span className="shrink-0 text-primary">
        <SparkleIcon />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // Trigger mode: read-only + not focusable, so it behaves as part of the
        // button and never grabs focus (which would re-open the modal on close).
        readOnly={asButton}
        tabIndex={asButton ? -1 : undefined}
        className={[
          "min-w-0 flex-1 bg-transparent text-text placeholder:text-text/45 focus:outline-none",
          asButton ? "cursor-pointer" : "",
          big ? "text-base" : "text-sm",
        ].join(" ")}
      />
      <button
        type="submit"
        aria-label="Send"
        tabIndex={asButton ? -1 : undefined}
        className="shrink-0 rounded-full p-1.5 text-text/55 transition-colors hover:bg-heading/8 hover:text-heading"
      >
        <SendIcon />
      </button>
    </form>
  );
}

export default function AskAi({
  title = "Find the right solution to bring your idea to life.",
  placeholder = "Ask a question",
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  // The bar is `position: fixed`, so it floats relative to the VIEWPORT no
  // matter where it lives in the DOM — placement alone can't keep it off the
  // hero/footer. We drive visibility off the hero + footer directly: shown only
  // while NEITHER is on screen (the band between them). The hero (#hero) may not
  // exist on every page; the footer always does.
  const [visible, setVisible] = useState(false);

  const openModal = () => setOpen(true);

  // Open from anywhere on the page (e.g. the header "Let's Talk" button) by
  // dispatching a `window` custom event — decouples the trigger from this island
  // so any element can open the same modal: window.dispatchEvent(new Event("ask-ai:open"))
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ASK_AI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASK_AI_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const hero = document.getElementById("hero");
    // The page may contain more than one <footer> (e.g. a mid-page testimonial
    // footer); the real site footer is role="contentinfo" / the last one. Target
    // that so the bar hides at the actual page bottom, not a mid-page footer.
    const footers = document.querySelectorAll("footer");
    const footer =
      document.querySelector('footer[role="contentinfo"]') ??
      footers[footers.length - 1] ??
      null;

    // No hero on this page → start hidden only behind the footer; with a hero,
    // assume it's in view at the top.
    let heroVisible = !!hero;
    let footerVisible = false;
    const update = () => setVisible(!heroVisible && !footerVisible);

    const heroObs = hero
      ? new IntersectionObserver(
          ([e]) => { heroVisible = e.isIntersecting; update(); },
          // Hero counts as "in view" only while its bottom is still near the top
          // of the screen — so the bar appears once you've scrolled past it.
          { rootMargin: "0px 0px -85% 0px" },
        )
      : null;
    const footerObs = footer
      ? new IntersectionObserver(
          ([e]) => { footerVisible = e.isIntersecting; update(); },
        )
      : null;

    hero && heroObs?.observe(hero);
    footer && footerObs?.observe(footer);
    update();

    return () => {
      heroObs?.disconnect();
      footerObs?.disconnect();
    };
  }, []);

  return (
    <>
      {/* Fixed, bottom-centre sticky trigger bar — appears below the hero and
          hides once the footer enters view. */}
      <div
        className={[
          "fixed bottom-6 left-1/2 z-[90] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 transition-all duration-300",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
          className,
        ].join(" ")}
      >
        <AskBar
          asButton
          value={value}
          onChange={setValue}
          onSubmit={openModal}
          onActivate={openModal}
          placeholder={placeholder}
        />
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        position="center"
        animation="slide-up"
        ariaLabel="Ask AI"
        className={[
          // Mobile / small screens: full-bleed sheet — full width + height, no
          // rounding, scrollable if the content overflows.
          "h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-6",
          // sm+ : back to the centered, rounded card.
          "sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(48rem,calc(100vw-2rem))] sm:rounded-3xl sm:p-10",
          "bg-bg2 shadow-2xl",
        ].join(" ")}
        overlayClass="bg-primary-dark/60"
        closeButton
      >
        <div className="flex min-h-full flex-col items-center justify-center gap-8 sm:min-h-0">
          <div className="flex items-center gap-2 self-start text-sm font-semibold text-heading">
            <span className="text-primary"><SparkleIcon /></span>
            <span>Ask</span>
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
              Beta
            </span>
          </div>

          <h2 className="max-w-md text-center text-2xl font-medium leading-tight tracking-tight text-heading sm:text-3xl">
            {title}
          </h2>

          {/* Suggestion chips */}
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(s)}
                className="flex flex-col gap-3 rounded-xl border border-heading/12 bg-bg p-4 text-left text-sm text-text/80 transition-colors hover:border-primary/40 hover:text-heading"
              >
                <span className="text-primary"><SparkleIcon /></span>
                <span>{s}</span>
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="w-full">
            <AskBar
              value={value}
              onChange={setValue}
              onSubmit={() => { /* UI only — no send yet */ }}
              placeholder={placeholder}
              autoFocus
              big
            />
          </div>

          <p className="max-w-2xl text-center text-xs leading-relaxed text-text/45">
            This AI assistant is for guidance only. Responses may be inaccurate;
            don't share sensitive information.
          </p>
        </div>
      </Modal>
    </>
  );
}
