// src/components/AnimatedExamples/EngagementDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface EngagementDemoProps {
  className?: string;
}

export default function EngagementDemo({ className = "" }: EngagementDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - cursor hidden
  // 1: Cursor appears, moves toward back button
  // 2: Cursor hesitates near back button
  // 3: Value message appears, cursor redirects toward CTA
  // 4: Cursor hovers over CTA (button highlights)
  // 5: Click effect on CTA
  // 6: Success state

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(6);
      return;
    }

    setStep(0);

    const timings = [
      400,   // Step 1: Cursor appears, moves toward back
      1200,  // Step 2: Cursor hesitates
      1800,  // Step 3: Value message appears
      2600,  // Step 4: Cursor moves to CTA
      3400,  // Step 5: Click
      3800,  // Step 6: Success
    ];

    const timers: NodeJS.Timeout[] = [];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    // Reset and loop
    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 5500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  // Cursor positions based on step
  const getCursorPosition = () => {
    if (step === 0) return { left: "70%", top: "70%" };
    if (step === 1) return { left: "12%", top: "18%" }; // Near back button
    if (step === 2) return { left: "10%", top: "16%" }; // Hesitating
    if (step === 3) return { left: "25%", top: "45%" }; // Starting to redirect
    if (step >= 4) return { left: "50%", top: "78%" }; // On CTA button
    return { left: "70%", top: "70%" };
  };

  const cursorPos = getCursorPosition();
  const isHoveringCTA = step >= 4 && step < 6;
  const isClicking = step === 5;
  const showSuccess = step === 6;
  const showValueMessage = step >= 3;

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg p-4 overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Browser window */}
      <div className="relative">
        {/* Browser chrome with back button */}
        <div className="bg-bg2 rounded-t-lg px-2 py-1.5 flex items-center gap-2 border-b border-text/10">
          {/* Navigation buttons */}
          <div className="flex gap-1">
            {/* Back button - highlighted when cursor near */}
            <div
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors duration-200 ${
                step === 1 || step === 2 ? "bg-text/20" : "bg-text/10"
              }`}
            >
              <svg className="w-3 h-3 text-text/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {/* Forward button */}
            <div className="w-5 h-5 rounded bg-text/10 flex items-center justify-center opacity-40">
              <svg className="w-3 h-3 text-text/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* URL bar */}
          <div className="flex-1 bg-bg3 rounded px-2 py-0.5 overflow-hidden">
            <span className="text-[10px] text-text/70 whitespace-nowrap">yoursite.com/offer</span>
          </div>

          {/* Window controls */}
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/60" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
            <div className="w-2 h-2 rounded-full bg-green-500/60" />
          </div>
        </div>

        {/* Page content */}
        <div className="bg-bg2 rounded-b-lg p-3 h-[140px] overflow-hidden relative">
          {/* Headline */}
          <div className="space-y-1 mb-3">
            <div className="h-3 bg-text/25 rounded w-3/4" />
            <div className="h-2 bg-text/15 rounded w-1/2" />
          </div>

          {/* Value message - appears mid-scroll */}
          <div
            className={`bg-primary/15 border border-soft-strong rounded-lg p-2 mb-3 transition-all duration-300 ${
              showValueMessage
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary/40 flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[10px] text-text font-medium">Free consultation included</span>
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center">
            <div
              className={`px-4 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                showSuccess
                  ? "bg-green-500/80 text-white scale-105"
                  : isHoveringCTA
                    ? "bg-primary text-white scale-105 shadow-lg shadow-primary/30"
                    : "bg-primary/80 text-white"
              } ${isClicking ? "scale-95" : ""}`}
            >
              {showSuccess ? "Thanks!" : "Get Started"}
            </div>
          </div>

          {/* Animated cursor */}
          {step > 0 && !prefersReducedMotion && (
            <div
              className="absolute pointer-events-none transition-all duration-500 ease-out z-10"
              style={{
                left: cursorPos.left,
                top: cursorPos.top,
                transform: `translate(-50%, -50%) ${isClicking ? "scale(0.8)" : "scale(1)"}`,
              }}
            >
              {/* Cursor icon */}
              <svg
                className={`w-5 h-5 drop-shadow-md transition-transform duration-100 ${isClicking ? "rotate-12" : ""}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M4 4l16 8-7 2-2 7-7-17z"
                  className={step >= 4 ? "text-primary" : "text-text/80"}
                />
              </svg>

              {/* Click ripple effect */}
              {isClicking && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 rounded-full bg-primary/40 animate-ping" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
          showSuccess ? "bg-green-500" : step >= 4 ? "bg-primary" : "bg-text/30"
        }`} />
        <span className="text-[10px] text-text/60">
          {showSuccess
            ? "Engaged!"
            : step >= 4
              ? "Taking action..."
              : step >= 3
                ? "Value captured attention"
                : "Browsing..."}
        </span>
      </div>
    </DecorativeWrapper>
  );
}
