// src/hooks/interactions/usePointerInteraction.ts
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { resolveHost } from "./utils";

type PointerType = PointerEvent["pointerType"];

interface PointerInteractionMeta {
  pointerId: number;
  x: number;
  y: number;
  pointerType: PointerType;
  timestamp?: number;
  duration?: number;
  moved?: boolean;
  distance?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface PointerInteractionOptions {
  elementRef?: MutableRefObject<HTMLElement | null> | null;
  pointerTypes?: PointerType[];
  clickThreshold?: number;
  longPressDelay?: number;
  preventDefaultOnPointer?: boolean;
  onPointerDown?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
  onPointerUp?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
  onPointerMove?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
  onPointerCancel?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
  onPointerClick?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
  onPointerLongPress?: (event: PointerEvent, meta: PointerInteractionMeta) => void;
}

export const usePointerInteraction = ({
  elementRef,
  pointerTypes = ["mouse", "touch", "pen"],
  clickThreshold = 10,
  longPressDelay = 500,
  preventDefaultOnPointer = false,
  onPointerDown = () => {},
  onPointerUp = () => {},
  onPointerMove = () => {},
  onPointerCancel = () => {},
  onPointerClick = () => {},
  onPointerLongPress = () => {},
}: PointerInteractionOptions = {}) => {
  const pointerStateRef = useRef<Map<number, any>>(new Map());
  const longPressTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearLongPressTimer = useCallback((pointerId: number) => {
    const timer = longPressTimersRef.current.get(pointerId);
    if (timer) {
      clearTimeout(timer);
      longPressTimersRef.current.delete(pointerId);
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    longPressTimersRef.current.forEach((timer) => clearTimeout(timer));
    longPressTimersRef.current.clear();
  }, []);

  useEffect(() => {
    const host = resolveHost(elementRef);
    if (!host) return;

    const handlePointerDown = (event: Event) => {
      if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) return;
      if (!pointerTypes.includes(event.pointerType)) return;
      const pointerId = event.pointerId;
      const state = {
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now(),
        moved: false,
        pointerType: event.pointerType,
      };
      pointerStateRef.current.set(pointerId, state);

      if (preventDefaultOnPointer) event.preventDefault();

      onPointerDown(event, {
        pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        timestamp: state.startTime,
      });

      const timer = setTimeout(() => {
        const current = pointerStateRef.current.get(pointerId);
        if (current && !current.moved) {
          onPointerLongPress(event, {
            pointerId,
            x: current.startX,
            y: current.startY,
            pointerType: current.pointerType,
            duration: Date.now() - current.startTime,
          });
        }
      }, longPressDelay);

      longPressTimersRef.current.set(pointerId, timer);
    };

    const handlePointerMove = (event: Event) => {
      if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) return;
      if (!pointerTypes.includes(event.pointerType)) return;
      const pointerId = event.pointerId;
      const state = pointerStateRef.current.get(pointerId);
      if (!state) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (!state.moved && distance > clickThreshold) {
        state.moved = true;
        clearLongPressTimer(pointerId);
      }

      if (preventDefaultOnPointer) event.preventDefault();

      onPointerMove(event, {
        pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        deltaX,
        deltaY,
        distance,
        moved: state.moved,
      });
    };

    const handlePointerUp = (event: Event) => {
      if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) return;
      if (!pointerTypes.includes(event.pointerType)) return;
      const pointerId = event.pointerId;
      const state = pointerStateRef.current.get(pointerId);
      if (!state) return;

      const duration = Date.now() - state.startTime;
      clearLongPressTimer(pointerId);
      if (preventDefaultOnPointer) event.preventDefault();

      const meta = {
        pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
        duration,
        moved: state.moved,
      };

      onPointerUp(event, meta);
      if (!state.moved) {
        onPointerClick(event, meta);
      }

      pointerStateRef.current.delete(pointerId);
    };

    const handlePointerCancel = (event: Event) => {
      if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent)) return;
      if (!pointerTypes.includes(event.pointerType)) return;
      const pointerId = event.pointerId;
      clearLongPressTimer(pointerId);
      onPointerCancel(event, {
        pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      });
      pointerStateRef.current.delete(pointerId);
    };

    host.addEventListener("pointerdown", handlePointerDown, { passive: !preventDefaultOnPointer });
    host.addEventListener("pointermove", handlePointerMove, { passive: !preventDefaultOnPointer });
    host.addEventListener("pointerup", handlePointerUp, { passive: !preventDefaultOnPointer });
    host.addEventListener("pointercancel", handlePointerCancel, { passive: true });

    return () => {
      host.removeEventListener("pointerdown", handlePointerDown);
      host.removeEventListener("pointermove", handlePointerMove);
      host.removeEventListener("pointerup", handlePointerUp);
      host.removeEventListener("pointercancel", handlePointerCancel);
      clearAllTimers();
    };
  }, [
    elementRef,
    pointerTypes,
    clickThreshold,
    longPressDelay,
    preventDefaultOnPointer,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerClick,
    onPointerLongPress,
    clearLongPressTimer,
    clearAllTimers,
  ]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  return {
    getActivePointers: () => Array.from(pointerStateRef.current.keys()),
    getPointerState: (pointerId: number) => pointerStateRef.current.get(pointerId),
    clearAllTimers,
  };
};
