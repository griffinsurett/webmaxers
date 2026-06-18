import { useId } from "react";
import DarkLightToggle from "./DarkLightToggle";
import ReducedMotionToggle from "./ReducedMotionToggle";

interface ThemeControlsProps {
  className?: string;
}

export default function ThemeControls({ className = "" }: ThemeControlsProps) {
  const iconGradientId = useId();

  return (
    <div
      className={[
        "relative flex h-8 shrink-0 items-center justify-center gap-1 sm:h-10 sm:gap-1.5 z-[999999]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Shared gradient def — referenced by the toggle icon fill */}
      <svg aria-hidden="true" width="0" height="0" focusable="false" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          <linearGradient id={iconGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="currentColor" className="text-primary-100" />
            <stop offset="55%"  stopColor="currentColor" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" className="text-primary-800" />
          </linearGradient>
        </defs>
      </svg>

      <ReducedMotionToggle gradientId={iconGradientId} />
      <DarkLightToggle gradientId={iconGradientId} />
    </div>
  );
}
