// src/components/AnimatedExamples/MobileOrderDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface MobileOrderDemoProps {
  className?: string;
}

export default function MobileOrderDemo({ className = "" }: MobileOrderDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - site loads
  // 1: Cursor appears
  // 2: Cursor moves to Order Here button
  // 3: Hover on button
  // 4: Click button
  // 5: Order confirmation/success

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 300));
    timers.push(setTimeout(() => setStep(2), 900));
    timers.push(setTimeout(() => setStep(3), 1500));
    timers.push(setTimeout(() => setStep(4), 2000));
    timers.push(setTimeout(() => setStep(5), 2400));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 4500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const showCursor = step >= 1 && step < 5 && !prefersReducedMotion;
  const isHovering = step === 3;
  const isClicking = step === 4;
  const showSuccess = step >= 5;

  const getCursorPosition = () => {
    if (step <= 1) return { left: "80%", top: "30%" };
    if (step >= 2) return { left: "50%", top: "72%" }; // On Order Here button
    return { left: "80%", top: "30%" };
  };

  const cursorPos = getCursorPosition();

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Phone frame */}
      <div className="bg-bg2 rounded-xl overflow-hidden border border-text/10 max-w-[200px] mx-auto">
        {/* Phone notch/status bar */}
        <div className="bg-bg3 px-3 py-1 flex items-center justify-between">
          <span className="text-[8px] text-text/50">9:41</span>
          <div className="w-12 h-1.5 bg-text/20 rounded-full" />
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 border border-text/30 rounded-sm">
              <div className="w-2 h-1 bg-text/30 ml-auto mt-0.5 mr-0.5 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Restaurant site content */}
        <div className="p-3 relative min-h-[180px]">
          {/* Logo/header */}
          <div className="text-center mb-3">
            <div className="w-10 h-10 mx-auto mb-1 rounded-full bg-orange-500/20 flex items-center justify-center">
              <span className="text-lg">🌮</span>
            </div>
            <h2 className="text-sm text-text">Taco Fiesta</h2>
            <p className="text-[9px] text-text/50">Open Now · Closes 10 PM</p>
          </div>

          {/* Quick info */}
          <div className="flex justify-center gap-3 mb-3">
            <div className="text-center">
              <div className="text-[10px] font-semibold text-text">4.8 ★</div>
              <div className="text-[8px] text-text/50">324 reviews</div>
            </div>
            <div className="w-px bg-text/10" />
            <div className="text-center">
              <div className="text-[10px] font-semibold text-text">15-25 min</div>
              <div className="text-[8px] text-text/50">delivery</div>
            </div>
          </div>

          {/* Order Here button */}
          <button
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
              showSuccess
                ? "bg-green-500 text-white"
                : isHovering
                  ? "bg-orange-600 text-white scale-105"
                  : isClicking
                    ? "bg-orange-700 text-white scale-95"
                    : "bg-orange-500 text-white"
            }`}
          >
            {showSuccess ? "✓ Order Started!" : "Order Here"}
          </button>

          {/* Secondary actions */}
          <div className="flex gap-2 mt-2">
            <button className="flex-1 py-1.5 rounded bg-bg3 text-[9px] text-text/70 font-medium">
              View Menu
            </button>
            <button className="flex-1 py-1.5 rounded bg-bg3 text-[9px] text-text/70 font-medium">
              Call
            </button>
          </div>

          {/* Animated cursor */}
          {showCursor && (
            <div
              className="absolute pointer-events-none transition-all duration-400 ease-out z-10"
              style={{
                left: cursorPos.left,
                top: cursorPos.top,
                transform: `translate(-50%, -50%) ${isClicking ? "scale(0.8)" : "scale(1)"}`,
              }}
            >
              <svg
                className={`w-5 h-5 drop-shadow-md transition-transform duration-100 ${isClicking ? "rotate-12" : ""}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M4 4l16 8-7 2-2 7-7-17z"
                  className={isHovering ? "text-orange-500" : "text-text/80"}
                />
              </svg>

              {/* Click ripple */}
              {isClicking && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 rounded-full bg-orange-500/40 animate-ping" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phone home indicator */}
        <div className="py-1.5 flex justify-center">
          <div className="w-20 h-1 bg-text/20 rounded-full" />
        </div>
      </div>
    </DecorativeWrapper>
  );
}
