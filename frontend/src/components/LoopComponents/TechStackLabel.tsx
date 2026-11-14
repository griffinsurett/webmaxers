// src/components/LoopComponents/TechStackLabel.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import { staggeredAnimationProps } from "@/integrations/scroll-animations";

interface TechStackLabelProps {
  name: string;
  index: number;
  onTechHover?: (name: string) => void;
  onTechLeave?: () => void;
  showName?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function TechStackLabel({
  name,
  index,
  onTechHover,
  onTechLeave,
  showName = false,
  className = "",
  children,
}: TechStackLabelProps) {
  const [isMobileActive, setIsMobileActive] = useState(false);
  const mobileTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (mobileTimeoutRef.current) {
        window.clearTimeout(mobileTimeoutRef.current);
      }
    },
    [],
  );

  const handleMouseEnter = () => onTechHover?.(name);
  const handleMouseLeave = () => {
    setIsMobileActive(false);
    onTechLeave?.();
  };

  const handleTouch = () => {
    if (mobileTimeoutRef.current) {
      window.clearTimeout(mobileTimeoutRef.current);
    }
    setIsMobileActive(true);
    onTechHover?.(name);
    mobileTimeoutRef.current = window.setTimeout(() => {
      setIsMobileActive(false);
      onTechLeave?.();
    }, 2500);
  };

  return (
    <div
      {...staggeredAnimationProps("fade-in", index, { once: true, staggerDelay: 50 })}
      data-tech-item
      data-tech-name={name}
      data-index={index}
      className={`group flex flex-col items-center flex-shrink-0 cursor-pointer ${className}`.trim()}
      role="button"
      tabIndex={0}
      aria-label={name}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      onTouchStart={handleTouch}
    >
      <div className="relative p-2 transition-all duration-300 group-hover:scale-110 select-none">
        <div
          className={`relative text-heading transition-opacity duration-300 ${
            isMobileActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
          }`}
        >
          {children}
        </div>
      </div>

      {showName ? (
        <div
          className={`mt-2 text-xs md:text-sm text-muted transition-all duration-300 whitespace-nowrap ${
            isMobileActive
              ? "opacity-100 translate-y-0"
              : "opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
          }`}
        >
          {name}
        </div>
      ) : (
        <span className="sr-only">{name}</span>
      )}
    </div>
  );
}
