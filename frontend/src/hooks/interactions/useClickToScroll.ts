import { useEffect, useRef, useCallback, useState, type RefObject } from "react";

const MANUAL_SCROLL_TIMEOUT_MS = 3000; // Disable manual scroll after 3 seconds of inactivity

interface UseClickToScrollOptions {
  /** Ref to the scrollable element */
  ref: RefObject<HTMLElement | null>;
  /** Whether the element is currently active/visible */
  active?: boolean;
  /** Timeout in ms before disabling manual scroll after inactivity (default: 3000) */
  inactivityTimeout?: number;
}

interface UseClickToScrollReturn {
  /** Whether manual scrolling is currently enabled */
  enabled: boolean;
  /** Call this when user clicks to enable scrolling */
  enableScroll: () => void;
}

/**
 * Hook that prevents an element from capturing scroll events until clicked.
 *
 * Behavior:
 * - Manual scroll starts DISABLED (user cannot scroll the element)
 * - User CLICKS on the element -> manual scroll ENABLED
 * - User scrolls -> inactivity timer resets
 * - User stops scrolling for 3 seconds -> manual scroll DISABLED
 * - Element becomes inactive -> manual scroll DISABLED
 *
 * This prevents the scrollable element from interfering with page scroll
 * until the user explicitly clicks on it to interact.
 */
export function useClickToScroll({
  ref,
  active = true,
  inactivityTimeout = MANUAL_SCROLL_TIMEOUT_MS,
}: UseClickToScrollOptions): UseClickToScrollReturn {
  const [enabled, setEnabled] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      setEnabled(false);
    }, inactivityTimeout);
  }, [clearInactivityTimer, inactivityTimeout]);

  // Only enable on explicit click
  const enableScroll = useCallback(() => {
    if (!active) return;
    setEnabled(true);
    startInactivityTimer();
  }, [active, startInactivityTimer]);

  // Reset when element becomes inactive
  useEffect(() => {
    if (!active) {
      setEnabled(false);
      clearInactivityTimer();
    }
  }, [active, clearInactivityTimer]);

  // Track scroll activity to reset inactivity timer
  useEffect(() => {
    if (!enabled || !active) return;

    const el = ref.current;
    if (!el) return;

    const handleScrollActivity = () => {
      // Reset the inactivity timer on any scroll activity
      startInactivityTimer();
    };

    el.addEventListener("scroll", handleScrollActivity, { passive: true });
    el.addEventListener("touchmove", handleScrollActivity, { passive: true });
    el.addEventListener("wheel", handleScrollActivity, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScrollActivity);
      el.removeEventListener("touchmove", handleScrollActivity);
      el.removeEventListener("wheel", handleScrollActivity);
    };
  }, [ref, enabled, active, startInactivityTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, [clearInactivityTimer]);

  return { enabled, enableScroll };
}

export default useClickToScroll;
