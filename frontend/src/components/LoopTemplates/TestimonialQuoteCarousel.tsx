// src/components/LoopTemplates/TestimonialQuoteCarousel.tsx
import { useEffect, useRef, useState } from "react";
import type { TestimonialItemData } from "@/components/LoopComponents/TestimonialCard";
import useCarouselAutoplay from "@/components/Carousels/useCarouselAutoplay";
import { useKeyboardInteraction } from "@/hooks/interactions/useKeyboardInteraction";

interface TestimonialQuoteCarouselProps {
  items?: TestimonialItemData[];
  autoAdvanceDelay?: number;
  className?: string;
  quoteClassName?: string;
  authorClassName?: string;
}

export default function TestimonialQuoteCarousel({
  items = [],
  autoAdvanceDelay = 6000,
  className = "",
  quoteClassName = "",
  authorClassName = "",
}: TestimonialQuoteCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const [fading, setFading] = useState(false);

  const count = items.length;

  useCarouselAutoplay({
    containerRef,
    totalItems: count,
    currentIndex: activeIndex,
    setIndex: setActiveIndex,
    autoplay: count > 1,
    autoplayTime: autoAdvanceDelay,
    threshold: 0.2,
    resumeDelay: 5000,
    resumeTriggers: ["scroll", "hover-away"],
    pauseOnEngage: true,
    engageOnlyOnActiveItem: false,
  });

  useKeyboardInteraction({
    elementRef: containerRef,
    requireFocus: true,
    onArrowLeft: () => setActiveIndex((i) => (i === 0 ? count - 1 : i - 1)),
    onArrowRight: () => setActiveIndex((i) => (i === count - 1 ? 0 : i + 1)),
  });

  useEffect(() => {
    if (count <= 1) return;
    setFading(true);
    const timer = setTimeout(() => {
      setDisplayed(activeIndex);
      setFading(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [activeIndex, count]);

  if (!count) return null;

  const item = items[displayed];
  const quote = item.description ?? "";
  const author = item.author ?? item.title ?? "Happy Client";
  const roleParts = [item.role, item.company].filter(Boolean).join(", ");
  const rating = Math.max(1, Math.min(5, item.rating ?? 5));

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`.trim()}
      tabIndex={count > 1 ? 0 : undefined}
      role={count > 1 ? "region" : undefined}
      aria-label={count > 1 ? "Testimonials. Use arrow keys to navigate." : undefined}
      aria-roledescription={count > 1 ? "carousel" : undefined}
    >
      <div
        style={{
          opacity: fading ? 0 : 1,
          transition: "opacity 220ms ease",
        }}
      >
        <div className="mb-4 flex gap-1">
          {Array.from({ length: rating }).map((_, i) => (
            <svg
              key={i}
              className="h-4 w-4 fill-current text-accent"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        <p className={`italic leading-[1.08] ${quoteClassName}`.trim()}>
          &ldquo;{quote}&rdquo;
        </p>

        <div className={`mt-8 flex flex-col gap-1 ${authorClassName}`.trim()}>
          <p className="text-[1.6rem] font-semibold uppercase leading-[1.05] tracking-[0.12em] text-primary-light max-lg:text-[1.3rem]">
            {author}
          </p>
          {roleParts && (
            <p className="text-[1.08rem] leading-[1.2] dark:text-text light:text-accent">
              {roleParts}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
