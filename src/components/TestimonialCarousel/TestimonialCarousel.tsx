import { useState, useEffect, useCallback, useRef } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company?: string;
  imageSrc?: string;
  imageAlt?: string;
}

interface Props {
  items: TestimonialItem[];
  autoPlayInterval?: number;
}

export default function TestimonialCarousel({ items, autoPlayInterval = 6000 }: Props) {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useMotionPreference();

  const total = items.length;

  const goTo = useCallback(
    (index: number, dir: "next" | "prev" = "next") => {
      if (animating || index === active) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(
        () => {
          setActive(index);
          setAnimating(false);
        },
        reduceMotion ? 0 : 380,
      );
    },
    [active, animating, reduceMotion],
  );

  const next = useCallback(() => goTo((active + 1) % total, "next"), [active, goTo, total]);
  const prev = useCallback(() => goTo((active - 1 + total) % total, "prev"), [active, goTo, total]);

  useEffect(() => {
    if (!autoPlayInterval) return;
    timerRef.current = setTimeout(next, autoPlayInterval);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active, next, autoPlayInterval]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    },
    [next, prev],
  );

  const current = items[active];
  if (!current) return null;

  const pad = (n: number) => String(n + 1).padStart(2, "0");
  const animClass = animating ? `--out-${direction}` : "--in";

  return (
    <section
      className="tc-root"
      aria-label="Client testimonials"
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
    >
      <div className="tc-inner">
        {/* Quote block — image floats left, text wraps around it */}
        <div className={`tc-quote-wrap tc-quote-wrap${animClass}`}>
          {current.imageSrc ? (
            <img
              key={current.id + "-img"}
              src={current.imageSrc}
              alt={current.imageAlt ?? current.author}
              className="tc-float-img"
              width={144}
              height={144}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="tc-float-img tc-float-initials" aria-hidden="true">
              {current.author.charAt(0)}
            </div>
          )}

          <blockquote
            className="tc-quote"
            aria-live="polite"
            aria-atomic="true"
          >
            {`“${current.quote}”`}
          </blockquote>

          {/* clearfix so footer sits below the float */}
          <div className="tc-clear" aria-hidden="true" />
        </div>

        {/* Footer: attribution left, nav right */}
        <footer className="tc-footer">
          <div className={`tc-attribution tc-attribution${animClass}`}>
            <span className="tc-author">{current.author}</span>
            <span className="tc-sep" aria-hidden="true" />
            <span className="tc-role">{current.role}</span>
            {current.company && (
              <>
                <span className="tc-dot" aria-hidden="true">·</span>
                <span className="tc-company">{current.company}</span>
              </>
            )}
          </div>

          <nav className="tc-nav" aria-label="Testimonial navigation">
            <button onClick={prev} className="tc-arrow" aria-label="Previous testimonial" disabled={animating}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>

            <ol className="tc-dots" role="tablist">
              {items.map((t, i) => (
                <li key={t.id} role="presentation">
                  <button
                    role="tab"
                    aria-selected={i === active}
                    aria-label={`Testimonial ${i + 1}: ${t.author}`}
                    className={`tc-dot-btn${i === active ? " tc-dot-btn--active" : ""}`}
                    onClick={() => goTo(i, i > active ? "next" : "prev")}
                    disabled={animating}
                  >
                    <span aria-hidden="true">{pad(i)}</span>
                  </button>
                </li>
              ))}
            </ol>

            <button onClick={next} className="tc-arrow" aria-label="Next testimonial" disabled={animating}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </nav>
        </footer>
      </div>
    </section>
  );
}
