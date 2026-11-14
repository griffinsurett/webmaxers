// src/hooks/autoscroll/useEngagementAutoScroll.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibility } from "@/hooks/animations/useVisibility";
import { useTouchInteraction } from "@/hooks/interactions/useTouchInteraction";
import { useScrollInteraction } from "@/hooks/interactions/useScrollInteraction";
import { usePointerInteraction } from "@/hooks/interactions/usePointerInteraction";
import { useAutoScroll } from "./useAutoScroll";

interface UseEngagementAutoScrollOptions {
  ref: React.RefObject<HTMLElement | null>;
  active?: boolean;
  speed?: number | ((host: HTMLElement) => number);
  cycleDuration?: number;
  loop?: boolean;
  startDelay?: number;
  resumeDelay?: number;
  resumeOnUserInput?: boolean;
  threshold?: number;
  visibleRootMargin?: string;
  resetOnInactive?: boolean;
}

export function useEngagementAutoScroll({
  ref,
  active = false,
  speed = 40,
  cycleDuration = 0,
  loop = false,
  startDelay = 1500,
  resumeDelay = 900,
  resumeOnUserInput = true,
  threshold = 0.3,
  visibleRootMargin = "0px",
  resetOnInactive = true,
}: UseEngagementAutoScrollOptions) {
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractingRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [resumeScheduled, setResumeScheduled] = useState(false);
  const [userEngaged, setUserEngaged] = useState(false);

  const inView = useVisibility(ref, { threshold, rootMargin: visibleRootMargin });

  const autoScroll = useAutoScroll({
    ref,
    active: active && inView && !paused,
    speed,
    cycleDuration,
    loop,
    startDelay,
    resetOnInactive,
  });

  const clearResume = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setResumeScheduled(false);
  }, []);

  const pauseNow = useCallback(() => {
    setPaused(true);
    clearResume();
  }, [clearResume]);

  const scheduleResume = useCallback(() => {
    if (!resumeOnUserInput) return;
    if (userInteractingRef.current) return;

    clearResume();
    setResumeScheduled(true);
    resumeTimerRef.current = setTimeout(() => {
      if (!userInteractingRef.current) {
        setResumeScheduled(false);
        setPaused(false);
      }
    }, Math.max(0, resumeDelay));
  }, [resumeOnUserInput, resumeDelay, clearResume]);

  const emitUserEvent = useCallback(
    (phase: "start" | "end") => {
      const element = ref.current;
      if (!element) return;
      element.dispatchEvent(
        new CustomEvent("autoscroll-user", {
          bubbles: true,
          detail: { phase },
        })
      );
    },
    [ref]
  );

  const handleInteractionStart = useCallback(() => {
    userInteractingRef.current = true;
    setUserEngaged(true);
    pauseNow();
    emitUserEvent("start");
  }, [pauseNow, emitUserEvent]);

  const handleInteractionEnd = useCallback(() => {
    userInteractingRef.current = false;
    setUserEngaged(false);
    emitUserEvent("end");
    scheduleResume();
  }, [emitUserEvent, scheduleResume]);

  const handleInteractionActivity = useCallback(() => {
    userInteractingRef.current = true;
    setUserEngaged(true);
  }, []);

  useTouchInteraction({
    elementRef: ref,
    tapThreshold: 8,
    longPressDelay: 600,
    onTouchStart: handleInteractionStart,
    onTouchMove: (_event, data) => {
      if (data.moved) handleInteractionStart();
    },
    onTouchEnd: handleInteractionEnd,
    onLongPress: handleInteractionStart,
    preventDefaultOnTouch: false,
  });

  useScrollInteraction({
    elementRef: ref,
    scrollThreshold: 1,
    debounceDelay: 80,
    trustedOnly: true,
    internalFlagRef: autoScroll.internalScrollRef,
    wheelSensitivity: 1,
    onScrollStart: handleInteractionStart,
    onScrollActivity: handleInteractionActivity,
    onWheelActivity: handleInteractionStart,
    onScrollEnd: handleInteractionEnd,
  });

  usePointerInteraction({
    elementRef: ref,
    onPointerDown: handleInteractionStart,
    onPointerMove: (_event, data) => {
      if (data.moved) handleInteractionStart();
    },
    onPointerUp: handleInteractionEnd,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const SCROLL_IDLE = 160;
    const WHEEL_IDLE = 160;
    let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      if (autoScroll.internalScrollRef.current) return;
      handleInteractionStart();
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(handleInteractionEnd, SCROLL_IDLE);
    };

    const onWheel = () => {
      handleInteractionStart();
      if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(handleInteractionEnd, WHEEL_IDLE);
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", onWheel);
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
    };
  }, [autoScroll.internalScrollRef, handleInteractionEnd, handleInteractionStart, ref]);

  useEffect(() => {
    if (!resetOnInactive) return;

    if (!active || !inView) {
      userInteractingRef.current = false;
      setUserEngaged(false);
      setPaused(false);
      clearResume();
    }
  }, [active, inView, resetOnInactive, clearResume]);

  useEffect(
    () => () => {
      clearResume();
      userInteractingRef.current = false;
      setUserEngaged(false);
    },
    [clearResume]
  );

  return {
    inView,
    paused,
    resumeScheduled,
    engaged: userEngaged,
    pauseNow,
    resumeNow: () => {
      clearResume();
      setPaused(false);
    },
    startNow: autoScroll.startNow,
    stopNow: autoScroll.stopNow,
    resetPosition: autoScroll.resetPosition,
    isAnimating: autoScroll.isAnimating,
    hasStartedThisCycle: autoScroll.hasStartedThisCycle,
    getCurrentPosition: autoScroll.getCurrentPosition,
    getMetrics: autoScroll.getMetrics,
  };
}
