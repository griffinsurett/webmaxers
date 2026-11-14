// src/components/ResponsiveShowcase.tsx
import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface ResponsiveShowcaseProps {
  /** Additional className */
  className?: string;
}

export default function ResponsiveShowcase({
  className = "",
}: ResponsiveShowcaseProps) {
  const prefersReducedMotion = useMotionPreference();
  // Final state: show mobile width (40%) to display responsive hamburger menu
  const [widthPercent, setWidthPercent] = useState(100);
  const [direction, setDirection] = useState<"shrinking" | "growing">("shrinking");

  // Smooth animation: shrink from 100% to 40%, then grow back
  useEffect(() => {
    // If user prefers reduced motion, show mobile width (final state)
    if (prefersReducedMotion) {
      setWidthPercent(40);
      return;
    }

    const interval = setInterval(() => {
      setWidthPercent((prev) => {
        if (direction === "shrinking") {
          if (prev <= 40) {
            setDirection("growing");
            return prev + 1;
          }
          return prev - 1;
        } else {
          if (prev >= 100) {
            setDirection("shrinking");
            return prev - 1;
          }
          return prev + 1;
        }
      });
    }, 40); // Smooth animation speed

    return () => clearInterval(interval);
  }, [direction, prefersReducedMotion]);

  // Determine breakpoint for layout changes
  const isMobile = widthPercent < 50;
  const isTablet = widthPercent >= 50 && widthPercent < 75;

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg p-4 overflow-hidden select-none pointer-events-none ${className}`}>
      {/* Width indicator */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs text-text/40">
          {isMobile ? "Mobile" : isTablet ? "Tablet" : "Desktop"}
        </span>
        <span className="text-xs text-primary font-mono">{widthPercent}%</span>
      </div>

      {/* Browser window container */}
      <div className="flex justify-center">
        <div
          className="transition-none relative"
          style={{ width: `${widthPercent}%`, minWidth: "120px" }}
        >
          {/* Resize handle indicator (left side) */}
          <div className="absolute -left-1 top-0 bottom-0 w-1 flex items-center justify-center opacity-50">
            <div className="w-0.5 h-8 bg-primary/50 rounded-full" />
          </div>

          {/* Browser chrome */}
          <div className="bg-bg2 rounded-t-lg px-2 py-1.5 flex items-center gap-2 border-b border-text/10">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/60" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
              <div className="w-2 h-2 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 bg-bg3 rounded px-2 py-0.5 overflow-hidden">
              <span className="text-[10px] text-text/70 whitespace-nowrap">yoursite.com</span>
            </div>
          </div>

          {/* Content area - fixed height to prevent layout shift */}
          <div className="bg-bg2 rounded-b-lg p-3 h-[120px] overflow-hidden">
            <div className="space-y-2">
              {/* Header - nav collapses to hamburger */}
              <div className="flex items-center justify-between h-3">
                <div className="w-12 h-3 bg-primary/30 rounded shrink-0" />
                {!isMobile ? (
                  <div className="flex gap-1.5 overflow-hidden">
                    <div className="w-8 h-2 bg-text/20 rounded shrink-0" />
                    <div className="w-8 h-2 bg-text/20 rounded shrink-0" />
                    {!isTablet && <div className="w-8 h-2 bg-text/20 rounded shrink-0" />}
                  </div>
                ) : (
                  <div className="w-4 h-3 flex flex-col gap-0.5 justify-center shrink-0">
                    <div className="w-full h-0.5 bg-text/40 rounded" />
                    <div className="w-full h-0.5 bg-text/40 rounded" />
                    <div className="w-full h-0.5 bg-text/40 rounded" />
                  </div>
                )}
              </div>

              {/* Hero text */}
              <div className="h-[26px]">
                <div className="h-4 bg-text/25 rounded mb-1.5 w-full" />
                <div className="h-2 bg-text/15 rounded w-3/4" />
              </div>

              {/* Grid - always show 3 items, just change columns */}
              <div
                className={`grid gap-1.5 h-[50px] ${
                  isMobile
                    ? "grid-cols-1"
                    : isTablet
                      ? "grid-cols-2"
                      : "grid-cols-3"
                }`}
              >
                <div className="h-8 bg-primary/20 rounded" />
                <div className={`h-8 bg-primary/20 rounded ${isMobile ? "hidden" : ""}`} />
                <div className={`h-8 bg-primary/20 rounded ${isMobile || isTablet ? "hidden" : ""}`} />
              </div>
            </div>
          </div>

          {/* Resize handle indicator (right side) */}
          <div className="absolute -right-1 top-0 bottom-0 w-1 flex items-center justify-center opacity-50">
            <div className="w-0.5 h-8 bg-primary/50 rounded-full" />
          </div>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
