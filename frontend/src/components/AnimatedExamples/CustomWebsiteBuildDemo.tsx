import { useEffect, useState } from "react";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import ProcessWebsitePreview from "./ProcessWebsitePreview";

export interface CustomWebsiteBuildDemoProps {
  className?: string;
}

const sectionCards = [
  {
    title: "Homepage",
    detail: "Core message + trust",
  },
  {
    title: "Service Pages",
    detail: "Clear paths for buyers",
  },
  {
    title: "Quote Flow",
    detail: "Built around the next step",
  },
] as const;

const outcomeChips = [
  "Built around your business",
  "Cleaner conversion path",
  "Room to grow later",
] as const;

export default function CustomWebsiteBuildDemo({
  className = "",
}: CustomWebsiteBuildDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(5);
      return;
    }

    setStep(0);

    const timers: NodeJS.Timeout[] = [];
    const timings = [350, 1050, 1900, 2900, 4200];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    timers.push(
      setTimeout(() => {
        setAnimationKey((current) => current + 1);
      }, 7600),
    );

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [animationKey, prefersReducedMotion]);

  const showSections = step >= 1;
  const showFlowLine = step >= 2;
  const showBlueprint = step >= 3;
  const showFinalPreview = step >= 4;
  const showOutcomes = step >= 5;

  return (
    <DecorativeWrapper
      className={[
        "pointer-events-none h-full w-full select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex h-full min-h-[19rem] flex-col gap-4 p-4 sm:min-h-[21rem] sm:gap-5 sm:p-5 lg:min-h-[24rem] lg:gap-6 lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-full border border-soft bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text/70">
            Custom Build
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span
              className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                showFinalPreview ? "bg-primary shadow-[0_0_0_5px_rgba(99,122,255,0.12)]" : "bg-text/20"
              }`}
            />
            <span>{showFinalPreview ? "Launch-ready structure" : "Shaping the build"}</span>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="flex h-full flex-col rounded-[1.35rem] border border-soft bg-white/[0.02] p-4">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-text/50">
              Structure First
            </div>

            <div className="relative flex flex-1 flex-col gap-3">
              {sectionCards.map((card, index) => {
                const isVisible = showSections;
                const isHighlighted = showFinalPreview && index === 2;

                return (
                  <div
                    key={card.title}
                    className={[
                      "rounded-2xl border px-4 py-3 transition-all duration-500 ease-out",
                      isVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
                      isHighlighted
                        ? "border-primary/45 bg-primary/10 shadow-[0_14px_32px_rgba(99,122,255,0.12)]"
                        : "border-soft bg-[#131722]",
                    ].join(" ")}
                    style={{ transitionDelay: `${index * 140}ms` }}
                  >
                    <div className="text-sm font-semibold text-heading">{card.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-text/60">{card.detail}</div>
                  </div>
                );
              })}

              <div
                className={`absolute -right-2 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-primary/70 transition-all duration-500 lg:block ${
                  showFlowLine ? "opacity-100" : "opacity-0"
                }`}
              />
              <div
                className={`absolute -right-3.5 top-1/2 hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-500 lg:block ${
                  showFlowLine ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              />
            </div>
          </div>

          <div className="relative flex h-full min-h-[14rem] flex-col">
            <div
              className={`absolute inset-0 transition-all duration-700 ${
                showBlueprint && !showFinalPreview ? "opacity-100" : showFinalPreview ? "opacity-0" : "opacity-20"
              }`}
            >
              <ProcessWebsitePreview mode="wireframe" className="h-full w-full" />
            </div>

            <div
              className={`absolute inset-0 transition-all duration-700 ${
                showFinalPreview ? "opacity-100" : "opacity-0"
              }`}
            >
              <ProcessWebsitePreview mode="final" className="h-full w-full" />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {outcomeChips.map((chip, index) => (
            <div
              key={chip}
              className={[
                "rounded-full border px-3 py-2 text-center text-[11px] font-medium transition-all duration-500",
                showOutcomes ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                index === 1
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-soft bg-white/[0.02] text-text/62",
              ].join(" ")}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    </DecorativeWrapper>
  );
}
