// src/components/AnimatedExamples/EcommerceIntegrationDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface EcommerceIntegrationDemoProps {
  className?: string;
}

export default function EcommerceIntegrationDemo({ className = "" }: EcommerceIntegrationDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Checkout page with shipping calculating
  // 1: Shipping calculated, total shown
  // 2: Cursor appears
  // 3: Cursor moves to Place Order
  // 4: Click Place Order
  // 5: Show all 3 integrations updating simultaneously

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 600));
    timers.push(setTimeout(() => setStep(2), 1200));
    timers.push(setTimeout(() => setStep(3), 1800));
    timers.push(setTimeout(() => setStep(4), 2300));
    timers.push(setTimeout(() => setStep(5), 2800));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 6500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const shippingCalculated = step >= 1;
  const showCursor = step >= 2 && step < 5 && !prefersReducedMotion;
  const isHovering = step === 3;
  const isClicking = step === 4;
  const showIntegrations = step >= 5;

  const getCursorPosition = () => {
    if (step <= 2) return { left: "80%", top: "30%" };
    if (step >= 3) return { left: "50%", top: "85%" };
    return { left: "80%", top: "30%" };
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
          <span className="text-[10px] text-text/70">
            {showIntegrations ? "Syncing to connected systems..." : "yourstore.com/checkout"}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="bg-bg2 p-3 relative min-h-[220px] overflow-hidden">
        {/* Checkout View */}
        {!showIntegrations && (
          <>
            <h3 className="text-[11px] text-text mb-2">Checkout</h3>

            {/* Order summary */}
            <div className="bg-bg3 rounded-lg p-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-text/10 flex items-center justify-center">
                  <span className="text-sm">👟</span>
                </div>
                <div className="flex-1">
                  <span className="text-[9px] font-medium text-text block">Running Shoes</span>
                  <span className="text-[8px] text-text/50">Size 10 · Black</span>
                </div>
                <span className="text-[9px] font-semibold text-text">$89.00</span>
              </div>
            </div>

            {/* Shipping calculation */}
            <div className="bg-bg3 rounded-lg p-2 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-text/70">Shipping to 90210</span>
                {shippingCalculated ? (
                  <span className="text-[9px] font-medium text-green-500">$5.99</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 border border-text/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-[8px] text-text/50">Calculating...</span>
                  </div>
                )}
              </div>
              {shippingCalculated && (
                <div className="flex items-center gap-1 text-[8px] text-text/50">
                  <span>Est. delivery: 3-5 days</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-t border-text/10 pt-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-semibold text-text">Total</span>
                <span className="text-sm font-semibold text-text">
                  {shippingCalculated ? "$94.99" : "..."}
                </span>
              </div>
            </div>

            {/* Place Order button */}
            <button
              className={`w-full py-2.5 rounded-lg font-semibold text-[11px] transition-all duration-200 ${
                !shippingCalculated
                  ? "bg-text/20 text-text/40"
                  : isHovering
                    ? "bg-primary/90 text-white scale-[1.02]"
                    : isClicking
                      ? "bg-primary text-white scale-95"
                      : "bg-primary text-white"
              }`}
            >
              {shippingCalculated ? "Place Order" : "Calculating..."}
            </button>

            {/* Cursor */}
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
                  <path d="M4 4l16 8-7 2-2 7-7-17z" className={isHovering ? "text-primary" : "text-text/80"} />
                </svg>
                {isClicking && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 rounded-full bg-primary/40 animate-ping" />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* All 3 Integrations Side by Side */}
        {showIntegrations && (
          <div className="animate-[fadeIn_0.3s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-text">Order #1847 Syncing...</span>
              <span className="text-[8px] text-green-500 font-medium animate-pulse">● Live</span>
            </div>

            {/* Three panels side by side */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Inventory Panel */}
              <div className="bg-bg3 rounded-lg p-1.5 animate-[slideUp_0.3s_ease-out]" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[9px]">📦</span>
                  <span className="text-[7px] font-semibold text-text">Inventory</span>
                </div>

                {/* Mini inventory update */}
                <div className="bg-yellow-500/10 rounded p-1 mb-1">
                  <span className="text-[7px] text-text block truncate">Running Shoes</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[7px] text-text/40 line-through">24</span>
                    <span className="text-[8px] text-green-500 font-semibold">→ 23</span>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-[6px] text-green-500">✓ Updated</span>
                </div>
              </div>

              {/* Spreadsheet Panel */}
              <div className="bg-bg3 rounded-lg p-1.5 animate-[slideUp_0.3s_ease-out]" style={{ animationDelay: "150ms" }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[9px]">📊</span>
                  <span className="text-[7px] font-semibold text-text">Sales Log</span>
                </div>

                {/* Mini spreadsheet */}
                <div className="bg-text/5 rounded overflow-hidden mb-1">
                  <div className="grid grid-cols-2 gap-px bg-text/10">
                    <div className="bg-bg3 px-1 py-0.5">
                      <span className="text-[6px] text-text/50">#1846</span>
                    </div>
                    <div className="bg-bg3 px-1 py-0.5">
                      <span className="text-[6px] text-text/50">$79</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-green-500/30">
                    <div className="bg-green-500/10 px-1 py-0.5">
                      <span className="text-[6px] text-text font-semibold">#1847</span>
                    </div>
                    <div className="bg-green-500/10 px-1 py-0.5">
                      <span className="text-[6px] text-green-600 font-semibold">$94.99</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-[6px] text-green-500">✓ Row added</span>
                </div>
              </div>

              {/* Slack Panel */}
              <div className="bg-bg3 rounded-lg p-1.5 animate-[slideUp_0.3s_ease-out]" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[9px]">💬</span>
                  <span className="text-[7px] font-semibold text-text">Team Chat</span>
                </div>

                {/* Mini slack message */}
                <div className="bg-green-500/10 border border-green-500/20 rounded p-1 mb-1">
                  <div className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-3 h-3 rounded bg-blue-500 flex items-center justify-center">
                      <span className="text-[5px]">🤖</span>
                    </div>
                    <span className="text-[6px] text-green-500">now</span>
                  </div>
                  <p className="text-[6px] text-text leading-tight">
                    🚀 Ship #1847<br/>
                    <span className="text-text/60">Shoes → 90210</span>
                  </p>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-[6px] text-green-500">✓ Notified</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-2 text-center">
              <span className="text-[8px] text-green-500 font-medium">✓ All systems synced automatically</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </DecorativeWrapper>
  );
}
