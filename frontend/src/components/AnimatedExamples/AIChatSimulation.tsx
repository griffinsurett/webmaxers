// src/components/AIChatSimulation.tsx
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface AIChatSimulationProps {
  /** Additional className */
  className?: string;
}

const fullMessage = "Hello there! I'm here to answer customer questions 24/7 — when you're sleeping, not paying attention, or just taking a well-deserved break. Your visitors get instant answers, and you never miss an opportunity.";

export default function AIChatSimulation({
  className = "",
}: AIChatSimulationProps) {
  const prefersReducedMotion = useMotionPreference();
  // Final state: full message displayed, not typing
  const [displayedText, setDisplayedText] = useState(prefersReducedMotion ? fullMessage : "");
  const [isTyping, setIsTyping] = useState(prefersReducedMotion ? false : true);
  const [showCursor, setShowCursor] = useState(true);

  // Typing effect
  useEffect(() => {
    // If user prefers reduced motion, show final state immediately
    if (prefersReducedMotion) {
      setDisplayedText(fullMessage);
      setIsTyping(false);
      return;
    }

    if (displayedText.length < fullMessage.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(fullMessage.slice(0, displayedText.length + 1));
      }, 30); // Typing speed
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
      // Reset after a pause
      const resetTimeout = setTimeout(() => {
        setDisplayedText("");
        setIsTyping(true);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [displayedText, prefersReducedMotion]);

  // Blinking cursor - skip for reduced motion
  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Chat header */}
      <div className="bg-bg2 px-4 py-2 flex items-center gap-3 border-b border-text/10">
        <div className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center">
          <Icon icon="lu:bot" size="sm" className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-text">AI Assistant</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full bg-green-500 ${prefersReducedMotion ? "" : "animate-pulse"}`} />
            <span className="text-xs text-text/70">Always online</span>
          </div>
        </div>
      </div>

      {/* Chat area - fixed height to prevent layout shift */}
      <div className="p-4 h-[140px] bg-bg2/50 overflow-hidden">
        {/* AI message bubble */}
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full primary-gradient flex items-center justify-center shrink-0 mt-1">
            <Icon icon="lu:sparkles" size="sm" className="text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-bg2 rounded-2xl rounded-tl-sm px-4 py-3 inline-block max-w-full">
              <p className="text-sm text-text leading-relaxed h-[72px] overflow-hidden">
                {displayedText}
                {isTyping && (
                  <span
                    className={`inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle ${
                      showCursor ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-text/40 h-4">
              {!isTyping && (
                <>
                  <Icon icon="lu:clock" size="sm" />
                  <span>Just now</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 py-3 bg-bg2 border-t border-text/10">
        <div className="flex items-center gap-2 bg-bg3 rounded-full px-4 py-2">
          <input
            type="text"
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text/40 outline-none"
            aria-label="AI assistant prompt input (demo only)"
            disabled
            tabIndex={-1}
          />
          <div
            className="w-8 h-8 rounded-full primary-gradient flex items-center justify-center shrink-0"
          >
            <Icon icon="lu:send" size="sm" className="text-white" />
          </div>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
