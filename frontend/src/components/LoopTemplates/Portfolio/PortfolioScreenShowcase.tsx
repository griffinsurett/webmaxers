// src/components/LoopTemplates/Portfolio/PortfolioScreenShowcase.tsx
// Refactored to use shared types and ScrollableViewport component
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ClientImage from "@/components/ClientImage";
import ScrollableViewport from "@/components/LoopComponents/Portfolio/ScrollableViewport";
import KeyboardNavigableContainer from "./KeyboardNavigableContainer";
import {
  type PortfolioItemData,
  type PortfolioMediaEntry,
  normalizeItems,
} from "@/components/LoopComponents/Portfolio/types";

interface PortfolioScreenShowcaseProps {
  items?: PortfolioItemData[];
  className?: string;
  mediaEntries?: (PortfolioMediaEntry | undefined)[];
  optimizeFirstImage?: boolean;
  showDevOverlay?: boolean;
}

interface ScreenProps {
  item: PortfolioItemData;
  mediaEntry?: PortfolioMediaEntry;
  totalSlides: number;
  onCycleComplete: () => void;
  isActive: boolean;
  isTransitioning?: boolean;
  showDevOverlay?: boolean;
}

const SLIDE_TRANSITION_DURATION_MS = 750;
const SHOWCASE_READY_EVENT = "portfolio-showcase:ready";
const SHOWCASE_READY_DELAY_MS = 800;

function ComputerScreen({
  item,
  mediaEntry,
  totalSlides,
  onCycleComplete,
  isActive,
  isTransitioning = false,
  showDevOverlay = false,
}: ScreenProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Reset + play/pause video when slide activates/deactivates
  useEffect(() => {
    if (!isHydrated) return;
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !isTransitioning) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, isTransitioning, isHydrated]);

  const isVideo = typeof item.featuredVideo === "string" && item.featuredVideo.length > 0;
  const handleCycleComplete = totalSlides > 1 ? onCycleComplete : undefined;

  if (!isHydrated) {
    return (
      <div className="h-full w-full bg-linear-to-b from-bg2 via-bg to-bg/80" />
    );
  }

  // Video slide: play to end, then advance
  if (isVideo) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={item.featuredVideo}
          muted
          playsInline
          preload="metadata"
          onEnded={handleCycleComplete}
          className="block h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  // Image slide: scroll to end via ScrollableViewport, then advance
  if (!mediaEntry?.src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-linear-to-b from-bg2 via-bg to-bg/80 text-white/30">
        Preview coming soon
      </div>
    );
  }

  return (
    <ScrollableViewport
      isActive={isActive}
      isTransitioning={isTransitioning}
      onScrollComplete={handleCycleComplete}
      resetOnActivate={true}
      showDevOverlay={showDevOverlay}
    >
      <ClientImage
        src={mediaEntry?.src}
        srcSet={mediaEntry?.srcSet}
        sizes={mediaEntry?.sizes}
        sources={mediaEntry?.sources}
        alt={mediaEntry?.alt || item.alt || item.title || "Project preview"}
        width={mediaEntry?.width}
        height={mediaEntry?.height}
        loading={mediaEntry?.loading || "lazy"}
        decoding={mediaEntry?.decoding || "async"}
        fetchPriority={mediaEntry?.fetchPriority || "auto"}
        draggable={false}
        className="block h-auto min-h-full w-full select-none object-cover object-top"
      />
    </ScrollableViewport>
  );
}

export default function PortfolioScreenShowcase({
  items = [],
  className = "",
  mediaEntries: mediaEntriesProp = [],
  showDevOverlay = false,
}: PortfolioScreenShowcaseProps) {
  const slides = useMemo(() => normalizeItems(items), [items]);
  const mediaEntries = useMemo(() => normalizeItems(mediaEntriesProp), [mediaEntriesProp]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [transitionStage, setTransitionStage] = useState<"idle" | "pre" | "animating">("idle");
  const transitionTimerRef = useRef<number | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const readyEventSentRef = useRef(false);

  // Hide SSR placeholder when component mounts
  useEffect(() => {
    const container = document.querySelector('[data-portfolio-container]');
    const placeholder = container?.querySelector('[data-ssr-placeholder]');
    if (placeholder instanceof HTMLElement) {
      placeholder.style.opacity = '0';
      placeholder.style.visibility = 'hidden';
      placeholder.style.pointerEvents = 'none';
    }
  }, []);

  useEffect(() => {
    if (!slides.length || readyEventSentRef.current) return;
    readyEventSentRef.current = true;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SHOWCASE_READY_EVENT));
    }, SHOWCASE_READY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) {
      setActiveIndex(0);
      setPrevIndex(null);
      setTransitionStage("idle");
      return;
    }
    setActiveIndex((prev) => (prev >= slides.length ? 0 : prev));
  }, [slides.length]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }
    },
    [],
  );

  const startSlideTransition = useCallback(
    (targetIndex: number) => {
      if (typeof window === "undefined") return;
      setPrevIndex(activeIndex);
      setActiveIndex(targetIndex);
      setTransitionStage("pre");

      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }

      transitionFrameRef.current = requestAnimationFrame(() => {
        transitionFrameRef.current = requestAnimationFrame(() => {
          setTransitionStage("animating");
        });
      });

      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      transitionTimerRef.current = window.setTimeout(() => {
        setTransitionStage("idle");
        setPrevIndex(null);
      }, SLIDE_TRANSITION_DURATION_MS);
    },
    [activeIndex],
  );

  const handleCycleComplete = useCallback(() => {
    if (!slides.length || slides.length <= 1) return;
    if (transitionStage !== "idle") return;
    const nextIndex = (activeIndex + 1) % slides.length;
    startSlideTransition(nextIndex);
  }, [activeIndex, slides.length, startSlideTransition, transitionStage]);

  const goToPrevious = useCallback(() => {
    if (!slides.length || slides.length <= 1) return;
    if (transitionStage !== "idle") return;
    const prevIdx = activeIndex === 0 ? slides.length - 1 : activeIndex - 1;
    startSlideTransition(prevIdx);
  }, [activeIndex, slides.length, startSlideTransition, transitionStage]);

  const goToNext = useCallback(() => {
    if (!slides.length || slides.length <= 1) return;
    if (transitionStage !== "idle") return;
    const nextIdx = (activeIndex + 1) % slides.length;
    startSlideTransition(nextIdx);
  }, [activeIndex, slides.length, startSlideTransition, transitionStage]);

  if (!slides.length) return null;

  const baseTransitionClass =
    "absolute inset-0 transition-transform transition-opacity duration-[750ms] ease-[cubic-bezier(0.4,0,0.2,1)]";

  return (
    <KeyboardNavigableContainer
      onPrevious={goToPrevious}
      onNext={goToNext}
      className={`portfolio-showcase-mounted relative h-full ${className}`.trim()}
      ariaLabel="Portfolio showcase. Use left and right arrow keys to navigate."
    >
      <div className="relative h-full w-full overflow-hidden">
        {slides.map((item, slideIndex) => {
          const isActive = slideIndex === activeIndex;
          const isPrev = slideIndex === prevIndex;
          const isVisible = isActive || (isPrev && transitionStage !== "idle");

          const shouldMount = isActive || (isPrev && transitionStage !== "idle");
          if (!shouldMount) return null;

          let translateClass = "translate-x-full";
          if (isPrev && transitionStage !== "idle") {
            translateClass = "-translate-x-full";
          } else if (isActive) {
            if (transitionStage === "idle" || prevIndex === null) {
              translateClass = "translate-x-0";
            } else if (transitionStage === "pre") {
              translateClass = "translate-x-full";
            } else {
              translateClass = "translate-x-0";
            }
          }

          return (
            <div
              key={item.id ?? slideIndex}
              className={`${baseTransitionClass} shadow-2xl ${translateClass} ${
                isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={isActive ? "false" : "true"}
            >
              <ComputerScreen
                item={item}
                mediaEntry={mediaEntries[slideIndex]}
                totalSlides={slides.length || 1}
                onCycleComplete={handleCycleComplete}
                isActive={isActive}
                isTransitioning={transitionStage !== "idle"}
                showDevOverlay={showDevOverlay}
              />
            </div>
          );
        })}
      </div>
    </KeyboardNavigableContainer>
  );
}
