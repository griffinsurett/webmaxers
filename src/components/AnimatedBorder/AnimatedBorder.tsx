// src/components/AnimatedBorder/AnimatedBorder.tsx
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  useEngagedByTriggers,
  type HoverIntentOptions,
  type TriggerInput,
} from "./useEngagedByTriggers";
import { useMotionPreference } from "../../hooks/useMotionPreference";

export type AnimatedBorderVariant =
  | "none"
  | "solid"
  | "progress"
  | "progress-infinite"
  | "progress-b-f";

export type VisibleRootMargin =
  | number
  | string
  | {
      top?: number | string;
      right?: number | string;
      bottom?: number | string;
      left?: number | string;
    };

export interface AnimatedBorderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  variant?: AnimatedBorderVariant;
  triggers?: TriggerInput;
  active?: boolean;
  controller?: number;
  duration?: number;
  fadeOutMs?: number;
  color?: string;
  borderRadius?: string;
  borderWidth?: number | string;
  innerClassName?: string;
  hoverDelay?: number;
  unhoverIntent?: HoverIntentOptions;
  visibleRootMargin?: VisibleRootMargin;
  visibilityOptions?: IntersectionObserverInit;
  linkProps?: AnchorHTMLAttributes<HTMLAnchorElement>;
}

const clampPercent = (value: number | string | undefined | null): number => {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? parseFloat(value)
      : NaN;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
};

export default function AnimatedBorder({
  children,
  variant = "none",
  triggers = "hover",
  active = false,
  controller,
  duration = 2000,
  fadeOutMs = 220,
  color = "var(--color-accent)",
  borderRadius = "rounded-3xl",
  borderWidth = 2,
  className = "",
  innerClassName = "",
  hoverDelay = 0,
  unhoverIntent,
  visibleRootMargin = 75,
  visibilityOptions = { threshold: 0.25 },
  onMouseEnter,
  onMouseLeave,
  linkProps,
  ...rest
}: AnimatedBorderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useMotionPreference();

  // Determine if this is a load-time animation (visible/always) vs interactive (hover, etc.)
  const isLoadTimeAnimation = useMemo(() => {
    const list = Array.isArray(triggers) ? triggers : [triggers];
    const triggerStrings = list.map((t) => String(t || "").toLowerCase());
    return triggerStrings.includes("visible") || triggerStrings.includes("always");
  }, [triggers]);

  // If reduced motion is preferred:
  // - Load-time animations (visible/always): show "solid" (finished state)
  // - Interactive animations (hover, etc.): show "none" (no border)
  const effectiveVariant = useMemo(() => {
    if (!prefersReducedMotion || variant === "none" || variant === "solid") {
      return variant;
    }
    return isLoadTimeAnimation ? "solid" : "none";
  }, [prefersReducedMotion, variant, isLoadTimeAnimation]);

  const { engaged, onEnter, onLeave, isAlways } = useEngagedByTriggers({
    ref: hostRef,
    triggers,
    active,
    hoverDelay,
    unhoverIntent,
    visibleRootMargin,
    visibilityOptions,
  });

  const forceAlways = useMemo(() => {
    const list = Array.isArray(triggers) ? triggers : [triggers];
    return list
      .map((trigger) => String(trigger || "").toLowerCase())
      .includes("always");
  }, [triggers]);

  const engagedFinal = engaged || isAlways || forceAlways;

  const controllerValue = useMemo(() => {
    if (controller == null) return null;
    return clampPercent(controller);
  }, [controller]);

  const controllerProvided = Number.isFinite(controllerValue ?? NaN);

  const latestPercentRef = useRef(controllerProvided ? controllerValue || 0 : 0);
  const [fadingOut, setFadingOut] = useState(false);
  const [freezeAt, setFreezeAt] = useState<number | null>(null);
  const prevEngagedRef = useRef(engagedFinal);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (effectiveVariant !== "progress") {
      prevEngagedRef.current = engagedFinal;
      return;
    }

    const prev = prevEngagedRef.current;
    prevEngagedRef.current = engagedFinal;

    if (engagedFinal && !prev) {
      setFadingOut(false);
      setFreezeAt(null);
      return;
    }

    if (!engagedFinal && prev) {
      setFreezeAt(latestPercentRef.current);
      setFadingOut(true);
      const timeout = window.setTimeout(() => {
        setFadingOut(false);
        setFreezeAt(null);
        latestPercentRef.current = 0;
      }, fadeOutMs);
      return () => window.clearTimeout(timeout);
    }
  }, [effectiveVariant, engagedFinal, fadeOutMs]);

  useEffect(() => {
    if (effectiveVariant !== "progress") return;
    if (controllerProvided) {
      if (engagedFinal) {
        latestPercentRef.current = controllerValue ?? 0;
      }
      return;
    }
    if (engagedFinal) {
      latestPercentRef.current = 100;
    }
  }, [effectiveVariant, engagedFinal, controllerProvided, controllerValue]);

  const resolvedPercent = useMemo(() => {
    if (effectiveVariant === "progress") {
      if (controllerProvided) {
        return controllerValue ?? 0;
      }
      return engagedFinal && mounted ? 100 : 0;
    }
    if (effectiveVariant === "progress-b-f") {
      return engagedFinal ? 100 : 0;
    }
    return 0;
  }, [effectiveVariant, controllerProvided, controllerValue, engagedFinal, mounted]);

  const displayPercent =
    effectiveVariant === "progress" && !engagedFinal && freezeAt != null
      ? freezeAt
      : resolvedPercent;

  const borderWidthValue =
    typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;

  const resolvedDuration =
    controllerProvided && effectiveVariant === "progress" ? 0 : duration;

  const overlayStyle: Record<string, string | number> = {
    "--ab-color": color,
    "--ab-border-width": borderWidthValue,
    "--ab-duration": `${resolvedDuration}ms`,
    "--ab-fade-duration": `${fadeOutMs}ms`,
  };

  if (effectiveVariant === "progress" || effectiveVariant === "progress-b-f") {
    overlayStyle["--ab-progress"] = `${(displayPercent || 0) * 3.6}deg`;
  }

  if (effectiveVariant === "progress") {
    overlayStyle.opacity = engagedFinal || fadingOut ? 1 : 0;
  } else if (effectiveVariant === "solid") {
    // When reduced motion is preferred, always show the border (finished state)
    if (prefersReducedMotion) {
      overlayStyle.opacity = 1;
      overlayStyle.padding = borderWidthValue;
    } else {
      overlayStyle.opacity = engagedFinal ? 1 : 0;
      overlayStyle.padding = engagedFinal ? borderWidthValue : "0px";
    }
  } else if (effectiveVariant === "progress-infinite") {
    overlayStyle.opacity = engagedFinal ? 1 : 0;
    overlayStyle.animationPlayState = engagedFinal ? "running" : "paused";
  }

  const overlayClassNames = [
    "absolute",
    "inset-0",
    borderRadius,
    "pointer-events-none",
    "z-20",
    "animated-border-overlay",
  ];

  if (effectiveVariant === "solid") {
    overlayClassNames.push("is-solid");
    // Only add transitions when motion is allowed
    if (!prefersReducedMotion) {
      overlayClassNames.push("transition-all", "duration-800", "ease-in-out");
    }
  } else if (effectiveVariant === "progress") {
    overlayClassNames.push("progress");
  } else if (effectiveVariant === "progress-b-f") {
    overlayClassNames.push("progress-b-f");
  } else if (effectiveVariant === "progress-infinite") {
    overlayClassNames.push("progress-infinite");
  }

  const mountOverlay = effectiveVariant !== "none";

  const handleEnter = (event: MouseEvent<HTMLDivElement>) => {
    onMouseEnter?.(event);
    onEnter(event);
  };

  const handleLeave = (event: MouseEvent<HTMLDivElement>) => {
    onMouseLeave?.(event);
    onLeave(event);
  };

  return (
    <div
      ref={hostRef}
      className={`relative ${className}`.trim()}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {mountOverlay && (
        <div className={overlayClassNames.join(" ")} style={overlayStyle} />
      )}

      {linkProps?.href ? (
        <a
          {...linkProps}
          className={`relative z-10 overflow-hidden ${borderRadius} ${innerClassName} ${linkProps.className ?? ""}`.trim()}
        >
          {children}
        </a>
      ) : (
        <div
          className={`relative z-10 overflow-hidden ${borderRadius} ${innerClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
