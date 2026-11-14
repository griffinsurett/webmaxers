// src/components/LoopTemplates/Portfolio/FilteredPortfolioCarousel.tsx
/**
 * FilteredPortfolioCarousel - Collection-neutral filtered portfolio with 3D carousel transitions
 *
 * Combines the best of both portfolio variants:
 * - 3D carousel transitions between filter groups (like PortfolioCarousel)
 * - Image cycling within each group (like PortfolioScreenShowcase)
 *
 * Accepts pre-built groups from the Astro variant for server-side grouping.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FilterConfig } from "@/hooks/useFilter";
import FilterTabs from "../FilterTabs";
import ScrollableViewport from "@/components/LoopComponents/Portfolio/ScrollableViewport";
import ClientImage from "@/components/ClientImage";
import FilterNavigation from "../FilterNavigation";
import KeyboardNavigableContainer from "./KeyboardNavigableContainer";
import { useSideDragNavigation } from "@/hooks/interactions/useSideDragNavigation";
import { useImageCycling } from "./useImageCycling";
import { animationProps } from "@/integrations/scroll-animations";
import {
  type PortfolioItemData,
  type PortfolioMediaEntry,
} from "@/components/LoopComponents/Portfolio/types";

// Extended portfolio item
interface FilteredPortfolioItem extends PortfolioItemData {
  [key: string]: any;
}

// Pre-built group from server
interface FilterGroup {
  key: string;
  label: string;
  icon?: string;
  items: FilteredPortfolioItem[];
  mediaEntries: (PortfolioMediaEntry | undefined)[];
  count?: number;
}

interface FilteredPortfolioCarouselProps {
  /** Pre-built groups from the Astro variant */
  groups?: FilterGroup[];
  filter?: FilterConfig;
  filterSize?: "sm" | "md" | "lg";
  filterClassName?: string;
  showFilters?: boolean;
  drag?: boolean;
  className?: string;
}

/**
 * Individual slide that cycles through its project images
 */
interface SlideProps {
  group: FilterGroup;
  isActive: boolean;
  position: "center" | "left" | "right" | "hidden";
  centerW: number;
  centerH: number;
  sideW: number;
  sideH: number;
  tx: number;
  onSelect: () => void;
  onCycleComplete: () => void;
  /** Register keyboard handlers when this slide is active */
  onRegisterHandlers?: (handlers: { goToPrevious: () => boolean; goToNext: () => boolean }) => void;
}

function GroupSlide({
  group,
  isActive,
  position,
  centerW,
  centerH,
  sideW,
  sideH,
  tx,
  onSelect,
  onCycleComplete,
  onRegisterHandlers,
}: SlideProps) {
  // Use shared image cycling hook
  const {
    imageIndex,
    prevImageIndex,
    transitionStage,
    goToPrevious,
    goToNext,
    handleScrollComplete,
    isTransitioning,
  } = useImageCycling({
    totalImages: group.items.length,
    isActive,
    onCycleComplete,
  });

  // Register handlers with parent when active
  useEffect(() => {
    if (isActive && onRegisterHandlers) {
      onRegisterHandlers({ goToPrevious, goToNext });
    }
  }, [isActive, onRegisterHandlers, goToPrevious, goToNext]);

  const translateBase = isActive ? "translate(-50%, 0)" : "translate(-50%, -50%)";

  const slideBase =
    "absolute left-1/2 overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform bg-gray-900";

  let style: CSSProperties = {
    width: `${sideW}px`,
    height: `${sideH}px`,
    transform: `${translateBase} scale(0)`,
    zIndex: 10,
    opacity: 0,
    pointerEvents: "none",
  };

  if (position === "center") {
    style = {
      width: `${centerW}px`,
      height: `${centerH}px`,
      transform: `${translateBase} scale(1) rotateY(0deg)`,
      zIndex: 30,
      opacity: 1,
    };
  } else if (position === "left") {
    style = {
      width: `${sideW}px`,
      height: `${sideH}px`,
      transform: `${translateBase} translateX(-${tx}px) scale(0.9) rotateY(22deg)`,
      zIndex: 20,
      opacity: 0.4,
    };
  } else if (position === "right") {
    style = {
      width: `${sideW}px`,
      height: `${sideH}px`,
      transform: `${translateBase} translateX(${tx}px) scale(0.9) rotateY(-22deg)`,
      zIndex: 20,
      opacity: 0.4,
    };
  }

  const currentItem = group.items[imageIndex];
  const currentMediaEntry = group.mediaEntries[imageIndex];

  const renderMedia = (item: FilteredPortfolioItem, mediaEntry?: PortfolioMediaEntry) => {
    const altText = mediaEntry?.alt || item.alt || item.title || "Project preview";

    if (mediaEntry?.sources?.length) {
      return (
        <picture>
          {mediaEntry.sources.map((source, idx) => (
            <source
              key={`source-${idx}`}
              srcSet={source.srcSet}
              sizes={source.sizes ?? mediaEntry.sizes}
              type={source.type}
            />
          ))}
          <img
            src={mediaEntry.src}
            srcSet={mediaEntry.srcSet}
            sizes={mediaEntry.sizes}
            alt={altText}
            width={mediaEntry.width}
            height={mediaEntry.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="block w-full h-auto min-h-full select-none object-cover object-top"
          />
        </picture>
      );
    }

    if (mediaEntry?.src) {
      return (
        <ClientImage
          src={mediaEntry.src}
          srcSet={mediaEntry?.srcSet}
          sizes={mediaEntry?.sizes}
          alt={altText}
          width={mediaEntry?.width}
          height={mediaEntry?.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="block w-full h-auto min-h-full select-none object-cover object-top"
        />
      );
    }

    return (
      <div className="flex h-full w-full bg-gradient-to-b from-bg2 via-bg to-bg/80" />
    );
  };

  // For screen showcase style cycling within the industry
  const baseTransitionClass =
    "absolute inset-0 transition-transform transition-opacity duration-[750ms] ease-[cubic-bezier(0.4,0,0.2,1)]";

  return (
    <div
      className={`${slideBase} ${isActive ? "top-0" : "top-1/2"}`}
      style={style}
      data-carousel-item
      data-industry={group.key}
      data-active={isActive ? "true" : "false"}
      onClick={() => {
        if (!isActive) {
          onSelect();
        }
      }}
    >
      <div className="relative h-full w-full">
      {group.items.length === 1 ? (
        // Single item - just use ScrollableViewport
        <ScrollableViewport
          isActive={isActive}
          isTransitioning={false}
          onScrollComplete={handleScrollComplete}
          speedPxPerSec={98}
          resetOnActivate={true}
          showDevOverlay={true}
          className="w-full h-full bg-gray-900 m-0 p-0"
        >
          {renderMedia(currentItem, currentMediaEntry)}
        </ScrollableViewport>
      ) : (
        // Multiple items - cycle through with slide transitions
        <div className="relative h-full w-full overflow-hidden">
          {group.items.map((item, idx) => {
            const isActiveImage = idx === imageIndex;
            const isPrevImage = idx === prevImageIndex;
            const shouldMount = isActiveImage || (isPrevImage && isTransitioning);

            if (!shouldMount) return null;

            let translateClass = "translate-x-full";
            if (isPrevImage && isTransitioning) {
              translateClass = "-translate-x-full";
            } else if (isActiveImage) {
              if (!isTransitioning || prevImageIndex === null) {
                translateClass = "translate-x-0";
              } else if (transitionStage === "pre") {
                translateClass = "translate-x-full";
              } else {
                translateClass = "translate-x-0";
              }
            }

            const isVisible = isActiveImage || (isPrevImage && isTransitioning);

            return (
              <div
                key={item.id ?? idx}
                className={`${baseTransitionClass} ${translateClass} ${
                  isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <ScrollableViewport
                  isActive={isActive && isActiveImage}
                  isTransitioning={isTransitioning}
                  onScrollComplete={isActiveImage ? handleScrollComplete : undefined}
                  speedPxPerSec={98}
                  resetOnActivate={true}
                  showDevOverlay={true}
                  className="w-full h-full bg-gray-900 m-0 p-0"
                >
                  {renderMedia(item, group.mediaEntries[idx])}
                </ScrollableViewport>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

export default function FilteredPortfolioCarousel({
  groups: groupsProp = [],
  filter,
  filterSize = "sm",
  filterClassName = "",
  showFilters = true,
  drag = false,
  className = "",
}: FilteredPortfolioCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);

  // Use pre-built groups from the Astro variant
  const filterGroups = useMemo(() => groupsProp as FilterGroup[], [groupsProp]);

  // Build filter options from groups
  const filterOptions = useMemo(() => {
    return filterGroups.map((group) => ({
      key: group.key,
      label: group.label,
      icon: group.icon,
      count: group.count ?? group.items.length,
    }));
  }, [filterGroups]);

  // Current group index and active filter state
  const [groupIndex, setGroupIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState(filterGroups[0]?.key ?? "");

  // Track handlers from active slide for within-slide keyboard navigation
  // Using ref to avoid stale closures in keyboard handlers
  const activeSlideHandlersRef = useRef<{
    goToPrevious: () => boolean;
    goToNext: () => boolean;
  } | null>(null);

  const setActiveSlideHandlers = useCallback((handlers: { goToPrevious: () => boolean; goToNext: () => boolean } | null) => {
    activeSlideHandlersRef.current = handlers;
  }, []);

  // Sync group index with active filter
  useEffect(() => {
    const idx = filterGroups.findIndex((g) => g.key === activeFilter);
    if (idx !== -1 && idx !== groupIndex) {
      setGroupIndex(idx);
    }
  }, [activeFilter, filterGroups, groupIndex]);

  // Whether to show filters (more than one group)
  const shouldShowFilters = filterGroups.length > 1;

  const ready = containerW > 0;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const width = element.getBoundingClientRect().width;
      if (width && width !== containerW) setContainerW(width);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerW]);

  const getSizes = () => {
    const width = containerW;
    if (width < 640)
      return { centerW: 280, centerH: 190, sideW: 180, sideH: 120 };
    if (width < 768)
      return { centerW: 340, centerH: 230, sideW: 220, sideH: 150 };
    if (width < 1024)
      return { centerW: 460, centerH: 310, sideW: 290, sideH: 190 };
    if (width < 1280)
      return { centerW: 680, centerH: 450, sideW: 420, sideH: 290 };
    return { centerW: 860, centerH: 540, sideW: 520, sideH: 360 };
  };

  const getTranslateDistance = (sideW: number) => {
    const width = containerW;
    const bleed = width >= 1536 ? 72 : width >= 1280 ? 56 : width >= 1024 ? 40 : 20;
    const edgeGutter = -bleed;
    return width / 2 - sideW / 2 - edgeGutter;
  };

  const { centerW, centerH, sideW, sideH } = ready
    ? getSizes()
    : { centerW: 0, centerH: 0, sideW: 0, sideH: 0 };
  const tx = ready ? getTranslateDistance(sideW) : 0;

  const goToGroup = useCallback((idx: number) => {
    setGroupIndex(idx);
    if (filterGroups[idx]) {
      setActiveFilter(filterGroups[idx].key);
    }
  }, [filterGroups, setActiveFilter]);

  const goToPrevious = useCallback(() => {
    const newIdx = groupIndex === 0 ? filterGroups.length - 1 : groupIndex - 1;
    goToGroup(newIdx);
  }, [groupIndex, filterGroups.length, goToGroup]);

  const goToNext = useCallback(() => {
    const newIdx = groupIndex === filterGroups.length - 1 ? 0 : groupIndex + 1;
    goToGroup(newIdx);
  }, [groupIndex, filterGroups.length, goToGroup]);

  // Handle filter tab click
  const handleFilterChange = useCallback((key: string) => {
    const idx = filterGroups.findIndex((g) => g.key === key);
    if (idx !== -1) {
      goToGroup(idx);
    }
  }, [filterGroups, goToGroup]);

  // Handle cycle complete from industry slide (all images shown)
  const handleGroupCycleComplete = useCallback(() => {
    goToNext();
  }, [goToNext]);

  const leftZoneRef = useRef<HTMLDivElement | null>(null);
  const rightZoneRef = useRef<HTMLDivElement | null>(null);

  useSideDragNavigation({
    enabled: ready && drag && filterGroups.length > 1,
    leftElRef: leftZoneRef,
    rightElRef: rightZoneRef,
    onLeft: goToPrevious,
    onRight: goToNext,
    dragThreshold: Math.max(40, Math.round(containerW * 0.05)),
    tapThreshold: 12,
  });

  const sideZoneWidth = Math.max(140, Math.min(sideW, 520));
  const baseZoneStyle = (leftPx: number): CSSProperties => ({
    left: `calc(50% ${leftPx >= 0 ? "+" : "-"} ${Math.abs(leftPx)}px)`,
    transform: "translateX(-50%)",
    width: `${sideZoneWidth}px`,
    top: 0,
    height: "100%",
  });

  const leftZoneOffset = tx;
  const rightZoneOffset = tx;

  if (!filterGroups.length) return null;

  return (
    <KeyboardNavigableContainer
      containerRef={containerRef}
      onPrevious={goToPrevious}
      onNext={goToNext}
      onPreviousWithinSlide={() => activeSlideHandlersRef.current?.goToPrevious() ?? false}
      onNextWithinSlide={() => activeSlideHandlersRef.current?.goToNext() ?? false}
      className={`w-full ${className}`.trim()}
      ariaLabel="Portfolio carousel. Use left and right arrow keys to navigate between categories."
    >
      <div
        {...animationProps("fade-in", { once: true })}
        data-filtered-carousel-container
        suppressHydrationWarning
      >
        {/* Filter Tabs with Arrows */}
        {showFilters && shouldShowFilters && (
          <FilterNavigation
            onPrevious={goToPrevious}
            onNext={goToNext}
            className={`mb-8 ${filterClassName}`.trim()}
          >
            <FilterTabs
              options={filterOptions}
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              show={shouldShowFilters}
              groupingField="filter"
              size={filterSize}
              showCount={filter?.showCount}
              className="px-6"
              variant="filterIcon"
            />
          </FilterNavigation>
        )}

        {ready && (
          <>
            <div
              className="relative overflow-visible w-full leading-none"
              style={{ height: `${centerH}px` }}
            >
              {filterGroups.map((group, idx) => {
                const diff = idx - groupIndex;
                const itemsLength = filterGroups.length;

                let position: "center" | "left" | "right" | "hidden" = "hidden";
                if (diff === 0) position = "center";
                else if (diff === -1 || diff === itemsLength - 1) position = "left";
                else if (diff === 1 || diff === -(itemsLength - 1)) position = "right";

                const isActiveSlide = position === "center";
                return (
                  <GroupSlide
                    key={group.key}
                    group={group}
                    isActive={isActiveSlide}
                    position={position}
                    centerW={centerW}
                    centerH={centerH}
                    sideW={sideW}
                    sideH={sideH}
                    tx={tx}
                    onSelect={() => goToGroup(idx)}
                    onCycleComplete={handleGroupCycleComplete}
                    onRegisterHandlers={isActiveSlide ? setActiveSlideHandlers : undefined}
                  />
                );
              })}

              {drag && filterGroups.length > 1 && (
                <>
                  <div
                    ref={leftZoneRef}
                    className="absolute z-30 cursor-grab touch-pan-x select-none"
                    style={baseZoneStyle(-leftZoneOffset)}
                    aria-hidden="true"
                    data-drag-zone="left"
                  />
                  <div
                    ref={rightZoneRef}
                    className="absolute z-30 cursor-grab touch-pan-x select-none"
                    style={baseZoneStyle(rightZoneOffset)}
                    aria-hidden="true"
                    data-drag-zone="right"
                  />
                </>
              )}

            </div>
          </>
        )}
      </div>
    </KeyboardNavigableContainer>
  );
}
