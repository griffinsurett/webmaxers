// src/integrations/chatbot/ChatBot.tsx
import {
  useState, useRef, useEffect, useCallback, memo,
} from "react";
import { createPortal } from "react-dom";
import ChatInputBar from "@/components/Form/ChatInputBar";
import { MarkdownText } from "@/components/MarkdownText";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  reaction?: "up" | "down" | null;
}

async function callChatAPI(
  messages: { role: "user" | "assistant"; content: string }[],
  sessionId: string
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { reply: string };
  return data.reply;
}

function getTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 h-4" role="img" aria-label="Typing">
      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-chatbot-dot [animation-delay:0s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-chatbot-dot [animation-delay:.18s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-chatbot-dot [animation-delay:.36s]" />
    </span>
  );
}

function BotAvatar({ lg }: { lg?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`shrink-0 rounded-full card-icon-color text-bg flex items-center justify-center
        ${lg ? "w-10 h-10" : "w-7 h-7"}`}
    >
      <ChatIcon size={lg ? 20 : 14} />
    </div>
  );
}

const OWN_DOMAIN = "webmaxxers.com";

const PAGE_LABELS: Record<string, string> = {
  "/projects":   "View Portfolio",
  "/blog":       "Read Our Blog",
  "/faq":        "View FAQs",
  "/contact-us": "Contact Us",
  "/services":   "Our Services",
  "/links":      "Link Page",
};

function MessageText({ text }: { text: string }) {
  return (
    <MarkdownText
      text={text}
      className="text-[.845rem] leading-[1.55]"
      linkRenderer={(href, key) => {
        try {
          const parsed = new URL(href);
          const isInternal = parsed.hostname === OWN_DOMAIN;
          const path = parsed.pathname.replace(/\/$/, "") || "/";
          const label = PAGE_LABELS[path] ?? parsed.hostname + path;
          if (isInternal) {
            return (
              <a key={key} href={path}
                className="inline-flex items-center gap-1 text-accent bg-accent/10 border border-accent/25 px-2.5 py-0.5 rounded-full text-xs font-medium mx-0.5 hover:bg-accent/20 hover:-translate-y-px transition-all duration-200">
                {label} →
              </a>
            );
          }
        } catch {}
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:opacity-75 transition-opacity">
            {href}
          </a>
        );
      }}
    />
  );
}

const BotMessage = memo(({ msg, onReact }: {
  msg: Message;
  onReact: (id: string, r: "up" | "down") => void;
}) => (
  <div className="flex flex-col items-start mb-2 animate-chatbot-in">
    <div className="relative max-w-[83%] group">
      <div className="bg-bg3 border border-border text-text px-3.5 py-2.5 rounded-[.25rem_1rem_1rem_1rem]">
        <MessageText text={msg.text} />
      </div>
      <div
        role="group" aria-label="Rate this response"
        className="flex gap-1 mt-1.5 opacity-0 pointer-events-none translate-y-0.5 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 has-[.chatbot-react-on]:opacity-100 has-[.chatbot-react-on]:pointer-events-auto has-[.chatbot-react-on]:translate-y-0 transition-all duration-200"
      >
        <button type="button" onClick={() => onReact(msg.id, "up")} aria-label="Helpful" aria-pressed={msg.reaction === "up"}
          className={`border-0 bg-transparent p-0 cursor-pointer text-[.85rem] leading-none w-[1.55rem] h-[1.55rem] rounded-[.45rem] flex items-center justify-center transition-[transform,filter,background] duration-200 [filter:grayscale(50%)_opacity(.55)] hover:scale-125 hover:[filter:grayscale(0%)_opacity(1)] hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] active:scale-105 ${msg.reaction === "up" ? "[filter:grayscale(0%)_opacity(1)] scale-110 bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]" : ""}`}>👍</button>
        <button type="button" onClick={() => onReact(msg.id, "down")} aria-label="Not helpful" aria-pressed={msg.reaction === "down"}
          className={`border-0 bg-transparent p-0 cursor-pointer text-[.85rem] leading-none w-[1.55rem] h-[1.55rem] rounded-[.45rem] flex items-center justify-center transition-[transform,filter,background] duration-200 [filter:grayscale(50%)_opacity(.55)] hover:scale-125 hover:[filter:grayscale(0%)_opacity(1)] hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] active:scale-105 ${msg.reaction === "down" ? "[filter:grayscale(0%)_opacity(1)] scale-110 bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]" : ""}`}>👎</button>
      </div>
    </div>
    <div className="flex items-center gap-1.5 mt-1">
      <BotAvatar />
      <time className="text-[.63rem] text-muted whitespace-nowrap">{msg.time}</time>
    </div>
  </div>
));

const UserMessage = memo(({ msg }: { msg: Message }) => (
  <div className="flex flex-col items-end mb-2.5 animate-chatbot-in">
    <div className="max-w-[83%] accent-primary-gradient text-white px-3.5 py-2.5 rounded-[1rem_1rem_.25rem_1rem] text-[.845rem] leading-[1.55] wrap-break-word">
      {msg.text}
    </div>
    <time className="text-[.63rem] text-muted mt-1 pr-0.5 whitespace-nowrap">{msg.time} · Seen</time>
  </div>
));

function Fab({ open, unread, onClick }: { open: boolean; unread: number; onClick: () => void }) {
  return (
    <button
      id="chatbot-trigger"
      onClick={onClick}
      type="button"
      aria-label={open ? "Close chat" : "Chat with the Webmaxxers Assistant"}
      aria-expanded={open}
      className={`fixed bottom-[clamp(1.25rem,4vw,1.75rem)] right-[clamp(1.25rem,4vw,1.75rem)] z-[100003]
        w-14 h-14 rounded-full cursor-pointer
        card-icon-color text-bg
        shadow-[0_4px_20px_color-mix(in_srgb,var(--color-accent)_50%,transparent),0_2px_8px_rgba(0,0,0,.35)]
        flex items-center justify-center transition-transform duration-700 ease-out
        hover:scale-110 active:scale-95 ${open ? "scale-105" : ""}`}
    >
      <span className={`flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${open ? "rotate-90" : ""}`}>
        {open ? <CloseIcon size={18} /> : <ChatIcon size={24} />}
      </span>
      {!open && unread > 0 && (
        <span role="img" aria-label={`${unread} new`}
          className="absolute -top-1 -right-1 bg-red-500 text-white text-[.6rem] font-bold min-w-[1.15rem] h-[1.15rem] rounded-full flex items-center justify-center border-2 border-bg animate-chatbot-badge">
          {unread}
        </span>
      )}
    </button>
  );
}

function ChatBot() {
  const [open, setOpen]   = useState(false);
  const [msgs, setMsgs]   = useState<Message[]>([{
    id: "w0", role: "assistant",
    text: "Hi! 👋 How can I help you today?",
    time: getTime(),
  }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let sid = sessionStorage.getItem("chatbot_session_id");
    if (!sid) {
      sid = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem("chatbot_session_id", sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  const react = useCallback((id: string, r: "up" | "down") => {
    setMsgs(prev => prev.map(m => m.id === id ? { ...m, reaction: m.reaction === r ? null : r } : m));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: "user", text, time: getTime() };
    setMsgs(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    const history = [...msgs, userMsg].map(m => ({
      role: m.role,
      content: m.text,
    }));

    try {
      const reply = await callChatAPI(history, sessionId);
      setMsgs(prev => [...prev, {
        id: `b${Date.now()}`,
        role: "assistant",
        text: reply,
        time: getTime(),
      }]);
    } catch (err) {
      console.error(err);
      setMsgs(prev => [...prev, {
        id: `b${Date.now()}`,
        role: "assistant",
        text: "Sorry, I'm having trouble connecting to live support. Please try again or reach out at /contact-us.",
        time: getTime(),
      }]);
    } finally {
      setTyping(false);
    }
  }, [input, open, msgs, sessionId]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Panel */}
      <div
        role="dialog" aria-modal="true" aria-label="Chat with Webmaxxers"
        className={`fixed z-[100002]
          bottom-[calc(clamp(1.25rem,4vw,1.75rem)+3.5rem+.875rem)]
          right-[clamp(1.25rem,4vw,1.75rem)]
          w-[min(24rem,calc(100vw-clamp(2.5rem,8vw,3.5rem)))]
          max-h-[calc(100dvh-5.5rem-1rem-clamp(1.25rem,4vw,1.75rem)-3.5rem-.875rem)]
          min-h-[min(22rem,calc(100dvh-14rem))]
          flex flex-col overflow-hidden
          bg-bg border border-border rounded-[1.25rem]
          shadow-[0_24px_64px_rgba(0,0,0,.6),0_8px_24px_rgba(0,0,0,.3),inset_0_1px_0_rgba(255,255,255,.06)]
          transition-[opacity,transform] duration-250 ease-[cubic-bezier(.34,1.56,.64,1)]
          max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:bottom-[calc(1.25rem+3.5rem+.75rem)] max-sm:w-auto max-sm:max-h-none max-sm:min-h-0 max-sm:rounded-none
          ${open
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-3 scale-[.97] pointer-events-none"
          }`}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3.5 shrink-0 card-bg">
          <BotAvatar lg />
          <div className="flex-1 min-w-0">
            <p className="text-[.9rem] font-bold text-heading m-0 leading-tight truncate">Webmaxxers Assistant</p>
            <p className="text-[.7rem] text-muted m-0 flex items-center gap-1.5 mt-0.5">
              <span className="w-[.42rem] h-[.42rem] rounded-full bg-green-400 shadow-[0_0_5px_#4ade80] animate-chatbot-pulse shrink-0" />
              24×7 Support
            </p>
          </div>
          <button onClick={() => setOpen(false)} type="button" aria-label="Close"
            className="shrink-0 w-[1.9rem] h-[1.9rem] rounded-full faded-bg border-0 text-heading flex items-center justify-center transition-colors">
            <CloseIcon />
          </button>
        </header>

        {/* Messages */}
        <div role="log" aria-live="polite"
          className="flex-1 overflow-y-auto px-3.5 pt-4 pb-2.5 flex flex-col scrollbar-hide overscroll-contain">
          {msgs.map(m => m.role === "user"
            ? <UserMessage key={m.id} msg={m} />
            : <BotMessage  key={m.id} msg={m} onReact={react} />
          )}
          {typing && (
            <div className="flex flex-col items-start mb-2 animate-chatbot-in">
              <div className="bg-bg3 border border-border px-3.5 py-2.5 rounded-[.25rem_1rem_1rem_1rem]">
                <TypingDots />
              </div>
              <div className="mt-1"><BotAvatar /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <ChatInputBar
          value={input}
          onChange={setInput}
          onSend={send}
          disabled={typing}
          inactive={!open}
          placeholder="Ask anything…"
        />
        <p className="text-[9px] text-muted/50 text-center px-3 pb-2 pt-1 leading-[1.4]">
          Powered by OpenAI (makers of ChatGPT). Messages are processed by OpenAI per our{" "}
          <a href="/legal/privacy-policy" className="underline hover:text-muted transition-colors">Privacy Policy</a>.
        </p>
      </div>

      <Fab open={open} unread={unread} onClick={() => setOpen(o => !o)} />
    </>,
    document.body
  );
}

export default memo(ChatBot);
