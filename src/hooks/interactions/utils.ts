// src/hooks/interactions/utils.ts
import type { MutableRefObject } from "react";

export type HostElement = Window | HTMLElement;

export function resolveHost(
  elementRef?: MutableRefObject<HTMLElement | null> | null
): HostElement | null {
  if (elementRef?.current) return elementRef.current;
  if (typeof window !== "undefined") return window;
  return null;
}

export function getPositionForHost(host: HostElement | null): number {
  if (!host) return 0;
  if ("scrollY" in host) return host.scrollY || 0;
  return host.scrollTop || 0;
}
