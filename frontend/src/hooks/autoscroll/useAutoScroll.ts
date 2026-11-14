// src/hooks/autoscroll/useAutoScroll.ts
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoScrollOptions {
  ref: React.RefObject<HTMLElement | null>;
  active?: boolean;
  speed?: number | ((host: HTMLElement) => number);
  cycleDuration?: number;
  loop?: boolean;
  startDelay?: number;
  resetOnInactive?: boolean;
}

export function useAutoScroll({
  ref,
  active = false,
  speed = 40,
  cycleDuration = 0,
  loop = false,
  startDelay = 1500,
  resetOnInactive = true,
}: UseAutoScrollOptions) {
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatTopRef = useRef(0);
  const startedThisCycleRef = useRef(false);

  const internalScrollRef = useRef(false);
  const internalUnsetRafRef = useRef<number | null>(null);
  const [contentVersion, setContentVersion] = useState(0);

  const resolvePxPerSecond = useCallback(
    (host: HTMLElement) => {
      if (cycleDuration && cycleDuration > 0) {
        const max = Math.max(0, host.scrollHeight - host.clientHeight);
        return max > 0 ? max / cycleDuration : 0;
      }
      return typeof speed === "function"
        ? Math.max(1, speed(host))
        : Number(speed) || 0;
    },
    [cycleDuration, speed]
  );

  const clearRAF = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = 0;
  }, []);

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    internalScrollRef.current = true;
    if (internalUnsetRafRef.current) {
      cancelAnimationFrame(internalUnsetRafRef.current);
      internalUnsetRafRef.current = null;
    }
    internalUnsetRafRef.current = requestAnimationFrame(() => {
      internalScrollRef.current = false;
      internalUnsetRafRef.current = null;
    });
  }, []);

  const step = useCallback(
    (ts: number) => {
      if (!active) return;
      const host = ref.current;
      if (!host) return;

      const last = lastTsRef.current || ts;
      const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
      lastTsRef.current = ts;

      const max = Math.max(0, host.scrollHeight - host.clientHeight);
      if (max <= 0) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (floatTopRef.current === 0 && host.scrollTop > 0) {
        floatTopRef.current = host.scrollTop;
      }

      const pxPerSecond = resolvePxPerSecond(host);
      const delta = pxPerSecond * dt;
      floatTopRef.current = Math.min(max, floatTopRef.current + delta);

      markProgrammaticScroll();
      host.scrollTo({ top: floatTopRef.current, left: 0, behavior: "auto" });

      if (floatTopRef.current >= max - 0.5) {
        if (loop) {
          floatTopRef.current = 0;
          host.scrollTo({ top: 0, left: 0, behavior: "auto" });
        } else {
          clearRAF();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    },
    [active, clearRAF, loop, markProgrammaticScroll, ref, resolvePxPerSecond]
  );

  const startNow = useCallback(() => {
    clearRAF();
    const host = ref.current;
    if (host) {
      floatTopRef.current = host.scrollTop || 0;
      startedThisCycleRef.current = true;
      rafRef.current = requestAnimationFrame(step);
    }
  }, [clearRAF, ref, step]);

  const stopNow = useCallback(() => {
    clearRAF();
  }, [clearRAF]);

  const resetPosition = useCallback(
    (toTop: number = 0) => {
      const host = ref.current;
      if (!host) return;
      floatTopRef.current = toTop;
      host.scrollTo({ top: toTop, left: 0, behavior: "auto" });
    },
    [ref]
  );

  useEffect(() => {
    clearRAF();
    clearStartTimer();
    if (active) {
      if (!startedThisCycleRef.current) {
        startTimerRef.current = setTimeout(() => {
          if (active) startNow();
        }, Math.max(0, startDelay));
      } else {
        startNow();
      }
    }
    return () => {
      clearRAF();
      clearStartTimer();
    };
  }, [active, startDelay, startNow, clearRAF, clearStartTimer, contentVersion]);

  useEffect(() => {
    if (!resetOnInactive) return;
    if (!active) {
      startedThisCycleRef.current = false;
      clearRAF();
      clearStartTimer();
      internalScrollRef.current = false;
      floatTopRef.current = 0;
      const host = ref.current;
      host?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [active, clearRAF, clearStartTimer, ref, resetOnInactive]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let lastMax = Math.max(0, element.scrollHeight - element.clientHeight);
    const observer = new ResizeObserver(() => {
      const max = Math.max(0, element.scrollHeight - element.clientHeight);
      if (max > lastMax + 1) {
        lastMax = max;
        setContentVersion((v) => v + 1);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(
    () => () => {
      clearRAF();
      clearStartTimer();
      if (internalUnsetRafRef.current) {
        cancelAnimationFrame(internalUnsetRafRef.current);
        internalUnsetRafRef.current = null;
      }
      internalScrollRef.current = false;
    },
    [clearRAF, clearStartTimer]
  );

  return {
    startNow,
    stopNow,
    resetPosition,
    isAnimating: () => !!rafRef.current,
    hasStartedThisCycle: () => startedThisCycleRef.current,
    getCurrentPosition: () => floatTopRef.current,
    internalScrollRef,
    getMetrics: () => {
      const host = ref.current;
      const max = host ? Math.max(0, host.scrollHeight - host.clientHeight) : 0;
      const top = host ? host.scrollTop : 0;
      const progress = max > 0 ? top / max : 0;
      return {
        top,
        max,
        progress,
        animating: !!rafRef.current,
        started: startedThisCycleRef.current,
        internalGuard: internalScrollRef.current,
      };
    },
  };
}
