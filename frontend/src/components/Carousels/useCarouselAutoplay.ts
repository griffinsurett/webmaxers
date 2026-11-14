// src/components/Carousels/useCarouselAutoplay.ts
import { useMemo } from "react";
import { useVisibility } from "@/hooks/animations/useVisibility";
import useEngagementAutoplay from "@/hooks/autoplay/useEngagementAutoplay";

interface UseCarouselAutoplayOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  totalItems: number;
  currentIndex: number;
  setIndex: (next: number) => void;
  autoplay?: boolean;
  autoplayTime?: number;
  threshold?: number;
  resumeDelay?: number;
  resumeTriggers?: string[];
  pauseOnEngage?: boolean;
  engageOnlyOnActiveItem?: boolean;
  activeItemAttr?: string;
}

export default function useCarouselAutoplay({
  containerRef,
  totalItems,
  currentIndex,
  setIndex,
  autoplay = true,
  autoplayTime = 4000,
  threshold = 0.3,
  resumeDelay = 5000,
  resumeTriggers = ["scroll", "click-outside", "hover-away"],
  pauseOnEngage = true,
  engageOnlyOnActiveItem = true,
  activeItemAttr = "data-active",
}: UseCarouselAutoplayOptions) {
  const scopeId = useMemo(
    () => `carousel-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const inView = useVisibility(containerRef, { threshold });

  const autoplayState = useEngagementAutoplay({
    totalItems,
    currentIndex,
    setIndex,
    autoplayTime,
    resumeDelay,
    resumeTriggers,
    containerSelector: `[data-autoplay-scope="${scopeId}"]`,
    itemSelector: `[data-autoplay-scope="${scopeId}"] [data-carousel-item]`,
    inView: autoplay && inView,
    pauseOnEngage,
    engageOnlyOnActiveItem,
    activeItemAttr,
  });

  return {
    scopeId,
    inView,
    ...autoplayState,
  };
}
