import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface SearchRankingDemoProps {
  className?: string;
}

type SearchResult = {
  title: string;
  url: string;
  description: string;
};

const secondaryOrganicResult: SearchResult = {
  title: "Another Company | Service Overview",
  url: "anothercompany.com/services",
  description: "A standard organic result with general business information.",
};

const primaryOrganicResult: SearchResult = {
  title: "Your Company | Trusted Service Partner",
  url: "yourcompany.com",
  description:
    "Clear messaging and a strong next step make your company the result people choose.",
};

export default function SearchRankingDemo({
  className = "",
}: SearchRankingDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(prefersReducedMotion ? 4 : 0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(4);
      return;
    }

    setStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const loadingStart = 300;
    const resultsStart = loadingStart + 750;
    const highlightStart = resultsStart + 1100;
    const clickStart = highlightStart + 850;
    const resetStart = clickStart + 2100;

    timers.push(setTimeout(() => setStep(1), loadingStart));
    timers.push(setTimeout(() => setStep(2), resultsStart));
    timers.push(setTimeout(() => setStep(3), highlightStart));
    timers.push(setTimeout(() => setStep(4), clickStart));
    timers.push(
      setTimeout(() => {
        setAnimationKey((current) => current + 1);
      }, resetStart),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [animationKey, prefersReducedMotion]);

  const showLoading = step === 1;
  const showResults = step >= 2;
  const highlighted = step >= 3;
  const clicked = step >= 4;
  const showCursor = !prefersReducedMotion && showResults;

  const cursorTop = highlighted ? 96 : 144;
  const statusLabel =
    step >= 4
      ? "People click your result"
      : step >= 3
        ? "Your company stands out organically"
        : step >= 2
          ? "Results populate"
          : "Search visibility demo";

  return (
    <DecorativeWrapper
      className={`pointer-events-none w-full select-none ${className}`}
    >
      <div className="relative mx-auto w-full max-w-[31rem] overflow-hidden rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,122,255,0.16),transparent_42%),linear-gradient(180deg,#111626,#0b1020)] shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:4.5rem_4.5rem]" />

        <div className="relative border-b border-white/8 bg-white/4 px-3 py-3">
          <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.16em] text-text/40">
            <span>Search Results</span>
            <span className="flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  showLoading
                    ? "bg-primary animate-pulse"
                    : showResults
                      ? "bg-emerald-400"
                      : "bg-white/15"
                }`}
              />
              {statusLabel}
            </span>
          </div>

          <p className="mt-2 max-w-[18rem] text-[0.72rem] leading-relaxed text-text/62">
            Strong organic content makes it obvious that this is your business and why someone should click.
          </p>
        </div>

        <div className="relative h-[13.5rem] px-3 pb-3 pt-3">
          <div className="mb-2 text-[0.64rem] text-text/50">
            Relevant local results
          </div>

          {showLoading && (
            <div className="space-y-2.5">
              {["First result", "Supporting result"].map((label) => (
                <div
                  key={label}
                  className="overflow-hidden rounded-[1rem] border border-white/7 bg-white/[0.035] px-3 py-2.5"
                >
                  <div className="mb-2 text-[0.55rem] uppercase tracking-[0.16em] text-text/35">
                    {label}
                  </div>
                  <div className="mb-2 h-2 w-24 rounded-full bg-white/10 animate-pulse" />
                  <div className="mb-2 h-3 w-[70%] rounded-full bg-primary/20 animate-pulse" />
                  <div className="h-2 w-[58%] rounded-full bg-white/8 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {showResults && (
            <div className="relative space-y-2.5">
                <div
                  className={`relative rounded-[1rem] border px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.2)] transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
                    highlighted
                      ? "border-primary/35 bg-[linear-gradient(180deg,rgba(99,122,255,0.18),rgba(18,24,44,0.95))]"
                      : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,20,37,0.94))]"
                  }`}
                  style={{
                    transform: `scale(${clicked ? 1.015 : highlighted ? 1.01 : 1})`,
                  }}
                >
                  <div className="mb-1.5 flex items-center justify-between text-[0.55rem] uppercase tracking-[0.16em] text-text/35">
                    <span>Top organic result</span>
                    {highlighted && (
                      <span className="rounded-full border border-primary/25 bg-primary/18 px-2 py-0.5 text-[0.54rem] font-medium tracking-[0.14em] text-primary">
                        Your result
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8">
                      <Icon icon="lucide:star" size="sm" className="text-primary" />
                    </div>
                    <div className="min-w-0 pr-8">
                      <p className="truncate text-[0.68rem] text-text/58">
                        {primaryOrganicResult.url}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[0.8rem] leading-tight text-[#8ea2ff]">
                        {primaryOrganicResult.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[0.66rem] leading-relaxed text-text/60">
                        {primaryOrganicResult.description}
                      </p>

                      <div className="mt-1">
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.12em] text-emerald-300">
                          Clear CTA + local match
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1rem] border border-white/6 bg-white/[0.02] px-3 py-1">
                  <div className="flex items-center justify-between text-[0.52rem] uppercase tracking-[0.16em] text-text/30">
                    <span>More results</span>
                    <span>Supporting visibility</span>
                  </div>
                </div>

                <div
                  className="relative rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,20,37,0.94))] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.2)]"
                >
                  <div className="mb-1.5 flex items-center justify-between text-[0.55rem] uppercase tracking-[0.16em] text-text/35">
                    <span>Another organic result</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8">
                      <Icon icon="lucide:globe" size="sm" className="text-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[0.68rem] text-text/58">
                        {secondaryOrganicResult.url}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[0.8rem] leading-tight text-[#89a0ff]/88">
                        {secondaryOrganicResult.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[0.66rem] leading-relaxed text-text/60">
                        {secondaryOrganicResult.description}
                      </p>
                    </div>
                  </div>
                </div>

              {showCursor && (
                <div
                  className="absolute left-[84%] z-20 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                  style={{
                    top: cursorTop,
                    transform: `translate(-50%, -50%) scale(${clicked ? 0.84 : 1})`,
                  }}
                >
                  <svg
                    className={`h-5 w-5 drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] ${
                      clicked ? "rotate-6" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M4 4l16 8-7 2-2 7L4 4z"
                      className={clicked ? "text-primary" : "text-white"}
                    />
                  </svg>

                  {clicked && (
                    <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/40 bg-primary/10 animate-ping" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DecorativeWrapper>
  );
}
