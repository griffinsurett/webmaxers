// @ts-nocheck
// src/components/OptimizedLottie.jsx
// Performance-optimized Lottie component with very conservative loading

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useVisibility } from "../hooks/animations/useVisibility";
import { useScrollInteraction } from "@/hooks/interactions/useScrollInteraction";

const animationDataCache = new Map<string, Promise<any>>();

const loadAnimationData = async (animationUrl: string) => {
  let cached = animationDataCache.get(animationUrl);
  if (!cached) {
    cached = fetch(animationUrl).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load animation: ${res.status} ${res.statusText}`);
      }
      return res.json();
    });
    animationDataCache.set(animationUrl, cached);
  }
  return cached;
};

// Helper: run after the browser is idle (fallback to setTimeout)
const onIdle = (cb) => {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout: 1000 });
  } else {
    setTimeout(cb, 0);
  }
};

const getCurrentFrame = (anim) => {
  if (!anim) return 0;
  if (typeof anim.currentFrame === "number") return anim.currentFrame;
  if (typeof anim.currentRawFrame === "number") return anim.currentRawFrame;
  return 0;
};

const SCROLL_TOP_THRESHOLD = 2;

export default function OptimizedLottie({
  // Animation source (provide one of these)
  animationData = null,        // Pre-loaded JSON data
  animationUrl = null,         // URL to JSON file (will fetch at runtime)
  
  // Display options
  alt = "",
  className = "",
  containerClasses = "relative",
  
  // Behavior options
  trigger = "load",            // "auto" | "scroll" | "visible" | "load"
  respectReducedMotion = true,
  rewindToStartOnTop = false,
  
  // Animation options
  loop = true,
  autoplay = false,
  speed = 1,
  renderer = "svg",            // "svg" | "canvas" | "html"
  
  // Performance options
  fadeMs = 180,
  scrollThreshold = 1,
  debounceDelay = 8,
  wheelSensitivity = 1,
  
  // Fallback content (Astro Image)
  children,
  decorative = false,
}) {
  const containerRef = useRef(null);
  const lottieContainerRef = useRef(null);
  const animationRef = useRef(null);
  const pauseTimeout = useRef(null);
  const lastScrollTime = useRef(0);
  const topResetHandlerRef = useRef(null);
  const resettingToStartRef = useRef(false);
  const wasAtTopRef = useRef(true);

  const [showFallback, setShowFallback] = useState(true);
  const [shouldLoadLottie, setShouldLoadLottie] = useState(false); // NEW: Gate Lottie loading
  const [pageScrollable, setPageScrollable] = useState(false);

  const cancelTopReset = useCallback(() => {
    const anim = animationRef.current;
    if (anim && topResetHandlerRef.current) {
      anim.removeEventListener("enterFrame", topResetHandlerRef.current);
    }
    topResetHandlerRef.current = null;
    resettingToStartRef.current = false;
  }, []);

  // Detect if page can scroll (affects "auto" trigger) - deferred to avoid forced reflow
  useEffect(() => {
    // Use requestIdleCallback to avoid blocking initial render
    const check = () => {
      const el = document.documentElement;
      setPageScrollable((el?.scrollHeight || 0) > (window.innerHeight || 0) + 1);
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(check, { timeout: 500 });
    } else {
      setTimeout(check, 100);
    }
  }, []);

  // Resolve effective trigger - avoid getBoundingClientRect during render
  const effectiveTrigger = useMemo(() => {
    // For explicit triggers, return immediately without layout queries
    if (trigger === "scroll" || trigger === "visible" || trigger === "load") return trigger;

    // "auto" mode: default to "scroll" initially, will update after idle check
    return pageScrollable ? "scroll" : "load";
  }, [trigger, pageScrollable]);

  // Reduced motion / pause-animations guard
  const motionDisabled = useMotionPreference(respectReducedMotion);

  // Visibility helpers
  const seenOnce = useVisibility(containerRef, { threshold: 0.1, rootMargin: "0px", once: true });
  const visible = useVisibility(containerRef, { threshold: 0, rootMargin: "0px", once: false });

  // NEW: Conservative loading decision
  // Only load Lottie when we actually need it, not just when component mounts
  useEffect(() => {
    if (motionDisabled) return; // Never load if reduced motion
    
    switch (effectiveTrigger) {
      case "load":
        setShouldLoadLottie(true); // Load immediately
        break;
      case "visible":
        if (visible) setShouldLoadLottie(true); // Load when visible
        break;
      case "scroll":
        // DON'T load until first scroll happens
        // This will be triggered by the scroll interaction hook
        break;
    }
  }, [effectiveTrigger, visible, motionDisabled]);

  const handleMovement = useCallback(
    (deltaY) => {
      const anim = animationRef.current;
      const now = Date.now();
      lastScrollTime.current = now;
      if (!anim) return;

      cancelTopReset();
      clearTimeout(pauseTimeout.current);

      if (deltaY > 0) {
        anim.setDirection(1);
        if (anim.isPaused) anim.play();
      } else if (deltaY < 0) {
        anim.setDirection(-1);
        if (anim.isPaused) anim.play();
      }

      pauseTimeout.current = setTimeout(() => {
        if (now === lastScrollTime.current && anim) anim.pause();
      }, 200);
    },
    [cancelTopReset]
  );

  const animateBackToStart = useCallback(() => {
    if (!rewindToStartOnTop) return;
    const anim = animationRef.current;
    if (!anim || resettingToStartRef.current) return;

    const currentFrame = getCurrentFrame(anim);
    if (currentFrame <= 0) {
      anim.goToAndStop(0, true);
      return;
    }

    resettingToStartRef.current = true;
    clearTimeout(pauseTimeout.current);

    const stopAtStart = () => {
      if (getCurrentFrame(anim) <= 0.5) {
        anim.pause();
        anim.goToAndStop(0, true);
        cancelTopReset();
      }
    };

    topResetHandlerRef.current = stopAtStart;
    anim.addEventListener("enterFrame", stopAtStart);
    anim.setDirection(-1);
    anim.play();
  }, [rewindToStartOnTop, cancelTopReset]);

  // Scroll interaction for scroll-triggered loading
  useScrollInteraction({
    elementRef: null, // Use window
    scrollThreshold: 1,
    debounceDelay: 16,
    trustedOnly: true,
    wheelSensitivity: 1,
    
    // For scroll triggers, this is what loads the Lottie
    onScrollActivity: effectiveTrigger === "scroll" && seenOnce ? ({ dir, delta }) => {
      if (motionDisabled) return;
      if (!shouldLoadLottie) {
        setShouldLoadLottie(true); // First scroll triggers loading
      }
      // Handle animation movement (will be set up after Lottie loads)
      if (animationRef.current) {
        const deltaY = dir === "down" ? delta : -delta;
        handleMovement(deltaY);
      }
    } : undefined,
    
    onWheelActivity: effectiveTrigger === "scroll" && seenOnce ? ({ deltaY }) => {
      if (motionDisabled) return;
      if (!shouldLoadLottie) {
        setShouldLoadLottie(true); // First wheel triggers loading
      }
      // Handle animation movement
      if (animationRef.current) {
        handleMovement(deltaY);
      }
    } : undefined,
  });

  // Detect when the page scroll position returns to the very top and rewind
  useEffect(() => {
    if (!rewindToStartOnTop || effectiveTrigger !== "scroll" || motionDisabled)
      return;
    if (typeof window === "undefined") return;

    wasAtTopRef.current = (window.scrollY || 0) <= SCROLL_TOP_THRESHOLD;

    const maybeRewind = () => {
      const pos = window.scrollY || 0;
      const isAtTop = pos <= SCROLL_TOP_THRESHOLD;
      if (!wasAtTopRef.current && isAtTop) {
        animateBackToStart();
      }
      wasAtTopRef.current = isAtTop;
    };

    window.addEventListener("scroll", maybeRewind, { passive: true });
    return () => window.removeEventListener("scroll", maybeRewind);
  }, [rewindToStartOnTop, effectiveTrigger, animateBackToStart, motionDisabled]);

  // Initialize Lottie lazily - ONLY when shouldLoadLottie becomes true
  useEffect(() => {
    if (motionDisabled) return;
    if (!shouldLoadLottie || !lottieContainerRef.current || animationRef.current)
      return;
    if (!animationData && !animationUrl) {
      console.warn("OptimizedLottie: No animationData or animationUrl provided");
      return;
    }

    let canceled = false;

    onIdle(async () => {
      if (canceled) return;

      try {
        // 1) Load Lottie player (use light build for performance)
        const { default: lottie } = await import("lottie-web/build/player/lottie_light");

        // 2) Get animation data (either pre-loaded or fetch from URL)
        let data = animationData;
        if (!data && animationUrl) {
          data = await loadAnimationData(animationUrl);
        }
        
        if (canceled || !data) return;

        // 3) Create animation
        const anim = lottie.loadAnimation({
          container: lottieContainerRef.current,
          renderer,
          loop,
          autoplay,
          animationData: data,
        });

        animationRef.current = anim;
        anim.setSpeed(speed);
        
        if (!autoplay) {
          anim.goToAndStop(0, true);
        }

        const ready = () => {
          // Ensure first frame is set before fading
          if (!autoplay) {
            anim.goToAndStop(0, true);
          }
          // Wait a frame so the animation is in the DOM, then fade the fallback
          requestAnimationFrame(() => setShowFallback(false));
          
          // Auto-start for certain triggers
          if (effectiveTrigger === "load" && autoplay) {
            anim.setDirection(1);
            anim.play();
          }
        };

        // Handle different loading events
        anim.addEventListener("DOMLoaded", ready);
        anim.addEventListener("data_ready", ready);
        Promise.resolve().then(() => ready()); // Fallback
      } catch (err) {
        console.error("OptimizedLottie: Failed to load animation:", err);
        // Keep fallback visible on error
      }
    });

    return () => {
      canceled = true;
      cancelTopReset();
      animationRef.current?.destroy?.();
      animationRef.current = null;
    };
  }, [
    shouldLoadLottie,
    effectiveTrigger,
    animationData,
    animationUrl,
    renderer,
    loop,
    autoplay,
    speed,
    cancelTopReset,
    motionDisabled,
  ]);

  // Tear down animation if motion gets disabled after load
  useEffect(() => {
    if (!motionDisabled) return;
    setShowFallback(true);
    setShouldLoadLottie(false);
    cancelTopReset();
    clearTimeout(pauseTimeout.current);
    animationRef.current?.destroy?.();
    animationRef.current = null;
  }, [motionDisabled, cancelTopReset]);

  // Visible mode: play when in view
  useEffect(() => {
    if (effectiveTrigger !== "visible" || !animationRef.current) return;
    if (motionDisabled) return;
    if (!showFallback && visible) {
      animationRef.current.setDirection(1);
      animationRef.current.play();
    }
  }, [effectiveTrigger, visible, showFallback, motionDisabled]);

  // Cleanup
  useEffect(() => () => clearTimeout(pauseTimeout.current), []);

  const shouldShowFallback = motionDisabled || showFallback;

  return (
    <div
      ref={containerRef}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? "presentation" : undefined}
      className={`${className} ${containerClasses}`}
    >
      {/* Fallback layer (Astro Image) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transition: `opacity ${fadeMs}ms ease`,
          opacity: shouldShowFallback ? 1 : 0,
        }}
        aria-hidden={decorative ? true : !shouldShowFallback}
      >
        <div className="w-full h-full">{children}</div>
      </div>

      {/* Lottie layer - only render when we've decided to load */}
      {shouldLoadLottie && !motionDisabled && (
        <div
          ref={lottieContainerRef}
          className="absolute inset-0"
          style={{ visibility: motionDisabled ? "hidden" : "visible" }}
          aria-hidden={decorative ? true : shouldShowFallback}
        />
      )}
    </div>
  );
}
