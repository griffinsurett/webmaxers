// src/components/AnimatedExamples/RestaurantMapOrder.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface RestaurantMapOrderProps {
  className?: string;
}

export default function RestaurantMapOrder({ className = "" }: RestaurantMapOrderProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - map view with pin
  // 1: Cursor appears
  // 2: Cursor moves to pin
  // 3: Click pin - info card appears
  // 4: Cursor moves to "Order Online" button
  // 5: Hover on Order Online
  // 6: Click Order Online
  // 7: Order platform opens

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(7);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 300));
    timers.push(setTimeout(() => setStep(2), 800));
    timers.push(setTimeout(() => setStep(3), 1400));
    timers.push(setTimeout(() => setStep(4), 2200));
    timers.push(setTimeout(() => setStep(5), 2800));
    timers.push(setTimeout(() => setStep(6), 3300));
    timers.push(setTimeout(() => setStep(7), 3700));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 6000);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const showCursor = step >= 1 && step < 7 && !prefersReducedMotion;
  const showInfoCard = step >= 3;
  const isHoveringOrder = step === 5;
  const isClickingOrder = step === 6;
  const showOrderPlatform = step >= 7;

  const getCursorPosition = () => {
    if (step <= 1) return { left: "80%", top: "75%" };
    if (step === 2) return { left: "50%", top: "38%" }; // On pin
    if (step === 3) return { left: "50%", top: "38%" }; // Still on pin after click
    if (step >= 4) return { left: "50%", top: "88%" }; // On Order Online button (center button)
    return { left: "80%", top: "75%" };
  };

  const cursorPos = getCursorPosition();
  const isPinClicking = step === 3;

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
          <span className="text-[10px] text-text/70">google.com/maps</span>
        </div>
      </div>

      {/* Map content */}
      <div className="bg-[#e8e4df] relative h-[200px] overflow-hidden">
        {/* Map background with roads */}
        <div className="absolute inset-0">
          {/* Roads */}
          <div className="absolute top-[30%] left-0 right-0 h-3 bg-white/80" />
          <div className="absolute top-[60%] left-0 right-0 h-2 bg-white/60" />
          <div className="absolute left-[25%] top-0 bottom-0 w-2 bg-white/60" />
          <div className="absolute left-[70%] top-0 bottom-0 w-3 bg-white/80" />

          {/* Buildings/blocks */}
          <div className="absolute top-[8%] left-[8%] w-12 h-8 bg-[#d4cfc7] rounded-sm" />
          <div className="absolute top-[10%] left-[45%] w-16 h-6 bg-[#d4cfc7] rounded-sm" />
          <div className="absolute top-[40%] left-[10%] w-10 h-10 bg-[#d4cfc7] rounded-sm" />
          <div className="absolute top-[70%] left-[35%] w-20 h-8 bg-[#d4cfc7] rounded-sm" />
          <div className="absolute top-[75%] left-[75%] w-14 h-10 bg-[#d4cfc7] rounded-sm" />

          {/* Park/green area */}
          <div className="absolute top-[42%] left-[78%] w-12 h-12 bg-[#c5d6a3] rounded-sm" />
        </div>

        {/* Restaurant pin */}
        <div
          className={`absolute left-1/2 top-[35%] -translate-x-1/2 transition-transform duration-200 ${
            isPinClicking ? "scale-110" : ""
          }`}
        >
          <div className="relative">
            {/* Pin shadow */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-3 h-1 bg-black/20 rounded-full blur-sm" />
            {/* Pin */}
            <svg className="w-8 h-8 text-red-500 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {/* Pulse effect */}
            {step < 3 && !prefersReducedMotion && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-500/30 animate-ping" />
            )}
          </div>
        </div>

        {/* Info card popup */}
        {showInfoCard && !showOrderPlatform && (
          <div className="absolute left-1/2 top-[52%] -translate-x-1/2 bg-white rounded-lg shadow-lg p-2.5 w-[85%] max-w-[220px] animate-[fadeIn_0.3s_ease-out]">
            {/* Restaurant info */}
            <div className="flex gap-2 mb-2">
              <div className="w-12 h-12 rounded bg-orange-100 flex items-center justify-center shrink-0">
                <span className="text-lg">🌮</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[11px] text-gray-900 truncate">Taco Fiesta</h3>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-yellow-500">★★★★★</span>
                  <span className="text-[8px] text-gray-500">(324)</span>
                </div>
                <p className="text-[8px] text-gray-500">Mexican Restaurant · $$</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button className="flex-1 bg-gray-100 rounded px-2 py-1.5 text-[8px] text-gray-700 font-medium">
                Directions
              </button>
              <button
                className={`flex-1 rounded px-2 py-1.5 text-[8px] font-medium transition-all duration-200 ${
                  isHoveringOrder
                    ? "bg-blue-600 text-white scale-105"
                    : isClickingOrder
                      ? "bg-blue-700 text-white scale-95"
                      : "bg-blue-500 text-white"
                }`}
              >
                Order Online
              </button>
              <button className="flex-1 bg-gray-100 rounded px-2 py-1.5 text-[8px] text-gray-700 font-medium">
                Call
              </button>
            </div>

            {/* Card pointer */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-white" />
          </div>
        )}

        {/* Order platform overlay */}
        {showOrderPlatform && (
          <div className="absolute inset-0 bg-white animate-[fadeIn_0.3s_ease-out]">
            {/* Order platform header */}
            <div className="bg-orange-500 px-3 py-2 flex items-center gap-2">
              <span className="text-white text-[10px] font-semibold">🍽️ OrderNow</span>
              <span className="text-white/80 text-[8px]">· Taco Fiesta</span>
            </div>

            {/* Menu items */}
            <div className="p-2 space-y-1.5">
              <div className="flex items-center justify-between bg-gray-50 rounded p-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-sm">🌮</div>
                  <div>
                    <span className="text-[9px] font-medium text-gray-900 block">Street Tacos (3)</span>
                    <span className="text-[8px] text-gray-500">Carne asada, cilantro, onion</span>
                  </div>
                </div>
                <span className="text-[9px] font-semibold text-gray-900">$9.99</span>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded p-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-sm">🌯</div>
                  <div>
                    <span className="text-[9px] font-medium text-gray-900 block">Burrito Supreme</span>
                    <span className="text-[8px] text-gray-500">Rice, beans, cheese, sour cream</span>
                  </div>
                </div>
                <span className="text-[9px] font-semibold text-gray-900">$12.99</span>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded p-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-sm">🥤</div>
                  <div>
                    <span className="text-[9px] font-medium text-gray-900 block">Horchata</span>
                    <span className="text-[8px] text-gray-500">Traditional rice drink</span>
                  </div>
                </div>
                <span className="text-[9px] font-semibold text-gray-900">$3.50</span>
              </div>
            </div>

            {/* Cart button */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-orange-500 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-white text-[9px] font-medium">View Cart</span>
                <span className="text-white text-[9px] font-semibold">$26.48</span>
              </div>
            </div>
          </div>
        )}

        {/* Animated cursor */}
        {showCursor && (
          <div
            className="absolute pointer-events-none transition-all duration-500 ease-out z-20"
            style={{
              left: cursorPos.left,
              top: cursorPos.top,
              transform: `translate(-50%, -50%) ${isClickingOrder || isPinClicking ? "scale(0.8)" : "scale(1)"}`,
            }}
          >
            <svg
              className={`w-5 h-5 drop-shadow-md transition-transform duration-100 ${
                isClickingOrder || isPinClicking ? "rotate-12" : ""
              }`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M4 4l16 8-7 2-2 7-7-17z"
                className={isHoveringOrder ? "text-blue-500" : "text-gray-800"}
              />
            </svg>

            {/* Click ripple */}
            {(isClickingOrder || isPinClicking) && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className={`w-6 h-6 rounded-full animate-ping ${
                  isPinClicking ? "bg-red-500/40" : "bg-blue-500/40"
                }`} />
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </DecorativeWrapper>
  );
}
