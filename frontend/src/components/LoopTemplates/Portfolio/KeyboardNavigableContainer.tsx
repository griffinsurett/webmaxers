// src/components/LoopTemplates/Portfolio/KeyboardNavigableContainer.tsx
// Shared keyboard-navigable container for portfolio carousels
// Supports two-level navigation: images within a slide, then slides
import { useCallback, useRef, type ReactNode, type RefObject } from "react";
import { useKeyboardInteraction } from "@/hooks/interactions/useKeyboardInteraction";

interface KeyboardNavigableContainerProps {
  children: ReactNode;
  /** Called when navigating to previous slide */
  onPrevious: () => void;
  /** Called when navigating to next slide */
  onNext: () => void;
  /**
   * Optional: Try to navigate within slide first.
   * Return true if handled (moved within slide), false to proceed to slide navigation.
   */
  onPreviousWithinSlide?: () => boolean;
  /**
   * Optional: Try to navigate within slide first.
   * Return true if handled (moved within slide), false to proceed to slide navigation.
   */
  onNextWithinSlide?: () => boolean;
  className?: string;
  ariaLabel?: string;
  /** Pass a ref to use an external container instead of creating one */
  containerRef?: RefObject<HTMLDivElement | null>;
}

export default function KeyboardNavigableContainer({
  children,
  onPrevious,
  onNext,
  onPreviousWithinSlide,
  onNextWithinSlide,
  className = "",
  ariaLabel = "Carousel. Use left and right arrow keys to navigate.",
  containerRef: externalRef,
}: KeyboardNavigableContainerProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalRef ?? internalRef;

  // Handle left arrow: try within-slide first, then slide navigation
  const handlePrevious = useCallback(() => {
    if (onPreviousWithinSlide?.()) return;
    onPrevious();
  }, [onPreviousWithinSlide, onPrevious]);

  // Handle right arrow: try within-slide first, then slide navigation
  const handleNext = useCallback(() => {
    if (onNextWithinSlide?.()) return;
    onNext();
  }, [onNextWithinSlide, onNext]);

  useKeyboardInteraction({
    elementRef: containerRef,
    requireFocus: true,
    onArrowLeft: handlePrevious,
    onArrowRight: handleNext,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
    >
      {children}
    </div>
  );
}
