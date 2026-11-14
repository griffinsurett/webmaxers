// src/components/AnimatedExamples/SecureBrowserBar.tsx
import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface SecureBrowserBarProps {
  /** URL to display */
  url?: string;
  /** Additional className */
  className?: string;
}

export default function SecureBrowserBar({
  url = "yoursite.com",
  className = "",
}: SecureBrowserBarProps) {
  const prefersReducedMotion = useMotionPreference();
  // Start with false, effect will set to true immediately if reduced motion
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    // If user prefers reduced motion, show final state immediately
    if (prefersReducedMotion) {
      setShowBadge(true);
      return;
    }

    // Reset when animation starts
    setShowBadge(false);

    // Animate badge in after a short delay
    const timer = setTimeout(() => {
      setShowBadge(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    <DecorativeWrapper className={`bg-text/10 rounded-lg p-3 select-none pointer-events-none ${className}`}>
      {/* Browser bar */}
      <div className="flex items-center gap-2">
        {/* Browser dots */}
        <div className="flex gap-1.5 mr-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 bg-bg2 rounded-md px-3 py-1.5">
          {/* Secure badge - animates in (no transition for reduced motion) */}
          <div
            className={`flex items-center gap-1.5 accent-primary-gradient rounded px-2 py-0.5 ${
              prefersReducedMotion ? "" : "transition-all duration-500 ease-out"
            } ${
              showBadge
                ? "opacity-100 translate-x-0 scale-100"
                : "opacity-0 -translate-x-4 scale-75"
            }`}
          >
            <Icon icon="lu:lock" size="sm" className="text-white" />
            <span className="text-xs font-medium text-white">Secure</span>
          </div>

          {/* URL */}
          <span className="text-sm text-text">{url}</span>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
