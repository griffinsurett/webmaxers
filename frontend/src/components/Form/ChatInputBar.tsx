// Shared chat input bar — used by the (now unmounted) ChatBot widget.
// Callers own their send logic and disabled state; this component handles
// the textarea, auto-grow, emoji picker, mic, and send button.
import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent, type FormEvent,
} from "react";
import EmojiPicker, { Theme, EmojiStyle } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";

// ── Icons ────────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3"
        fill={recording ? "currentColor" : "none"}
        stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChatInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** If true, textarea tabIndex is set to -1 (e.g. when panel is hidden) */
  inactive?: boolean;
  /** Extra className for the wrapping form element */
  className?: string;
  /** Max height of textarea in px before scrolling (default 96) */
  maxTextareaHeight?: number;
  /** Emoji picker placement direction: "up" (default) or "down" */
  emojiDirection?: "up" | "down";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatInputBar({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask anything…",
  inactive = false,
  className = "",
  maxTextareaHeight = 96,
  emojiDirection = "up",
}: ChatInputBarProps) {
  const [emoji, setEmoji] = useState(false);
  const [emojiClosing, setEmojiClosing] = useState(false);
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    const check = () => setDark(document.documentElement.getAttribute("data-theme") !== "light");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setSpeechSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    return () => obs.disconnect();
  }, []);

  const closeEmoji = useCallback(() => {
    setEmojiClosing(true);
    setTimeout(() => { setEmoji(false); setEmojiClosing(false); }, 200);
  }, []);

  useEffect(() => {
    if (!emoji) return;
    const h = (e: MouseEvent) => {
      if (
        emojiRef.current && !emojiRef.current.contains(e.target as Node) &&
        emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)
      ) closeEmoji();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [emoji, closeEmoji]);

  const onEmoji = useCallback((data: EmojiClickData) => {
    onChange(value + data.emoji);
    closeEmoji();
    inputRef.current?.focus();
  }, [value, onChange, closeEmoji]);

  const toggleRecording = useCallback(() => {
    if (recording) { recognitionRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) onChange(value ? value + " " + t : t);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recording, value, onChange]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const canSend = !disabled && !!value.trim();

  if (!mounted) {
    // SSR placeholder — same height as the real bar
    return (
      <div className={`flex items-end gap-1.5 px-3.5 py-2.5 border-t border-border bg-bg shrink-0 ${className}`}>
        <div className="flex-1 min-h-[2.4rem] rounded-full border border-border bg-bg3/40" />
      </div>
    );
  }

  return (
    <>
      {/* Emoji picker — rendered above or below the bar */}
      {(emoji || emojiClosing) && emojiDirection === "up" && (
        <div ref={emojiRef}
          className={`shrink-0 overflow-hidden origin-bottom-left ${emojiClosing ? "animate-chatbot-emoji-close" : "animate-chatbot-emoji-open"}`}>
          <EmojiPicker
            onEmojiClick={onEmoji}
            theme={dark ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            width="100%" height={300}
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Search…"
            lazyLoadEmojis
          />
        </div>
      )}

      <form
        className={`flex items-end gap-1.5 px-3.5 py-2.5 border-t border-border bg-bg shrink-0 ${className}`}
        onSubmit={(e: FormEvent) => { e.preventDefault(); onSend(); }}
      >
        <div className="relative flex items-end flex-1">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, maxTextareaHeight) + "px";
            }}
            onKeyDown={onKey}
            placeholder={placeholder}
            rows={1}
            tabIndex={inactive ? -1 : 0}
            disabled={disabled}
            aria-label="Message"
            className={`w-full resize-none form-field text-[.845rem] font-[inherit] leading-normal overflow-y-auto scrollbar-hide block disabled:opacity-50 ${speechSupported ? "sm:pr-8" : ""}`}
            style={{ maxHeight: maxTextareaHeight + "px", minHeight: "2.4rem" }}
          />
          {speechSupported && (
            <button
              type="button"
              aria-label={recording ? "Stop recording" : "Speak your message"}
              onClick={toggleRecording}
              className={`hidden sm:flex absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-0 bg-transparent cursor-pointer items-center justify-center transition-[color] duration-200
                ${recording ? "text-red-500 animate-chatbot-pulse" : "text-muted hover:text-accent"}`}
            >
              <MicIcon recording={recording} />
            </button>
          )}
        </div>

        <button
          ref={emojiBtnRef}
          type="button"
          aria-label="Emoji"
          onClick={() => emoji ? closeEmoji() : setEmoji(true)}
          className={`hidden sm:flex w-9 h-9 rounded-full border-0 bg-transparent cursor-pointer items-center justify-center shrink-0 transition-[color,background] duration-200
            ${emoji ? "text-accent bg-accent/10" : "text-muted hover:text-accent hover:bg-accent/10"}`}
        >
          <SmileIcon />
        </button>

        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="w-9 h-9 rounded-full border-0 cursor-pointer shrink-0 flex items-center justify-center card-icon-color text-bg transition-[transform,opacity] duration-200 hover:enabled:scale-110 active:enabled:scale-[.92] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </form>

      {/* Emoji picker — below variant */}
      {(emoji || emojiClosing) && emojiDirection === "down" && (
        <div ref={emojiRef}
          className={`shrink-0 overflow-hidden origin-top-left ${emojiClosing ? "animate-chatbot-emoji-close" : "animate-chatbot-emoji-open"}`}>
          <EmojiPicker
            onEmojiClick={onEmoji}
            theme={dark ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            width="100%" height={300}
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Search…"
            lazyLoadEmojis
          />
        </div>
      )}
    </>
  );
}
