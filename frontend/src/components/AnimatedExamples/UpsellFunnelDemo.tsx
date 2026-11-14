// src/components/AnimatedExamples/UpsellFunnelDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface UpsellFunnelDemoProps {
  className?: string;
}

export default function UpsellFunnelDemo({ className = "" }: UpsellFunnelDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Cart with item, upsell visible
  // 1: Cursor appears
  // 2: Cursor moves to upsell "Add" button
  // 3: Hover on upsell Add
  // 4: Click upsell Add
  // 5: Upsell added, subtotal updates

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 500));
    timers.push(setTimeout(() => setStep(2), 1200));
    timers.push(setTimeout(() => setStep(3), 1800));
    timers.push(setTimeout(() => setStep(4), 2300));
    timers.push(setTimeout(() => setStep(5), 2800));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 5500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const showCursor = step >= 1 && step < 5 && !prefersReducedMotion;
  const isHoveringUpsell = step === 3;
  const isClickingUpsell = step === 4;
  const upsellAdded = step >= 5;

  const getCursorPosition = () => {
    if (step <= 1) return { left: "80%", top: "25%" };
    if (step >= 2) return { left: "78%", top: "42%" }; // On upsell Add button
    return { left: "80%", top: "25%" };
  };

  const cursorPos = getCursorPosition();

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Browser chrome */}
      <div className="bg-bg2 px-3 py-2 flex items-center gap-2 border-b border-text/10">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 bg-bg3 rounded px-2 py-0.5">
          <span className="text-[10px] text-text/70">yourstore.com/cart</span>
        </div>
        {/* Cart icon */}
        <div className="relative">
          <svg className="w-4 h-4 text-text/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className={`absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center ${
            step === 5 && !prefersReducedMotion ? "animate-bounce" : ""
          }`}>
            <span className="text-[7px] text-white font-semibold">{upsellAdded ? "2" : "1"}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-bg2 p-3 relative h-[200px]">
        {/* Compact cart item */}
        <div className="bg-bg3 rounded-lg p-1.5 flex gap-2 mb-2">
          <div className="w-8 h-8 rounded bg-text/10 flex items-center justify-center shrink-0">
            <span className="text-sm">📷</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-medium text-text block">Pro Digital Camera</span>
            <span className="text-[7px] text-text/50">Qty: 1</span>
          </div>
          <span className="text-[9px] font-semibold text-text">$599</span>
        </div>

        {/* Upsell recommendation */}
        <div className={`border rounded-lg p-1.5 mb-2 transition-colors duration-300 ${
          upsellAdded
            ? "border-green-500/30 bg-green-500/5"
            : "border-soft-strong bg-primary/5"
        }`}>
          <div className="flex items-center gap-1 mb-1">
            <span className={`text-[7px] font-semibold transition-colors duration-300 ${
              upsellAdded ? "text-green-500" : "text-primary"
            }`}>
              {upsellAdded ? "✓ Added!" : "💡 You might like this too"}
            </span>
          </div>

          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded bg-bg3 flex items-center justify-center shrink-0">
              <span className="text-xs">🎒</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[7px] font-medium text-text block">Camera Bag Pro</span>
              <span className="text-[7px] text-text/50">Perfect fit</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-semibold text-text block">$49</span>
              <button
                className={`mt-0.5 px-1.5 py-0.5 rounded text-[6px] font-medium transition-all duration-200 ${
                  upsellAdded
                    ? "opacity-0 scale-75"
                    : isHoveringUpsell
                      ? "bg-primary/90 text-white scale-105 opacity-100"
                      : isClickingUpsell
                        ? "bg-primary text-white scale-95 opacity-100"
                        : "bg-primary text-white opacity-100"
                }`}
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Cart total - always visible */}
        <div className="border-t border-text/10 pt-2 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-text/60">Subtotal</span>
            <span className={`text-sm font-semibold tabular-nums transition-all duration-300 ${
              upsellAdded ? "text-green-500 scale-110" : "text-text"
            }`}>
              {upsellAdded ? "$648" : "$599"}
            </span>
          </div>
          <div className={`flex justify-between items-center mt-0.5 h-[14px] transition-opacity duration-300 ${
            upsellAdded ? "opacity-100" : "opacity-0"
          }`}>
            <span className="text-[7px] text-green-500">Bundle savings</span>
            <span className="text-[7px] text-green-500 font-medium">-$10</span>
          </div>
        </div>

        {/* Checkout button - always visible */}
        <button className={`w-full py-2 rounded-lg font-semibold text-[10px] transition-all duration-300 ${
          upsellAdded
            ? "bg-green-500 text-white"
            : "bg-primary text-white"
        }`}>
          <span className="tabular-nums">{upsellAdded ? "✓ Checkout — $638" : "Checkout — $599"}</span>
        </button>

        {/* Animated cursor */}
        {showCursor && (
          <div
            className="absolute pointer-events-none transition-all duration-400 ease-out z-10"
            style={{
              left: cursorPos.left,
              top: cursorPos.top,
              transform: `translate(-50%, -50%) ${isClickingUpsell ? "scale(0.8)" : "scale(1)"}`,
            }}
          >
            <svg
              className={`w-5 h-5 drop-shadow-md transition-transform duration-100 ${isClickingUpsell ? "rotate-12" : ""}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M4 4l16 8-7 2-2 7-7-17z"
                className={isHoveringUpsell ? "text-primary" : "text-text/80"}
              />
            </svg>

            {/* Click ripple */}
            {isClickingUpsell && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-6 h-6 rounded-full bg-primary/40 animate-ping" />
              </div>
            )}
          </div>
        )}
      </div>
    </DecorativeWrapper>
  );
}
