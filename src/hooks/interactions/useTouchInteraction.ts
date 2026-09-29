// src/hooks/interactions/useTouchInteraction.ts
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { resolveHost } from "./utils";

interface TouchInteractionMeta {
  x: number;
  y: number;
  timestamp?: number;
  duration?: number;
  moved?: boolean;
  longPressTriggered?: boolean;
  deltaX?: number;
  deltaY?: number;
  distance?: number;
}

export interface TouchInteractionOptions {
  elementRef?: MutableRefObject<HTMLElement | null> | null;
  tapThreshold?: number;
  longPressDelay?: number;
  swipeThreshold?: number;
  preventDefaultOnTouch?: boolean;
  onTouchStart?: (event: TouchEvent, meta: TouchInteractionMeta) => void;
  onTouchEnd?: (event: TouchEvent, meta: TouchInteractionMeta) => void;
  onTouchMove?: (event: TouchEvent, meta: TouchInteractionMeta) => void;
  onTap?: (event: TouchEvent, meta: TouchInteractionMeta) => void;
  onLongPress?: (event: TouchEvent, meta: TouchInteractionMeta) => void;
  onSwipe?: (
    event: TouchEvent,
    meta: TouchInteractionMeta & { direction: "left" | "right" | "up" | "down" | null }
  ) => void;
}

export const useTouchInteraction = ({
  elementRef,
  tapThreshold = 10,
  longPressDelay = 500,
  swipeThreshold = 50,
  preventDefaultOnTouch = false,
  onTouchStart = () => {},
  onTouchEnd = () => {},
  onTouchMove = () => {},
  onTap = () => {},
  onLongPress = () => {},
  onSwipe = () => {},
}: TouchInteractionOptions = {}) => {
  const stateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    moved: false,
    longPressTriggered: false,
  });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stateRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      moved: false,
      longPressTriggered: false,
    };
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const getSwipeData = useCallback((endX: number, endY: number) => {
    const deltaX = endX - stateRef.current.startX;
    const deltaY = endY - stateRef.current.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const duration = Date.now() - stateRef.current.startTime;
    let direction: "left" | "right" | "up" | "down" | null = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? "right" : "left";
    } else {
      direction = deltaY > 0 ? "down" : "up";
    }
    return { deltaX, deltaY, distance, duration, direction };
  }, []);

  useEffect(() => {
    const host = resolveHost(elementRef);
    if (!host) return;

    const handleTouchStart = (event: Event) => {
      if (typeof TouchEvent === "undefined" || !(event instanceof TouchEvent)) return;
      const touch = event.touches[0];
      if (!touch) return;

      stateRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        moved: false,
        longPressTriggered: false,
      };

      if (preventDefaultOnTouch) event.preventDefault();

      onTouchStart(event, {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: stateRef.current.startTime,
      });

      longPressTimerRef.current = setTimeout(() => {
        if (stateRef.current.active && !stateRef.current.moved) {
          stateRef.current.longPressTriggered = true;
          onLongPress(event, {
            x: stateRef.current.startX,
            y: stateRef.current.startY,
            duration: Date.now() - stateRef.current.startTime,
          });
        }
      }, longPressDelay);
    };

    const handleTouchMove = (event: Event) => {
      if (typeof TouchEvent === "undefined" || !(event instanceof TouchEvent)) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (!stateRef.current.active) return;

      const deltaX = touch.clientX - stateRef.current.startX;
      const deltaY = touch.clientY - stateRef.current.startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (!stateRef.current.moved && distance > tapThreshold) {
        stateRef.current.moved = true;
        clearLongPressTimer();
      }

      if (preventDefaultOnTouch) event.preventDefault();

      onTouchMove(event, {
        x: touch.clientX,
        y: touch.clientY,
        deltaX,
        deltaY,
        distance,
        moved: stateRef.current.moved,
      });
    };

    const handleTouchEnd = (event: Event) => {
      if (typeof TouchEvent === "undefined" || !(event instanceof TouchEvent)) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      if (preventDefaultOnTouch) event.preventDefault();

      const duration = Date.now() - stateRef.current.startTime;

      const meta: TouchInteractionMeta = {
        x: touch.clientX,
        y: touch.clientY,
        duration,
        moved: stateRef.current.moved,
        longPressTriggered: stateRef.current.longPressTriggered,
      };

      onTouchEnd(event, meta);

      if (!stateRef.current.moved && !stateRef.current.longPressTriggered) {
        onTap(event, meta);
      }

      if (stateRef.current.moved) {
        const swipeData = getSwipeData(touch.clientX, touch.clientY);
        if (swipeData.distance >= swipeThreshold) {
          onSwipe(event, { ...meta, ...swipeData });
        }
      }

      resetState();
    };

    const handleTouchCancel = (event: Event) => {
      if (typeof TouchEvent === "undefined" || !(event instanceof TouchEvent)) return;
      onTouchEnd(event, {
        x: stateRef.current.startX,
        y: stateRef.current.startY,
        duration: Date.now() - stateRef.current.startTime,
        moved: stateRef.current.moved,
        longPressTriggered: stateRef.current.longPressTriggered,
      });
      resetState();
    };

    host.addEventListener("touchstart", handleTouchStart, { passive: !preventDefaultOnTouch });
    host.addEventListener("touchmove", handleTouchMove, { passive: !preventDefaultOnTouch });
    host.addEventListener("touchend", handleTouchEnd, { passive: !preventDefaultOnTouch });
    host.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      host.removeEventListener("touchstart", handleTouchStart);
      host.removeEventListener("touchmove", handleTouchMove);
      host.removeEventListener("touchend", handleTouchEnd);
      host.removeEventListener("touchcancel", handleTouchCancel);
      clearLongPressTimer();
    };
  }, [
    elementRef,
    tapThreshold,
    longPressDelay,
    swipeThreshold,
    preventDefaultOnTouch,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onTap,
    onLongPress,
    onSwipe,
    getSwipeData,
    resetState,
    clearLongPressTimer,
  ]);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  return {
    isTouchActive: () => stateRef.current.active,
    getTouchState: () => ({ ...stateRef.current }),
    resetTouchState: resetState,
  };
};
