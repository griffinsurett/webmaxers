// src/components/AnimatedExamples/RestaurantQuickActions.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface RestaurantQuickActionsProps {
  className?: string;
}

export default function RestaurantQuickActions({ className = "" }: RestaurantQuickActionsProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Animation steps:
  // 0: Initial - site loads instantly
  // 1: Cursor appears
  // 2: Cursor moves toward menu button
  // 3: Hover on menu button
  // 4: Click menu button
  // 5: Menu opens/expands

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setStep(1), 400));
    timers.push(setTimeout(() => setStep(2), 1000));
    timers.push(setTimeout(() => setStep(3), 1600));
    timers.push(setTimeout(() => setStep(4), 2200));
    timers.push(setTimeout(() => setStep(5), 2600));

    const resetTimer = setTimeout(() => {
      setAnimationKey(k => k + 1);
    }, 5500);
    timers.push(resetTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [animationKey, prefersReducedMotion]);

  const showCursor = step >= 1 && step < 5 && !prefersReducedMotion;
  const isHovering = step === 3;
  const isClicking = step === 4;
  const showMenu = step >= 5;

  const getCursorPosition = () => {
    if (step <= 1) return { left: "75%", top: "80%" };
    if (step >= 2) return { left: "28%", top: "48%" }; // On menu button
    return { left: "75%", top: "80%" };
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
          <span className="text-[10px] text-text/70">tacofiesta.com</span>
        </div>
      </div>

      {/* Restaurant site content */}
      <div className="bg-bg2 p-4 relative min-h-[180px] overflow-hidden">
        {/* Hero section */}
        <div className="text-center mb-4">
          <h2 className="text-base text-text mb-1">Hungry?</h2>
          <p className="text-[10px] text-text/60">Authentic tacos & fresh margaritas</p>
        </div>

        {/* Quick action buttons */}
        <div className="flex justify-center gap-2 mb-4">
          {/* Menu button */}
          <div
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${
              isHovering ? "bg-primary/20 scale-105" : "bg-bg3"
            } ${isClicking ? "scale-95" : ""} ${showMenu ? "ring-2 ring-primary bg-primary/15" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isHovering || showMenu ? "bg-primary" : "bg-primary/80"
            }`}>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[9px] text-text font-medium">Menu</span>
          </div>

          {/* Call button */}
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-bg3">
            <div className="w-8 h-8 rounded-full bg-green-500/80 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </div>
            <span className="text-[9px] text-text font-medium">Call</span>
          </div>

          {/* Directions button */}
          <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-bg3">
            <div className="w-8 h-8 rounded-full bg-blue-500/80 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <span className="text-[9px] text-text font-medium">Directions</span>
          </div>
        </div>

        {/* Menu expansion panel */}
        <div
          className={`bg-bg3 rounded-lg overflow-hidden transition-all duration-500 ease-out ${
            showMenu ? "max-h-[120px] opacity-100 p-3" : "max-h-0 opacity-0 p-0"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-text">Our Menu</span>
            <span className="text-[8px] text-primary">View Full Menu →</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-bg2 rounded p-1.5">
              <span className="text-[9px] font-medium text-text block">Street Tacos</span>
              <span className="text-[8px] text-text/50">from $3.50</span>
            </div>
            <div className="bg-bg2 rounded p-1.5">
              <span className="text-[9px] font-medium text-text block">Burritos</span>
              <span className="text-[8px] text-text/50">from $9.99</span>
            </div>
            <div className="bg-bg2 rounded p-1.5">
              <span className="text-[9px] font-medium text-text block">Quesadillas</span>
              <span className="text-[8px] text-text/50">from $7.99</span>
            </div>
            <div className="bg-bg2 rounded p-1.5">
              <span className="text-[9px] font-medium text-text block">Margaritas</span>
              <span className="text-[8px] text-text/50">from $8.00</span>
            </div>
          </div>
        </div>

        {/* Animated cursor */}
        {showCursor && (
          <div
            className="absolute pointer-events-none transition-all duration-500 ease-out z-10"
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
    </DecorativeWrapper>
  );
}
