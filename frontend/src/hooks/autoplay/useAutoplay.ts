// src/hooks/autoplay/useAutoplay.ts
import { useCallback, useEffect, useRef } from "react";

interface UseAutoplayParams {
  totalItems: number;
  currentIndex: number;
  setIndex: (next: number) => void;
  autoplayTime?: number | (() => number);
  loop?: boolean;
  enabled?: boolean;
}

export default function useAutoplay({
  totalItems,
  currentIndex,
  setIndex,
  autoplayTime = 3000,
  loop = true,
  enabled = true,
}: UseAutoplayParams) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    if (totalItems <= 1) return;
    const next = currentIndex + 1;
    const resolved =
      next >= totalItems ? (loop ? 0 : Math.max(totalItems - 1, 0)) : next;
    setIndex(resolved);
  }, [currentIndex, loop, setIndex, totalItems]);

  const resolveDelay = useCallback(() => {
    try {
      return typeof autoplayTime === "function" ? autoplayTime() : autoplayTime;
    } catch {
      return 3000;
    }
  }, [autoplayTime]);

  const schedule = useCallback(() => {
    clearTimer();
    if (!enabled || totalItems <= 1) return;
    const delay = Math.max(0, Number(resolveDelay()) || 0);
    timerRef.current = setTimeout(advance, delay);
  }, [advance, clearTimer, enabled, resolveDelay, totalItems]);

  useEffect(() => {
    schedule();
    return clearTimer;
  }, [schedule, clearTimer]);

  return { schedule, clearTimer, advance };
}
