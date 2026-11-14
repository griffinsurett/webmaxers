// src/components/LoopTemplates/Portfolio/useImageCycling.ts
// Shared hook for cycling through images within a portfolio slide/group
// Handles transitions, keyboard navigation, and auto-advance on scroll complete

import { useCallback, useEffect, useRef, useState } from "react";

const SLIDE_TRANSITION_DURATION_MS = 750;

export interface UseImageCyclingOptions {
  /** Total number of images to cycle through */
  totalImages: number;
  /** Whether this slide/group is currently active */
  isActive: boolean;
  /** Called when all images have been shown and we should advance to next slide/group */
  onCycleComplete?: () => void;
  /** Reset to first image when becoming active (default: true) */
  resetOnActivate?: boolean;
}

export interface UseImageCyclingReturn {
  /** Current image index */
  imageIndex: number;
  /** Previous image index (for transition animations) */
  prevImageIndex: number | null;
  /** Current transition stage */
  transitionStage: "idle" | "pre" | "animating";
  /** Navigate to previous image, or return false if at first image */
  goToPrevious: () => boolean;
  /** Navigate to next image, or call onCycleComplete if at last image */
  goToNext: () => boolean;
  /** Go to a specific image index */
  goToIndex: (index: number) => void;
  /** Handle scroll complete - advances to next image or triggers cycle complete */
  handleScrollComplete: () => void;
  /** Whether currently transitioning */
  isTransitioning: boolean;
}

export function useImageCycling({
  totalImages,
  isActive,
  onCycleComplete,
  resetOnActivate = true,
}: UseImageCyclingOptions): UseImageCyclingReturn {
  const [imageIndex, setImageIndex] = useState(0);
  const [prevImageIndex, setPrevImageIndex] = useState<number | null>(null);
  const [transitionStage, setTransitionStage] = useState<"idle" | "pre" | "animating">("idle");

  const transitionTimerRef = useRef<number | null>(null);
  const transitionFrameRef = useRef<number | null>(null);

  // Reset when becoming active
  useEffect(() => {
    if (isActive && resetOnActivate) {
      setImageIndex(0);
      setPrevImageIndex(null);
      setTransitionStage("idle");
    }
  }, [isActive, resetOnActivate]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
      }
    };
  }, []);

  const startTransition = useCallback(
    (targetIndex: number) => {
      if (typeof window === "undefined") return;

      setPrevImageIndex(imageIndex);
      setImageIndex(targetIndex);
      setTransitionStage("pre");

      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
      }

      transitionFrameRef.current = requestAnimationFrame(() => {
        transitionFrameRef.current = requestAnimationFrame(() => {
          setTransitionStage("animating");
        });
      });

      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionStage("idle");
        setPrevImageIndex(null);
      }, SLIDE_TRANSITION_DURATION_MS);
    },
    [imageIndex]
  );

  const goToPrevious = useCallback(() => {
    if (!isActive || totalImages <= 1) return false;
    if (transitionStage !== "idle") return false;

    if (imageIndex > 0) {
      startTransition(imageIndex - 1);
      return true;
    }
    return false; // At first image, let parent handle going to previous slide
  }, [isActive, totalImages, transitionStage, imageIndex, startTransition]);

  const goToNext = useCallback(() => {
    if (!isActive || totalImages <= 1) return false;
    if (transitionStage !== "idle") return false;

    const nextIndex = imageIndex + 1;
    if (nextIndex < totalImages) {
      startTransition(nextIndex);
      return true;
    }
    // At last image, trigger cycle complete
    onCycleComplete?.();
    return false;
  }, [isActive, totalImages, transitionStage, imageIndex, startTransition, onCycleComplete]);

  const goToIndex = useCallback(
    (index: number) => {
      if (!isActive || transitionStage !== "idle") return;
      if (index < 0 || index >= totalImages) return;
      if (index === imageIndex) return;
      startTransition(index);
    },
    [isActive, transitionStage, totalImages, imageIndex, startTransition]
  );

  const handleScrollComplete = useCallback(() => {
    if (!isActive || totalImages === 0) return;
    if (transitionStage !== "idle") return;

    const nextIndex = imageIndex + 1;
    if (nextIndex < totalImages) {
      startTransition(nextIndex);
    } else {
      onCycleComplete?.();
    }
  }, [isActive, totalImages, transitionStage, imageIndex, startTransition, onCycleComplete]);

  return {
    imageIndex,
    prevImageIndex,
    transitionStage,
    goToPrevious,
    goToNext,
    goToIndex,
    handleScrollComplete,
    isTransitioning: transitionStage !== "idle",
  };
}
