// src/components/Carousels/SmoothScrollCarousel.tsx
import {
  Children,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVisibility } from "@/hooks/animations/useVisibility";
import useEngagementAutoplay from "@/hooks/autoplay/useEngagementAutoplay";
import { useKeyboardInteraction } from "@/hooks/interactions/useKeyboardInteraction";

export interface SmoothScrollCarouselHandle {
  container: HTMLDivElement | null;
  track: HTMLDivElement | null;
  getCurrentOffset: () => number;
  setOffset: (value: number) => void;
}

interface SmoothScrollCarouselProps {
  items?: any[];
  renderItem?: (
    item: any,
    index: number,
    ctx: { isActive: boolean; onInteraction: (type: string) => void },
  ) => ReactNode;
  children?: ReactNode;
  speed?: number;
  duplicateCount?: number;
  autoplay?: boolean;
  pauseOnHover?: boolean;
  pauseOnEngage?: boolean;
  startDelay?: number;
  gap?: number;
  itemWidth?: number;
  gradientMask?: boolean;
  gradientWidth?: { base: number; md: number };
  threshold?: number;
  onItemInteraction?: (payload: any, index: number, type: string) => void;
  resumeDelay?: number;
  resumeTriggers?: string[];
  containerSelector?: string;
  itemSelector?: string;
  className?: string;
  trackClassName?: string;
  /** Enable drag/swipe to manually scroll */
  drag?: boolean;
}

const SmoothScrollCarousel = forwardRef<
  SmoothScrollCarouselHandle,
  SmoothScrollCarouselProps
>(function SmoothScrollCarousel(
  {
    items = [],
    renderItem = () => null,
    children,
    speed = 30,
    duplicateCount = 3,
    autoplay = true,
    pauseOnHover = true,
    pauseOnEngage = true,
    startDelay = 2500,
    gap = 24,
    itemWidth = 120,
    gradientMask = true,
    gradientWidth = { base: 48, md: 80 },
    threshold = 0.3,
    onItemInteraction,
    resumeDelay = 500,
    resumeTriggers = ["scroll", "click-outside", "hover-away"],
    containerSelector,
    itemSelector,
    className = "",
    trackClassName = "",
    drag = false,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);

  const scopeId = useMemo(
    () => `smooth-carousel-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  useImperativeHandle(ref, () => ({
    container: containerRef.current,
    track: trackRef.current,
    getCurrentOffset: () => currentOffset,
    setOffset: setCurrentOffset,
  }));

  const inView = useVisibility(containerRef, { threshold });

  const childrenArray = useMemo(
    () => Children.toArray(children).filter(Boolean),
    [children],
  );
  const usingChildren = childrenArray.length > 0;
  const baseLength = usingChildren ? childrenArray.length : items.length;

  const duplicated = useMemo(() => {
    if (usingChildren) {
      return Array.from({ length: duplicateCount }, (_, dupIdx) =>
        childrenArray.map((node, idx) => ({
          type: "child" as const,
          node,
          originalIndex: idx,
          duplicateIndex: dupIdx,
        })),
      ).flat();
    }
    return Array.from({ length: duplicateCount }, (_, dupIdx) =>
      items.map((item, idx) => ({
        type: "item" as const,
        item,
        originalIndex: idx,
        duplicateIndex: dupIdx,
      })),
    ).flat();
  }, [childrenArray, duplicateCount, items, usingChildren]);

  const totalWidth = baseLength * itemWidth;

  const {
    engageUser,
    isAutoplayPaused,
    userEngaged,
    isResumeScheduled,
    pause,
    resume,
  } =
    useEngagementAutoplay({
      totalItems: Math.max(baseLength, 1),
      currentIndex:
        baseLength > 0
          ? Math.floor(Math.abs(currentOffset) / itemWidth) % baseLength
          : 0,
      setIndex: () => {},
      autoplayTime: 50,
      resumeDelay,
      resumeTriggers,
      containerSelector:
        containerSelector || `[data-autoplay-scope="${scopeId}"]`,
      itemSelector:
        itemSelector ||
        `[data-autoplay-scope="${scopeId}"] [data-smooth-item]`,
      inView: autoplay && inView,
      pauseOnEngage,
      engageOnlyOnActiveItem: false,
      activeItemAttr: "data-active",
    });

  const [canAnimate, setCanAnimate] = useState(false);
  useEffect(() => {
    const eligible = autoplay && inView && !isAutoplayPaused;
    if (!eligible) {
      setCanAnimate(false);
      return;
    }
    const timer = window.setTimeout(() => setCanAnimate(true), startDelay);
    return () => window.clearTimeout(timer);
  }, [autoplay, inView, isAutoplayPaused, startDelay]);

  useEffect(() => {
    if (!canAnimate) return;
    let animationId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setCurrentOffset((prev) => {
        if (totalWidth <= 0) return prev;
        let next = prev - speed * dt;
        if (Math.abs(next) >= totalWidth) {
          next += totalWidth;
        }
        return next;
      });
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [canAnimate, speed, totalWidth]);

  const hoverResumeTimerRef = useRef<number | null>(null);

  const clearHoverResume = useCallback(() => {
    if (hoverResumeTimerRef.current) {
      window.clearTimeout(hoverResumeTimerRef.current);
      hoverResumeTimerRef.current = null;
    }
  }, []);

  const scheduleHoverResume = useCallback(() => {
    clearHoverResume();
    hoverResumeTimerRef.current = window.setTimeout(() => {
      resume();
      hoverResumeTimerRef.current = null;
    }, resumeDelay);
  }, [clearHoverResume, resume, resumeDelay]);

  // Drag state for manual scrolling
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  const handleDragStart = useCallback((clientX: number) => {
    if (!drag) return;
    isDragging.current = true;
    dragStartX.current = clientX;
    dragStartOffset.current = currentOffset;
  }, [drag, currentOffset]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!drag || !isDragging.current) return;
    const delta = clientX - dragStartX.current;
    let newOffset = dragStartOffset.current + delta;
    // Wrap around for infinite scroll feel
    if (totalWidth > 0) {
      while (newOffset > 0) newOffset -= totalWidth;
      while (newOffset < -totalWidth) newOffset += totalWidth;
    }
    setCurrentOffset(newOffset);
  }, [drag, totalWidth]);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Mouse events for drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    e.preventDefault();
    engageUser();
    pause();
    handleDragStart(e.clientX);
  }, [drag, engageUser, pause, handleDragStart]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  }, [handleDragMove]);

  const onMouseUp = useCallback(() => {
    if (isDragging.current) {
      handleDragEnd();
      scheduleHoverResume();
    }
  }, [handleDragEnd, scheduleHoverResume]);

  // Touch events for drag
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!drag) return;
    engageUser();
    pause();
    handleDragStart(e.touches[0].clientX);
  }, [drag, engageUser, pause, handleDragStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  }, [handleDragMove]);

  const onTouchEnd = useCallback(() => {
    if (isDragging.current) {
      handleDragEnd();
      scheduleHoverResume();
    }
  }, [handleDragEnd, scheduleHoverResume]);

  // Global mouse up listener for drag release outside container
  useEffect(() => {
    if (!drag) return;
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        handleDragEnd();
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [drag, handleDragEnd]);

  // Keyboard navigation for accessibility
  const scrollByAmount = useCallback((amount: number) => {
    engageUser();
    pause();
    setCurrentOffset((prev) => {
      let next = prev + amount;
      if (totalWidth > 0) {
        while (next > 0) next -= totalWidth;
        while (next < -totalWidth) next += totalWidth;
      }
      return next;
    });
    scheduleHoverResume();
  }, [engageUser, pause, totalWidth, scheduleHoverResume]);

  useKeyboardInteraction({
    elementRef: containerRef,
    requireFocus: true,
    onArrowLeft: () => scrollByAmount(itemWidth + gap),
    onArrowRight: () => scrollByAmount(-(itemWidth + gap)),
  });

  const handleItemInteraction = (payload: any, index: number, type: string) => {
    if (pauseOnEngage) {
      engageUser();
      pause();
    }
    onItemInteraction?.(payload, index, type);
  };

  const handleMouseEnterContainer = () => {
    if (!pauseOnHover) return;
    engageUser();
    pause();
  };

  const handleMouseLeaveContainer = () => {
    if (!pauseOnHover) return;
    scheduleHoverResume();
  };

  useEffect(() => () => clearHoverResume(), [clearHoverResume]);

  const [gradientPx, setGradientPx] = useState(() =>
    typeof window === "undefined"
      ? gradientWidth.base
      : window.innerWidth >= 768
        ? gradientWidth.md
        : gradientWidth.base,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = () => {
      setGradientPx(
        window.innerWidth >= 768 ? gradientWidth.md : gradientWidth.base,
      );
    };
    window.addEventListener("resize", listener, { passive: true });
    return () => window.removeEventListener("resize", listener);
  }, [gradientWidth.base, gradientWidth.md]);

  return (
    <div
      ref={containerRef}
      data-autoplay-scope={scopeId}
      className={`relative w-full overflow-hidden ${className}`.trim()}
      data-smooth-carousel
      onMouseEnter={handleMouseEnterContainer}
      onMouseLeave={handleMouseLeaveContainer}
      tabIndex={0}
      role="region"
      aria-label="Scrolling carousel. Use left and right arrow keys to navigate."
    >
      <div
        className="overflow-hidden"
        style={{
          paddingInline: `${gradientPx}px`,
          ...(gradientMask && {
            maskImage: `linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${gradientPx}px, rgba(0,0,0,1) calc(100% - ${gradientPx}px), rgba(0,0,0,0) 100%)`,
            WebkitMaskImage: `linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) ${gradientPx}px, rgba(0,0,0,1) calc(100% - ${gradientPx}px), rgba(0,0,0,0) 100%)`,
          }),
        }}
      >
        <div
          ref={trackRef}
          className={`flex items-center ${drag ? "cursor-grab active:cursor-grabbing select-none" : ""} ${trackClassName}`.trim()}
          style={{
            transform: `translateX(${currentOffset}px)`,
            width: "max-content",
            gap: `${gap}px`,
          }}
          onMouseDown={drag ? onMouseDown : undefined}
          onMouseMove={drag ? onMouseMove : undefined}
          onMouseUp={drag ? onMouseUp : undefined}
          onTouchStart={drag ? onTouchStart : undefined}
          onTouchMove={drag ? onTouchMove : undefined}
          onTouchEnd={drag ? onTouchEnd : undefined}
        >
          {duplicated.map((entry, index) => (
            <div
              key={`${entry.originalIndex}-${entry.duplicateIndex}-${index}`}
              data-smooth-item
              className="flex-shrink-0"
              onMouseEnter={() => handleItemInteraction(entry, index, "hover")}
            >
              {entry.type === "child"
                ? entry.node
                : renderItem(entry.item, index, {
                    isActive: false,
                    onInteraction: (type: string) =>
                      handleItemInteraction(entry.item, index, type),
                  })}
            </div>
          ))}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="absolute top-2 right-2 text-xs bg-bg/60 text-text px-3 py-2 rounded pointer-events-none z-50 space-y-1">
          <div>🎠 Autoplay: {autoplay ? "ON" : "OFF"}</div>
          <div>👁️ In View: {inView ? "YES" : "NO"}</div>
          <div>⏸️ Paused: {isAutoplayPaused ? "YES" : "NO"}</div>
          <div>👤 Engaged: {userEngaged ? "YES" : "NO"}</div>
          <div>⏲️ Resume Scheduled: {isResumeScheduled ? "YES" : "NO"}</div>
        </div>
      )}
    </div>
  );
});

export default SmoothScrollCarousel;
