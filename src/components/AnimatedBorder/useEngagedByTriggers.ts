// src/components/AnimatedBorder/useEngagedByTriggers.ts
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useVisibility } from "@/hooks/animations/useVisibility";
import {
  useHoverInteraction,
  type HoverIntentOptions,
} from "@/hooks/interactions/useHoverInteraction";

export type { HoverIntentOptions } from "@/hooks/interactions/useHoverInteraction";

export type TriggerToken = "hover" | "visible" | "always" | "controlled" | string;
export type TriggerInput = TriggerToken | TriggerToken[];

export type VisibleRootMarginConfig =
  | number
  | string
  | {
      top?: number | string;
      right?: number | string;
      bottom?: number | string;
      left?: number | string;
    };

interface EngagementOptions {
  ref: MutableRefObject<HTMLElement | null>;
  triggers?: TriggerInput;
  active?: boolean;
  hoverDelay?: number;
  unhoverIntent?: HoverIntentOptions;
  visibleRootMargin?: VisibleRootMarginConfig;
  visibilityOptions?: IntersectionObserverInit;
}

const normalizePx = (value?: number | string): string => {
  if (typeof value === "number") return `${value}px`;
  return value ?? "0px";
};

export const useEngagedByTriggers = ({
  ref,
  triggers = "hover",
  active = false,
  hoverDelay = 0,
  unhoverIntent,
  visibleRootMargin = 120,
  visibilityOptions = { threshold: 0.25 },
}: EngagementOptions) => {
  const list = useMemo(
    () => (Array.isArray(triggers) ? triggers : [triggers ?? "hover"]),
    [triggers]
  );
  const normalized = useMemo(
    () => list.map((token) => String(token || "").toLowerCase()),
    [list]
  );

  const wantsHover = normalized.includes("hover");
  const wantsVisible = normalized.includes("visible");
  const isAlways = normalized.includes("always");
  const isControlledTrigger = normalized.includes("controlled");

  const [hovered, setHovered] = useState(false);
  const { handleMouseEnter, handleMouseLeave } = useHoverInteraction({
    hoverDelay,
    unhoverIntent,
    onHoverStart: () => setHovered(true),
    onHoverEnd: () => setHovered(false),
  });

  const normalizedRootMargin = useMemo(() => {
    if (typeof visibleRootMargin === "number") {
      const n = Math.max(0, visibleRootMargin | 0);
      return `-${n}px 0px -${n}px 0px`;
    }

    if (visibleRootMargin && typeof visibleRootMargin === "object") {
      const top = normalizePx(visibleRootMargin.top);
      const right = normalizePx(visibleRootMargin.right);
      const bottom = normalizePx(visibleRootMargin.bottom);
      const left = normalizePx(visibleRootMargin.left);
      return `${top} ${right} ${bottom} ${left}`;
    }

    return (visibleRootMargin as string) || "0px";
  }, [visibleRootMargin]);

  const ioOptions = useMemo(
    () => ({
      ...visibilityOptions,
      threshold: visibilityOptions?.threshold ?? 0.25,
      rootMargin:
        normalizedRootMargin ??
        (visibilityOptions ? visibilityOptions.rootMargin : undefined),
    }),
    [normalizedRootMargin, visibilityOptions]
  );

  const inView = useVisibility(ref, ioOptions);

  const engaged = Boolean(
    isAlways ||
      (wantsHover && hovered) ||
      (isControlledTrigger && !!active) ||
      (wantsVisible && inView)
  );

  const prevRef = useRef(engaged);
  const justEngaged = engaged && !prevRef.current;
  const justDisengaged = !engaged && prevRef.current;

  useEffect(() => {
    prevRef.current = engaged;
  }, [engaged]);

  const onEnter = useCallback(
    (event?: { currentTarget?: EventTarget | null }) => {
      if (!wantsHover) return;
      const element = (event?.currentTarget as HTMLElement | null) ?? null;
      handleMouseEnter(element);
    },
    [handleMouseEnter, wantsHover]
  );

  const onLeave = useCallback(
    (event?: { currentTarget?: EventTarget | null }) => {
      if (!wantsHover) return;
      const element = (event?.currentTarget as HTMLElement | null) ?? null;
      handleMouseLeave(element);
    },
    [handleMouseLeave, wantsHover]
  );

  return {
    engaged,
    inView,
    hovered,
    wantsHover,
    wantsVisible,
    isAlways,
    isControlledTrigger,
    justEngaged,
    justDisengaged,
    onEnter,
    onLeave,
  };
};
