'use client';

import { useEffect, useRef, useState } from 'react';
import { splitIntoLetters } from '@/utils/letterByLetter';

interface ScrollRevealAboutSectionProps {
  statement?: string;
  ctaText?: string;
  ctaLink?: string;
}

export default function ScrollRevealAboutSection({
  statement = "Webmaxers is an independent digital studio crafting meaningful brand experiences through strategy, design, and technology.",
  ctaText = "Explore Our Story",
  ctaLink = "/about-us",
}: ScrollRevealAboutSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [letters, setLetters] = useState<ReturnType<typeof splitIntoLetters>>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const splitLetters = splitIntoLetters(statement, {
      staggerDelay: 25,
    });
    setLetters(splitLetters);
  }, [statement]);

  useEffect(() => {
    if (!containerRef.current || !textRef.current || !triggerRef.current || letters.length === 0) return;

    const textElement = textRef.current;
    const trigger = triggerRef.current;

    // Total scroll distance needed for animation
    const totalDuration = letters.length * 25; // stagger delay

    const handleScroll = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate progress based on trigger position
      // Animation starts when trigger enters viewport (from bottom)
      // Animation ends when trigger leaves viewport (at top)
      const triggerCenter = triggerRect.top + triggerRect.height / 2;
      const startPoint = windowHeight;
      const endPoint = -triggerRect.height;

      let progress = (startPoint - triggerCenter) / (startPoint - endPoint);
      progress = Math.max(0, Math.min(1, progress));

      const animating = progress > 0 && progress < 1;
      setIsAnimating(animating);

      // Update each letter's opacity
      letters.forEach((letter) => {
        const letterEl = textElement.querySelector(
          `[data-letter-index="${letter.index}"]`
        ) as HTMLElement;

        if (letterEl) {
          // Calculate this letter's reveal point based on stagger
          const letterProgress = (progress * totalDuration - letter.delay) / (totalDuration * 0.6);
          const opacity = Math.max(0, Math.min(1, letterProgress));

          letterEl.style.opacity = String(opacity);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [letters]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isAnimating) {
      containerRef.current.style.position = 'sticky';
      containerRef.current.style.top = '0';
      containerRef.current.style.height = '100vh';
      containerRef.current.style.display = 'flex';
      containerRef.current.style.alignItems = 'center';
      containerRef.current.style.zIndex = '40';
    } else {
      containerRef.current.style.position = 'relative';
      containerRef.current.style.top = 'auto';
      containerRef.current.style.height = 'auto';
      containerRef.current.style.display = 'block';
      containerRef.current.style.zIndex = 'auto';
    }
  }, [isAnimating]);

  if (letters.length === 0) {
    return null;
  }

  return (
    <>
      <div ref={triggerRef} style={{ height: '100vh', pointerEvents: 'none' }} />

      <div
        ref={containerRef}
        className="w-full px-6 md:px-[80px] bg-black overflow-hidden"
        style={{
          position: 'sticky',
          top: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="flex gap-12 md:gap-16 w-full py-20 md:py-32">
          {/* Left: Title */}
          <div className="shrink-0">
            <h2 className="text-lg font-light tracking-widest uppercase text-zinc-400">
              About
            </h2>
          </div>

          {/* Right: Statement and CTA */}
          <div className="flex-1 max-w-4xl">
            <p
              ref={textRef}
              className="text-[clamp(2.5rem,7vw,4.5rem)] font-light leading-[1.1] mb-12 md:mb-16"
              style={{
                color: 'rgba(113, 113, 122, 0.8)',
              }}
            >
              {letters.map((letter) => (
                <span
                  key={`${letter.index}-${letter.char}`}
                  data-letter-index={letter.index}
                  style={{
                    display: letter.isSpace ? 'inline' : 'inline',
                    whiteSpace: letter.isSpace ? 'pre' : 'normal',
                    opacity: 0.1,
                    color: 'rgb(255, 255, 255)',
                    willChange: 'opacity',
                  }}
                >
                  {letter.char}
                </span>
              ))}
            </p>

            <a
              href={ctaLink}
              className="group inline-flex items-center justify-between gap-8 text-[11px] font-medium tracking-[0.18em] uppercase text-zinc-400 border-b border-zinc-400 pb-[6px] hover:text-white hover:border-white transition-colors duration-200"
            >
              {ctaText}
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Spacer for scroll distance */}
      <div style={{ height: `${letters.length * 25}px` }} />
    </>
  );
}
