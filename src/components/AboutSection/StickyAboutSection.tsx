import React, { useEffect, useRef, useState } from "react";

interface StickyAboutSectionProps {
  children: React.ReactNode;
}

export default function StickyAboutSection({ children }: StickyAboutSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if section is in view
      const isInView = rect.top < viewportHeight && rect.bottom > 0;

      if (isInView && rect.top < viewportHeight / 2) {
        setIsActive(true);

        // Calculate animation progress (0 to 1)
        const scrollStart = viewportHeight;
        const scrollEnd = -container.offsetHeight;
        const distance = scrollStart - rect.top;
        const totalDistance = scrollStart - scrollEnd;
        const p = Math.max(0, Math.min(1, distance / totalDistance));
        setProgress(p);

        // Lock scroll while animating (progress < 1)
        if (p < 1) {
          document.body.style.overflow = "hidden";
        } else {
          document.body.style.overflow = "auto";
          setIsActive(false);
        }
      } else if (isActive) {
        document.body.style.overflow = "auto";
        setIsActive(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.style.overflow = "auto";
    };
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={isActive ? "fixed inset-0 w-screen h-screen flex items-center justify-center z-50 bg-black" : "relative w-full"}
    >
      {children}
    </div>
  );
}
