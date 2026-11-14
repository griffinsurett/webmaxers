// src/hooks/interactions/useSideDragNavigation.ts
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

export interface SideDragNavigationOptions {
  enabled?: boolean;
  leftElRef?: MutableRefObject<HTMLElement | null> | null;
  rightElRef?: MutableRefObject<HTMLElement | null> | null;
  onLeft?: () => void;
  onRight?: () => void;
  dragThreshold?: number;
  tapThreshold?: number;
}

export const useSideDragNavigation = ({
  enabled = true,
  leftElRef,
  rightElRef,
  onLeft = () => {},
  onRight = () => {},
  dragThreshold = 40,
  tapThreshold = 12,
}: SideDragNavigationOptions = {}) => {
  const stateRef = useRef({
    active: false,
    zone: null as "left" | "right" | null,
    id: null as number | null,
    startX: 0,
    startY: 0,
    moved: false,
    slid: false,
  });

  const attach = useCallback(
    (element: HTMLElement | null, zone: "left" | "right") => {
      if (!element || typeof window === "undefined") return () => {};

      const handlePointerDown = (event: PointerEvent) => {
        if (!enabled) return;
        stateRef.current = {
          active: true,
          zone,
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          slid: false,
        };
        element.setPointerCapture?.(event.pointerId);
      };

      const handlePointerMove = (event: PointerEvent) => {
        const state = stateRef.current;
        if (!state.active || state.id !== event.pointerId || state.zone !== zone) return;

        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          state.moved = true;
        }

        if (Math.abs(dy) > Math.abs(dx)) return;
        event.preventDefault();

        if (state.slid) return;
        if (Math.abs(dx) >= dragThreshold) {
          zone === "left" ? onLeft() : onRight();
          state.slid = true;
        }
      };

      const handlePointerEnd = (event: PointerEvent) => {
        const state = stateRef.current;
        if (!state.active || state.id !== event.pointerId || state.zone !== zone) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;

        if (!state.slid && Math.hypot(dx, dy) <= tapThreshold) {
          zone === "left" ? onLeft() : onRight();
        }

        try {
          element.releasePointerCapture?.(event.pointerId);
        } catch {
          // ignore
        }

        stateRef.current = {
          active: false,
          zone: null,
          id: null,
          startX: 0,
          startY: 0,
          moved: false,
          slid: false,
        };
      };

      element.addEventListener("pointerdown", handlePointerDown);
      element.addEventListener("pointermove", handlePointerMove);
      element.addEventListener("pointerup", handlePointerEnd);
      element.addEventListener("pointercancel", handlePointerEnd);

      return () => {
        element.removeEventListener("pointerdown", handlePointerDown);
        element.removeEventListener("pointermove", handlePointerMove);
        element.removeEventListener("pointerup", handlePointerEnd);
        element.removeEventListener("pointercancel", handlePointerEnd);
      };
    },
    [dragThreshold, enabled, onLeft, onRight, tapThreshold]
  );

  useEffect(() => {
    if (!enabled) return;
    const detachLeft = attach(leftElRef?.current ?? null, "left");
    const detachRight = attach(rightElRef?.current ?? null, "right");
    return () => {
      detachLeft?.();
      detachRight?.();
    };
  }, [enabled, leftElRef, rightElRef, attach]);
};
