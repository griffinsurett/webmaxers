// src/hooks/interactions/useHoverInteraction.ts
import { useCallback, useEffect, useRef } from "react";

export interface HoverIntentOptions {
  enabled?: boolean;
  leaveDelay?: number;
  reentryGraceMs?: number;
  minOutDistance?: number;
  boundaryPadding?: number;
  onUnhoverCommit?: (
    element: Element | null,
    index: number | null,
    payload: { timeAway: number; distance: number }
  ) => void;
  onUnhoverCancel?: (
    element: Element | null,
    index: number | null,
    payload: { reason: string }
  ) => void;
}

export interface HoverInteractionOptions {
  onHoverStart?: (element: Element | null, index: number | null) => void;
  onHoverEnd?: (element: Element | null, index: number | null) => void;
  hoverDelay?: number;
  unhoverIntent?: HoverIntentOptions;
}

export const useHoverInteraction = ({
  onHoverStart = () => {},
  onHoverEnd = () => {},
  hoverDelay = 0,
  unhoverIntent,
}: HoverInteractionOptions = {}) => {
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentEnabled = !!unhoverIntent?.enabled;
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveCleanupRef = useRef<(() => void) | null>(null);
  const intentStateRef = useRef({
    active: false,
    elem: null as Element | null,
    index: null as number | null,
    leftAt: 0,
    rect: null as Pick<DOMRect, "left" | "top" | "right" | "bottom"> | null,
    minDist: 0,
    reentryGraceMs: 0,
    lastPos: { x: NaN, y: NaN },
    lastDistance: Infinity,
  });

  const clearHoverTimer = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const stopIntentTracking = useCallback(() => {
    if (moveCleanupRef.current) {
      moveCleanupRef.current();
      moveCleanupRef.current = null;
    }
    if (intentTimerRef.current) {
      clearTimeout(intentTimerRef.current);
      intentTimerRef.current = null;
    }
  }, []);

  const cancelIntent = useCallback(
    (reason: string) => {
      if (!intentEnabled) return;
      const state = intentStateRef.current;
      if (!state.active) return;
      stopIntentTracking();
      state.active = false;
      unhoverIntent?.onUnhoverCancel?.(state.elem, state.index, { reason });
    },
    [intentEnabled, stopIntentTracking, unhoverIntent]
  );

  const commitIntent = useCallback(() => {
    if (!intentEnabled) return;
    const state = intentStateRef.current;
    if (!state.active) return;

    const payload = {
      timeAway: Date.now() - state.leftAt,
      distance: state.lastDistance,
    };

    stopIntentTracking();
    state.active = false;
    unhoverIntent?.onUnhoverCommit?.(state.elem, state.index, payload);
  }, [intentEnabled, stopIntentTracking, unhoverIntent]);

  const padRect = (rect: DOMRect, padding: number) => ({
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  });

  const distanceFromRect = (
    x: number,
    y: number,
    rect: { left: number; top: number; right: number; bottom: number }
  ) => {
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return Math.hypot(dx, dy);
  };

  const startIntent = useCallback(
    (element: Element | null, index: number | null) => {
      if (!intentEnabled || typeof window === "undefined") return;

      cancelIntent("restart");

      const {
        leaveDelay: leaveDelayProp = 120,
        reentryGraceMs: reentryGraceMsProp = 250,
        minOutDistance: minOutDistanceProp = 8,
        boundaryPadding: boundaryPaddingProp = 6,
      } = unhoverIntent ?? {};

      const leaveDelay = Number(leaveDelayProp);
      const reentryGraceMs = Number(reentryGraceMsProp);
      const minOutDistance = Number(minOutDistanceProp);
      const boundaryPadding = Number(boundaryPaddingProp);

      const rectRaw = element?.getBoundingClientRect?.();
      const rect = rectRaw ? padRect(rectRaw, boundaryPadding) : null;

      const state = intentStateRef.current;
      state.active = true;
      state.elem = element ?? null;
      state.index = index ?? null;
      state.leftAt = Date.now();
      state.rect = rect;
      state.minDist = minOutDistance;
      state.reentryGraceMs = reentryGraceMs;
      state.lastDistance = Infinity;

      const onMove = (event: PointerEvent) => {
        if (!state.active) return;
        const x = event.clientX;
        const y = event.clientY;
        state.lastPos = { x, y };

        if (state.rect) {
          const dist = distanceFromRect(x, y, state.rect);
          state.lastDistance = dist;
          if (dist === 0 && Date.now() - state.leftAt <= state.reentryGraceMs) {
            cancelIntent("reenter-geom");
          }
        }
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      moveCleanupRef.current = () =>
        window.removeEventListener("pointermove", onMove);

      const check = () => {
        if (!state.active) return;
        const elapsed = Date.now() - state.leftAt;
        const distance = state.lastDistance;

        if (elapsed >= leaveDelay && distance >= state.minDist) {
          commitIntent();
        } else {
          intentTimerRef.current = setTimeout(
            check,
            Math.max(30, leaveDelay / 3)
          );
        }
      };

      intentTimerRef.current = setTimeout(check, leaveDelay);
    },
    [cancelIntent, commitIntent, intentEnabled, unhoverIntent]
  );

  const handleMouseEnter = useCallback(
    (element: Element | null, index: number | null = null) => {
      clearHoverTimer();
      cancelIntent("enter");
      if (hoverDelay > 0) {
        hoverTimeoutRef.current = setTimeout(
          () => onHoverStart(element, index),
          hoverDelay
        );
      } else {
        onHoverStart(element, index);
      }
    },
    [cancelIntent, clearHoverTimer, hoverDelay, onHoverStart]
  );

  const handleMouseLeave = useCallback(
    (element: Element | null, index: number | null = null) => {
      clearHoverTimer();
      if (hoverDelay > 0) {
        hoverTimeoutRef.current = setTimeout(
          () => onHoverEnd(element, index),
          hoverDelay
        );
      } else {
        onHoverEnd(element, index);
      }
      startIntent(element, index);
    },
    [clearHoverTimer, hoverDelay, onHoverEnd, startIntent]
  );

  useEffect(
    () => () => {
      clearHoverTimer();
      stopIntentTracking();
      intentStateRef.current.active = false;
    },
    [clearHoverTimer, stopIntentTracking]
  );

  return {
    handleMouseEnter,
    handleMouseLeave,
    cancelUnhoverIntent: () => cancelIntent("manual"),
  };
};
