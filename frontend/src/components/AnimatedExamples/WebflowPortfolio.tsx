import { useState, useEffect } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface WebflowPortfolioProps {
  className?: string;
}

export default function WebflowPortfolio({
  className = "",
}: WebflowPortfolioProps) {
  const prefersReducedMotion = useMotionPreference();
  const [phase, setPhase] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  const maxScroll = 620;

  // Calculate scroll-triggered reveal progress
  const getRevealProgress = (triggerPoint: number, duration: number = 60) => {
    const progress = (scrollY - triggerPoint) / duration;
    return Math.max(0, Math.min(1, progress));
  };

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(4);
      setScrollY(maxScroll / 2);
      return;
    }

    setPhase(0);
    setScrollY(0);

    // Kinetic typography phases
    // Phase 1: First line reveals
    // Phase 2: Second line reveals
    // Phase 3: Subtitle fades in
    // Phase 4: Image appears behind text

    const phase1 = setTimeout(() => setPhase(1), 400);
    const phase2 = setTimeout(() => setPhase(2), 700);
    const phase3 = setTimeout(() => setPhase(3), 1100);
    const phase4 = setTimeout(() => setPhase(4), 1800);

    let frame: number;
    let startTime: number | null = null;
    const scrollDuration = 10000;

    const startScroll = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;

        const progress = Math.min(elapsed / scrollDuration, 1);
        // Smooth cubic easing
        const easeProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        setScrollY(easeProgress * maxScroll);

        if (progress < 1) {
          frame = requestAnimationFrame(animate);
        }
      };

      frame = requestAnimationFrame(animate);
    }, 2800);

    const resetTimer = setTimeout(() => {
      setAnimationKey((k) => k + 1);
    }, 15500);

    return () => {
      clearTimeout(phase1);
      clearTimeout(phase2);
      clearTimeout(phase3);
      clearTimeout(phase4);
      clearTimeout(startScroll);
      clearTimeout(resetTimer);
      cancelAnimationFrame(frame);
    };
  }, [animationKey, prefersReducedMotion]);

  // Section 2 parallax reveal
  const s2Reveal = getRevealProgress(100, 50);
  // Section 3 expanding image - starts when section 3 is centered in viewport (after spacer)
  // Hero (288) + Section2 (220) + Spacer (100) - viewport/2 (144) = 464
  const s3Expand = getRevealProgress(464, 150);

  return (
    <div style={{ height: '288px', maxHeight: '288px', minHeight: '288px' }}>
      <DecorativeWrapper
        className={`bg-neutral-900 rounded-lg overflow-hidden select-none pointer-events-none h-full ${className}`}
      >
        {/* Dark website viewport - fixed height on all devices */}
        <div className="bg-black rounded-lg relative overflow-hidden h-full">
          {/* Scrolling content */}
          <div
            className="absolute left-0 right-0"
            style={{ transform: `translateY(-${scrollY}px)` }}
          >
          {/* ===== HERO SECTION: Kinetic Typography ===== */}
          <div className="relative bg-black overflow-hidden" style={{ height: '288px' }}>
            {/* Background photos - 3 large squares positioned diagonally, overlapping */}
            {/* Top left square - responsive sizing, smaller on landscape mobile */}
            <div
              className="absolute overflow-hidden bg-gradient-to-br from-amber-600 to-orange-700 transition-all duration-1000 ease-out w-[140px] h-[140px] max-sm:landscape:w-[100px] max-sm:landscape:h-[100px] sm:w-[180px] sm:h-[180px] md:w-[240px] md:h-[240px]"
              style={{
                top: "0px",
                left: "0px",
                opacity: phase >= 4 ? 0.9 : 0,
                transform: `scale(${phase >= 4 ? 1 : 0.85})`,
              }}
            >
              <div className="w-full h-full bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            {/* Center square - exactly centered, responsive sizing */}
            <div
              className="absolute overflow-hidden bg-gradient-to-br from-rose-500 to-pink-700 transition-all duration-700 ease-out w-[140px] h-[140px] max-sm:landscape:w-[100px] max-sm:landscape:h-[100px] sm:w-[180px] sm:h-[180px] md:w-[240px] md:h-[240px]"
              style={{
                top: "50%",
                left: "50%",
                opacity: phase >= 3 ? 0.85 : 0,
                transform: `translate(-50%, -50%) scale(${phase >= 3 ? 1 : 0.85})`,
              }}
            >
              <div className="w-full h-full bg-gradient-to-t from-black/40 to-transparent" />
            </div>
            {/* Bottom right square - symmetrical with top left, responsive sizing */}
            <div
              className="absolute overflow-hidden bg-gradient-to-br from-sky-500 to-indigo-700 transition-all duration-1000 ease-out w-[140px] h-[140px] max-sm:landscape:w-[100px] max-sm:landscape:h-[100px] sm:w-[180px] sm:h-[180px] md:w-[240px] md:h-[240px]"
              style={{
                bottom: "0px",
                right: "0px",
                opacity: phase >= 4 ? 0.9 : 0,
                transform: `scale(${phase >= 4 ? 1 : 0.85})`,
                transitionDelay: "100ms",
              }}
            >
              <div className="w-full h-full bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Large hero text - bottom left aligned, single line, responsive */}
            <div className="absolute left-3 bottom-8 z-10">
              <div className="overflow-hidden">
                <div
                  className="text-[18px] max-sm:landscape:text-[10px] sm:text-[28px] md:text-[42px] font-light leading-none tracking-tight transition-all duration-700 ease-out text-white whitespace-nowrap"
                  style={{
                    transform: `translateY(${phase >= 1 ? 0 : 100}%)`,
                    opacity: phase >= 1 ? 1 : 0,
                  }}
                >
                  I AM EMILY AND I TAKE PHOTOS
                </div>
              </div>
            </div>

            {/* Bottom navbar - location left, socials center, menu right */}
            <div
              className="absolute bottom-0 left-3 right-3 flex items-center justify-between transition-all duration-500 z-20 pb-2"
              style={{
                opacity: phase >= 3 ? 1 : 0,
                transform: `translateY(${phase >= 3 ? 0 : 8}px)`,
              }}
            >
              {/* Location - left */}
              <span className="text-[5px] text-white/50">San Francisco, California</span>

              {/* Social media - center */}
              <div className="flex gap-2">
                <span className="text-[5px] text-white/50">Facebook</span>
                <span className="text-[5px] text-white/50">Instagram</span>
                <span className="text-[5px] text-white/50">TikTok</span>
              </div>

              {/* Menu - right */}
              <div className="flex gap-2">
                <span className="text-[5px] text-white/60">Work</span>
                <span className="text-[5px] text-white/60">About</span>
                <span className="text-[5px] text-white/60">Contact</span>
              </div>
            </div>

            {/* Logo - top left */}
            <div
              className="absolute top-2 left-3 transition-all duration-500 z-20"
              style={{
                opacity: phase >= 3 ? 1 : 0,
                transform: `translateY(${phase >= 3 ? 0 : -5}px)`,
              }}
            >
              <span className="text-[6px] text-white/40 font-medium">EC</span>
            </div>
          </div>

          {/* ===== SECTION 2: About with Letter Animation ===== */}
          <div className="h-[220px] bg-black relative">
            {/* Photo rectangle - left side, full height, 2/5 width, no margin */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[40%] overflow-hidden bg-gradient-to-br from-neutral-700 to-neutral-900 transition-all duration-700"
              style={{
                opacity: s2Reveal,
                transform: `scale(${0.95 + s2Reveal * 0.05})`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/30 to-amber-500/30" />
            </div>

            {/* Text that spans across - in front of the image, responsive */}
            <div className="absolute left-4 right-4 top-4 z-10">
              <p className="text-[10px] max-sm:landscape:text-[6px] sm:text-[12px] md:text-[14px] text-white leading-relaxed">
                {"I've spent the last decade capturing moments that matter. From intimate portraits to sprawling editorial spreads, my work focuses on authentic connection and raw emotion. Based in San Francisco, I travel worldwide for clients who value artistry over convention. Every frame tells a story — your story.".split('').map((char, i) => {
                  const charProgress = Math.max(0, Math.min(1, (s2Reveal * 75 - i * 0.2) / 20));
                  return (
                    <span
                      key={i}
                      style={{
                        opacity: charProgress,
                        transition: 'opacity 0.1s ease-out',
                      }}
                    >
                      {char}
                    </span>
                  );
                })}
              </p>
            </div>

            {/* Additional text to the right of the rectangle, responsive */}
            <div
              className="absolute left-[45%] right-4 bottom-4 flex flex-col justify-end transition-all duration-700 z-10"
              style={{
                opacity: s2Reveal,
                transform: `translateX(${(1 - s2Reveal) * 20}px)`,
              }}
            >
              <p className="text-[5px] max-sm:landscape:text-[4px] sm:text-[6px] md:text-[8px] text-white/70 leading-relaxed mb-2">
                12 years of professional photography. Over 500 clients worldwide.
              </p>
              <span className="text-[4px] max-sm:landscape:text-[3px] sm:text-[5px] md:text-[7px] text-white/90 border-b border-white/50 pb-0.5 self-start">
                About Me →
              </span>
            </div>
          </div>

          {/* ===== Spacer to push section 3 lower ===== */}
          <div className="h-[100px] bg-black" />

          {/* ===== SECTION 3: Expanding Center Image ===== */}
          <div className="bg-black relative flex items-center justify-center overflow-hidden" style={{ height: '288px' }}>
            {/* Single centered square that grows to fill the background - no side spacing */}
            <div
              className="absolute bg-gradient-to-br from-rose-500 to-pink-700"
              style={{
                width: `${60 + s3Expand * 600}px`,
                height: `${60 + s3Expand * 400}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Text overlay that fades in as image grows */}
            <div
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{
                opacity: Math.max(0, (s3Expand - 0.7) * 3),
              }}
            >
            </div>
          </div>
          </div>
        </div>
      </DecorativeWrapper>
    </div>
  );
}
