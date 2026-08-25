// src/components/AnimatedExamples/SupportChat.tsx
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

// Inline favicon as data URI to prevent duplicate preload hints
const FAVICON_DATA_URI = "data:image/png;base64,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";

export interface SupportChatProps {
  className?: string;
}

export default function SupportChat({ className = "" }: SupportChatProps) {
  const prefersReducedMotion = useMotionPreference();
  // Start at 0, effect will set to final state if reduced motion
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    // If user prefers reduced motion, show final state immediately
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    // Reset step for animation
    setStep(0);

    const timings = [
      500,   // Step 1: User message appears
      1500,  // Step 2: GWS typing indicator
      2500,  // Step 3: GWS response
      3500,  // Step 4: Website frame appears
      4200,  // Step 5: Image appears on website
    ];

    const timers: NodeJS.Timeout[] = [];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 7000);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  return (
    <DecorativeWrapper className={`flex gap-4 select-none pointer-events-none ${className}`}>
      {/* Chat section */}
      <div className="flex-1 bg-text/10 rounded-lg overflow-hidden">
        {/* Chat header */}
        <div className="bg-bg2 px-3 py-2 flex items-center gap-2 border-b border-text/10">
          <div className="w-5 h-5 rounded-full overflow-hidden">
            <img src={FAVICON_DATA_URI} alt="Webmaxxers" className="w-full h-full object-cover" />
          </div>
          <span className="text-xs font-medium text-text">Webmaxxers</span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-text/70">Online</span>
          </div>
        </div>

        {/* Chat messages */}
        <div className="p-3 space-y-2 h-[120px] bg-bg2/50">
          {/* User message */}
          <div
            className={`flex justify-end ${
              prefersReducedMotion ? "" : "transition-all duration-300"
            } ${
              step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="bg-primary/20 rounded-xl rounded-br-sm px-3 py-1.5 max-w-[85%]">
              <p className="text-xs text-text">Can you add an image to the top of my site?</p>
            </div>
          </div>

          {/* Typing indicator */}
          {step === 2 && (
            <div className="flex gap-1 px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-text/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}

          {/* GWS response */}
          <div
            className={`flex justify-start ${
              prefersReducedMotion ? "" : "transition-all duration-300"
            } ${
              step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="bg-bg2 rounded-xl rounded-bl-sm px-3 py-1.5 max-w-[85%] border border-text/10">
              <p className="text-xs text-text">Sure! I'll have that done for you shortly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Website frame */}
      <div
        className={`w-[100px] ${
          prefersReducedMotion ? "" : "transition-all duration-500 ease-out"
        } ${
          step >= 4 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
        }`}
      >
        <div className="bg-bg2 rounded-lg overflow-hidden border border-text/10">
          {/* Browser chrome */}
          <div className="px-2 py-1 flex items-center gap-1 border-b border-text/10">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
          </div>

          {/* Website content */}
          <div className="p-2 space-y-1.5">
            {/* Image placeholder - animates in */}
            <div
              className={`h-10 rounded bg-primary/30 flex items-center justify-center ${
                prefersReducedMotion ? "" : "transition-all duration-500"
              } ${
                step >= 5 ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            >
              <Icon icon="lu:image" size="sm" className="text-primary/60" />
            </div>

            {/* Content lines */}
            <div className="h-1.5 bg-text/20 rounded w-full" />
            <div className="h-1.5 bg-text/15 rounded w-3/4" />
            <div className="h-1.5 bg-text/10 rounded w-1/2" />
          </div>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
