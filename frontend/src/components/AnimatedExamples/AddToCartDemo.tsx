// src/components/AnimatedExamples/AddToCartDemo.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface AddToCartDemoProps {
  className?: string;
}

export default function AddToCartDemo({ className = "" }: AddToCartDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - product page loads
  // 1: Cursor appears
  // 2: Cursor moves to Add to Cart button
  // 3: Hover on button
  // 4: Click button
  // 5: Button shows "Added!" + cart icon updates
  // 6: Cart drawer slides in

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(6);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 300));
    timers.push(setTimeout(() => setStep(2), 900));
    timers.push(setTimeout(() => setStep(3), 1500));
    timers.push(setTimeout(() => setStep(4), 2000));
    timers.push(setTimeout(() => setStep(5), 2400));
    timers.push(setTimeout(() => setStep(6), 3000));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 5500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const showCursor = step >= 1 && step < 5 && !prefersReducedMotion;
  const isHovering = step === 3;
  const isClicking = step === 4;
  const showAdded = step >= 5;
  const showCart = step >= 6;

  const getCursorPosition = () => {
    if (step <= 1) return { left: "80%", top: "25%" };
    if (step >= 2) return { left: "50%", top: "78%" }; // On Add to Cart button
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
          <span className="text-[10px] text-text/70">yourstore.com/products/premium-headphones</span>
        </div>
        {/* Cart icon */}
        <div className="relative">
          <svg className="w-4 h-4 text-text/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {showAdded && (
            <div className={`absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center ${
              !prefersReducedMotion && step === 5 ? "animate-bounce" : ""
            }`}>
              <span className="text-[7px] text-white font-semibold">1</span>
            </div>
          )}
        </div>
      </div>

      {/* Product page content */}
      <div className="bg-bg2 p-3 relative min-h-[200px] overflow-hidden">
        <div className="flex gap-3">
          {/* Product image */}
          <div className="w-24 h-24 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 text-text/30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>

          {/* Product info */}
          <div className="flex-1">
            <h2 className="text-sm text-text mb-0.5">Premium Wireless Headphones</h2>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[9px] text-yellow-500">★★★★★</span>
              <span className="text-[8px] text-text/50">(128 reviews)</span>
            </div>
            <p className="text-[9px] text-text/60 mb-2 line-clamp-2">
              Crystal-clear audio with 30-hour battery life. Active noise cancellation.
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-text">$199</span>
              <span className="text-[10px] text-text/40 line-through">$249</span>
              <span className="text-[8px] text-green-500 font-medium">20% OFF</span>
            </div>
          </div>
        </div>

        {/* Add to Cart button */}
        <button
          className={`w-full mt-3 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
            showAdded
              ? "bg-green-500 text-white"
              : isHovering
                ? "bg-primary/90 text-white scale-[1.02]"
                : isClicking
                  ? "bg-primary text-white scale-95"
                  : "bg-primary text-white"
          }`}
        >
          {showAdded ? "✓ Added to Cart!" : "Add to Cart"}
        </button>

        {/* Cart drawer overlay */}
        {showCart && (
          <>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute right-0 top-0 bottom-0 w-[70%] bg-bg2 border-l border-text/10 p-2.5 animate-[slideIn_0.3s_ease-out]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-text">Your Cart (1)</span>
                <div className="w-4 h-4 rounded-full bg-text/10 flex items-center justify-center">
                  <span className="text-[8px] text-text/50">✕</span>
                </div>
              </div>

              {/* Cart item */}
              <div className="bg-bg3 rounded p-1.5 flex gap-2 mb-2">
                <div className="w-10 h-10 rounded bg-text/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-text/30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] font-medium text-text block truncate">Premium Headphones</span>
                  <span className="text-[8px] text-text/50">Qty: 1</span>
                </div>
                <span className="text-[9px] font-semibold text-text">$199</span>
              </div>

              {/* Cart total */}
              <div className="border-t border-text/10 pt-2 mb-2">
                <div className="flex justify-between text-[9px]">
                  <span className="text-text/60">Subtotal</span>
                  <span className="font-semibold text-text">$199.00</span>
                </div>
              </div>

              {/* Checkout button */}
              <button className="w-full py-2 rounded-lg bg-primary text-white text-[10px] font-semibold">
                Checkout
              </button>
            </div>
          </>
        )}

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
                className={isHovering ? "text-primary" : "text-text/80"}
              />
            </svg>

            {/* Click ripple */}
            {isClicking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-6 h-6 rounded-full bg-primary/40 animate-ping" />
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </DecorativeWrapper>
  );
}
