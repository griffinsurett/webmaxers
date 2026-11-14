// src/components/LoopTemplates/FilterNavigation.tsx
/**
 * FilterNavigation - Dedicated navigation wrapper for filter tabs
 *
 * Provides small arrow buttons and horizontal fade effect for filter tabs.
 * Used by FilteredPortfolioCarousel.
 */
import type { ReactNode } from "react";

const ChevronLeftIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 320 512"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" />
  </svg>
);

const ChevronRightIcon = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 320 512"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
  </svg>
);

interface FilterNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
  children: ReactNode;
}

const arrowClasses =
  "hidden md:flex w-10 h-10 rounded-full faded-bg text-text backdrop-blur-sm transition hover:bg-heading/20 hover:border-heading/50 shrink-0 items-center justify-center";

const iconClasses = "w-4 h-4";

export default function FilterNavigation({
  onPrevious,
  onNext,
  className = "",
  children,
}: FilterNavigationProps) {
  return (
    <div className={`flex justify-center ${className}`.trim()}>
      <div className="flex items-center justify-center gap-2 inner-section w-full">
        <button
          type="button"
          onClick={onPrevious}
          className={arrowClasses}
          aria-label="Previous filter"
        >
          <ChevronLeftIcon className={iconClasses} />
        </button>

        <div className="overflow-hidden horizontal-edge-fade flex-1 min-w-0">
          {children}
        </div>

        <button
          type="button"
          onClick={onNext}
          className={arrowClasses}
          aria-label="Next filter"
        >
          <ChevronRightIcon className={iconClasses} />
        </button>
      </div>
    </div>
  );
}
