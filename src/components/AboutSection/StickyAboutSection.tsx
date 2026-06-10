import React, { useEffect, useRef, useState } from "react";

interface StickyAboutSectionProps {
  children: React.ReactNode;
}

export default function StickyAboutSection({ children }: StickyAboutSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const scrollThreshold = window.innerHeight * 0.3;

      // Sticky when section is in view and we haven't scrolled past it
      const shouldBeSticky = rect.top < scrollThreshold && rect.bottom > window.innerHeight;
      setIsSticky(shouldBeSticky);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={sectionRef}
      className={isSticky ? "sticky top-[10vh]" : "relative"}
    >
      {children}
    </div>
  );
}
