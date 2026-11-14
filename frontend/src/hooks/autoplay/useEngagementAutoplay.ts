// src/hooks/autoplay/useEngagementAutoplay.ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import useAutoplay from "./useAutoplay";
import { usePauseableState } from "./usePauseableState";
import { useClickInteraction } from "@/hooks/interactions/useClickInteraction";
import { useScrollInteraction } from "@/hooks/interactions/useScrollInteraction";

interface UseEngagementAutoplayOptions {
  totalItems: number;
  currentIndex: number;
  setIndex: (next: number) => void;
  autoplayTime?: number | (() => number);
  resumeDelay?: number;
  resumeTriggers?: string[];
  containerSelector?: string;
  itemSelector?: string;
  inView?: boolean;
  pauseOnEngage?: boolean;
  engageOnlyOnActiveItem?: boolean;
  activeItemAttr?: string;
}

export default function useEngagementAutoplay({
  totalItems,
  currentIndex,
  setIndex,
  autoplayTime = 3000,
  resumeDelay = 5000,
  resumeTriggers = ["scroll", "click-outside", "hover-away"],
  containerSelector = "[data-autoplay-container]",
  itemSelector = "[data-autoplay-item]",
  inView = true,
  pauseOnEngage = false,
  engageOnlyOnActiveItem = false,
  activeItemAttr = "data-active",
}: UseEngagementAutoplayOptions) {
  const graceRef = useRef(false);

  const {
    isPaused,
    userEngaged,
    isResumeScheduled,
    engageUser,
    handleResumeActivity,
    pause,
    resume,
  } = usePauseableState({
    initialPausedState: false,
    resumeTriggers,
    resumeDelay,
  });

  const { advance, schedule } = useAutoplay({
    totalItems,
    currentIndex,
    setIndex,
    autoplayTime,
    enabled: !isPaused && inView,
  });

  const beginGraceWindow = useCallback(() => {
    graceRef.current = true;
    if (userEngaged && !isPaused) pause();
  }, [pause, userEngaged, isPaused]);

  useEffect(() => {
    graceRef.current = false;
  }, [currentIndex]);

  useEffect(() => {
    if (graceRef.current && userEngaged && !isPaused) {
      pause();
    }
  }, [userEngaged, isPaused, pause]);

  useScrollInteraction({
    scrollThreshold: 10,
    debounceDelay: 120,
    onScrollActivity: () => handleResumeActivity("scroll"),
  });

  useClickInteraction({
    containerSelector,
    itemSelector,
    onOutsideClick: () => handleResumeActivity("click-outside"),
    onInsideClick: () => {},
    onItemClick: (_event, item) => {
      if (engageOnlyOnActiveItem) {
        const isActive = item?.getAttribute(activeItemAttr) === "true";
        if (!isActive) return;
      }
      engageUser();
      if (pauseOnEngage) pause();
    },
  });

  useEffect(() => {
    const items = Array.from(document.querySelectorAll(itemSelector));
    if (!items.length) return;

    const isEligible = (element: Element | null) =>
      !!element &&
      (!engageOnlyOnActiveItem ||
        element.getAttribute(activeItemAttr) === "true");

    const onEnter = (event: Event) => {
      const host = event.currentTarget as Element | null;
      if (!isEligible(host)) return;
      engageUser();
      if (pauseOnEngage) pause();
    };

    const onLeave = (event: Event) => {
      if (!(event instanceof MouseEvent)) return;
      const nextHost =
        (event.relatedTarget as Element | null)?.closest?.(itemSelector) ??
        null;
      if (isEligible(nextHost)) return;
      handleResumeActivity("hover-away");
    };

    items.forEach((element) => {
      element.addEventListener("mouseenter", onEnter);
      element.addEventListener("mouseleave", onLeave);
    });

    const pointerListener = (event: PointerEvent) => {
      if (!userEngaged) return;
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const host = under?.closest?.(itemSelector) ?? null;
      if (!isEligible(host)) handleResumeActivity("hover-away");
    };

    document.addEventListener("pointermove", pointerListener, {
      passive: true,
    });

    return () => {
      items.forEach((element) => {
        element.removeEventListener("mouseenter", onEnter);
        element.removeEventListener("mouseleave", onLeave);
      });
      document.removeEventListener("pointermove", pointerListener);
    };
  }, [
    itemSelector,
    activeItemAttr,
    engageOnlyOnActiveItem,
    pauseOnEngage,
    engageUser,
    pause,
    handleResumeActivity,
    userEngaged,
  ]);

  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { phase?: string } | null;
      const phase = detail?.phase;
      const item = (event.target as Element | null)?.closest?.(itemSelector);

      if (engageOnlyOnActiveItem) {
        const isActive = item?.getAttribute(activeItemAttr) === "true";
        if (!isActive) return;
      }

      if (phase === "start") {
        engageUser();
        if (pauseOnEngage && !isPaused) pause();
      } else if (phase === "end") {
        handleResumeActivity("scroll");
      }
    };

    container.addEventListener("autoscroll-user", handler as EventListener);
    return () =>
      container.removeEventListener("autoscroll-user", handler as EventListener);
  }, [
    containerSelector,
    itemSelector,
    activeItemAttr,
    engageOnlyOnActiveItem,
    pauseOnEngage,
    engageUser,
    pause,
    isPaused,
    handleResumeActivity,
  ]);

  return useMemo(
    () => ({
      isAutoplayPaused: isPaused,
      isResumeScheduled,
      userEngaged,
      pause,
      resume,
      engageUser,
      advance,
      schedule,
      beginGraceWindow,
    }),
    [
      advance,
      schedule,
      beginGraceWindow,
      engageUser,
      isPaused,
      isResumeScheduled,
      pause,
      resume,
      userEngaged,
    ]
  );
}
