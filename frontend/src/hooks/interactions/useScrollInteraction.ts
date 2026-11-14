// src/hooks/interactions/useScrollInteraction.ts
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { resolveHost, getPositionForHost, type HostElement } from "./utils";

export type ScrollDirection = "up" | "down";
export type ScrollSource = "scroll" | "wheel";

interface ScrollInteractionPayload {
  dir: ScrollDirection;
  delta: number;
  pos: number;
  source: ScrollSource;
}

export interface ScrollInteractionOptions {
  elementRef?: RefObject<HTMLElement | null> | null;
  scrollThreshold?: number;
  debounceDelay?: number;
  trustedOnly?: boolean;
  internalFlagRef?: RefObject<boolean | null> | null;
  wheelSensitivity?: number;
  onScrollActivity?: (payload: ScrollInteractionPayload) => void;
  onScrollUp?: (payload: ScrollInteractionPayload) => void;
  onScrollDown?: (payload: ScrollInteractionPayload) => void;
  onScrollStart?: (payload: { pos: number; dir: ScrollDirection; source: ScrollSource }) => void;
  onScrollEnd?: (payload: { pos: number; dir: ScrollDirection }) => void;
  onDirectionChange?: (payload: { from: ScrollDirection | "none"; to: ScrollDirection; pos: number; source: ScrollSource }) => void;
  onWheelActivity?: (payload: { deltaY: number; deltaX: number; deltaZ: number; deltaMode: number; event: WheelEvent }) => void;
}

export const useScrollInteraction = ({
  elementRef,
  scrollThreshold = 10,
  debounceDelay = 150,
  trustedOnly = true,
  internalFlagRef,
  wheelSensitivity = 1,
  onScrollActivity,
  onScrollUp,
  onScrollDown,
  onScrollStart,
  onScrollEnd,
  onDirectionChange,
  onWheelActivity,
}: ScrollInteractionOptions = {}) => {
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPosRef = useRef(0);
  const lastDirRef = useRef<ScrollDirection | "none">("none");
  const scrollingRef = useRef(false);
  const hostRef = useRef<HostElement | null>(null);

  const clearEndTimer = useCallback(() => {
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
  }, []);

  const scheduleEnd = useCallback(() => {
    clearEndTimer();
    endTimeoutRef.current = setTimeout(() => {
      if (scrollingRef.current) {
        scrollingRef.current = false;
        const host = hostRef.current;
        const dir = lastDirRef.current;
        onScrollEnd?.({
          pos: getPositionForHost(host),
          dir: dir === "none" ? "down" : dir,
        });
      }
    }, debounceDelay);
  }, [clearEndTimer, debounceDelay, onScrollEnd]);

  const emitActivity = useCallback(
    (deltaRaw: number, source: ScrollSource) => {
      if (Math.abs(deltaRaw) < scrollThreshold) return;

      const host = hostRef.current;
      const pos = getPositionForHost(host);
      const dir: ScrollDirection = deltaRaw > 0 ? "down" : "up";

      if (!scrollingRef.current) {
        scrollingRef.current = true;
        onScrollStart?.({ pos, dir, source });
      }

      if (dir !== lastDirRef.current && lastDirRef.current !== "none") {
        onDirectionChange?.({ from: lastDirRef.current, to: dir, pos, source });
      }

      lastDirRef.current = dir;

      const payload: ScrollInteractionPayload = {
        dir,
        delta: Math.abs(deltaRaw),
        pos,
        source,
      };

      onScrollActivity?.(payload);
      if (dir === "down") {
        onScrollDown?.(payload);
      } else {
        onScrollUp?.(payload);
      }

      scheduleEnd();
    },
    [onScrollActivity, onScrollDown, onScrollStart, onScrollUp, onDirectionChange, scheduleEnd, scrollThreshold]
  );

  useEffect(() => {
    const host = resolveHost(elementRef);
    hostRef.current = host;
    lastPosRef.current = getPositionForHost(host);
  }, [elementRef]);

  useEffect(() => {
    const host = hostRef.current || resolveHost(elementRef);
    if (!host) return;

    const handleWheel = (event: WheelEvent) => {
      if (trustedOnly && !event.isTrusted) return;
      if (internalFlagRef?.current) return;

      const deltaY = (event.deltaY || 0) * wheelSensitivity;
      if (deltaY === 0) return;

      onWheelActivity?.({
        deltaY,
        deltaX: event.deltaX || 0,
        deltaZ: event.deltaZ || 0,
        deltaMode: event.deltaMode,
        event,
      });

      emitActivity(deltaY, "wheel");
    };

    (host as Window | HTMLElement).addEventListener("wheel", handleWheel as EventListener, { passive: true });
    return () => (host as Window | HTMLElement).removeEventListener("wheel", handleWheel as EventListener);
  }, [elementRef, emitActivity, internalFlagRef, onWheelActivity, trustedOnly, wheelSensitivity]);

  useEffect(() => {
    const host = hostRef.current || resolveHost(elementRef);
    if (!host) return;

    const handleScroll = () => {
      if (internalFlagRef?.current) return;
      const currentPos = getPositionForHost(host);
      const delta = currentPos - lastPosRef.current;
      lastPosRef.current = currentPos;
      if (delta !== 0) {
        emitActivity(delta, "scroll");
      }
    };

    (host as Window | HTMLElement).addEventListener("scroll", handleScroll, { passive: true });
    return () => (host as Window | HTMLElement).removeEventListener("scroll", handleScroll);
  }, [elementRef, emitActivity, internalFlagRef]);

  useEffect(() => () => clearEndTimer(), [clearEndTimer]);

  return {
    getCurrentPos: () => getPositionForHost(hostRef.current),
    getLastPos: () => lastPosRef.current,
    getLastDir: () => lastDirRef.current,
    isScrolling: () => scrollingRef.current,
  };
};
