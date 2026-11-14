import { useEffect, useState } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";
import ProcessWebsitePreview from "./ProcessWebsitePreview";

export interface DesignMessagingDemoProps {
  className?: string;
}

const draggablePieces = [
  {
    id: "headline",
    label: "Heading",
    draftClassName: "left-4 top-[2.35rem]",
    targetClassName: "left-1/2 top-[3.75rem] -translate-x-1/2",
  },
  {
    id: "button",
    label: "Button",
    draftClassName: "right-4 top-[3.9rem]",
    targetClassName: "left-1/2 top-[7.5rem] -translate-x-1/2",
  },
  {
    id: "trust",
    label: "Trust",
    draftClassName: "left-5 bottom-4",
    targetClassName: "left-1/2 top-[8.95rem] -translate-x-1/2",
  },
];

export default function DesignMessagingDemo({
  className = "",
}: DesignMessagingDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(4);
      return;
    }

    setStep(0);

    const timings = [350, 1200, 2350, 3600];
    const timers: NodeJS.Timeout[] = [];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    timers.push(
      setTimeout(() => {
        setAnimationKey((current) => current + 1);
      }, 6200),
    );

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [animationKey, prefersReducedMotion]);

  const showCanvas = step >= 1;
  const showPieces = step >= 2;
  const showDropTargets = step >= 3;
  const showFinishedWebsite = step >= 4;

  return (
    <DecorativeWrapper
      className={`pointer-events-none w-full select-none ${className}`}
    >
      <div className="relative h-[11rem] overflow-hidden rounded-[1.15rem] border border-white/14 bg-[#13192B]">
        <div
          className={`absolute inset-0 transition-all duration-700 ${
            showCanvas ? "opacity-100" : "opacity-0"
          } ${showFinishedWebsite ? "opacity-0" : "opacity-100"}`}
        >
          <ProcessWebsitePreview mode="wireframe" />

          {showDropTargets && (
            <>
              <div className="absolute left-1/2 top-[3.95rem] h-6 w-[7.25rem] -translate-x-1/2 rounded-full border border-dashed border-soft-strong" />
              <div className="absolute left-1/2 top-[7.35rem] h-7 w-[5.5rem] -translate-x-1/2 rounded-full border border-dashed border-soft-strong" />
              <div className="absolute left-1/2 top-[8.95rem] h-4 w-[7.5rem] -translate-x-1/2 rounded-full border border-dashed border-soft" />
            </>
          )}

          {draggablePieces.map((piece) => (
            <div
              key={piece.id}
              className={[
                "absolute rounded-full border border-soft-strong bg-[#1A2240] px-3 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition-all duration-700",
                showPieces ? "opacity-100" : "opacity-0",
                showDropTargets ? piece.targetClassName : piece.draftClassName,
              ].join(" ")}
            >
              {piece.label}
            </div>
          ))}
        </div>

        <div
          className={`absolute inset-0 transition-all duration-700 ${
            showFinishedWebsite ? "opacity-100" : "opacity-0"
          }`}
        >
          <ProcessWebsitePreview mode="final" />
        </div>
      </div>
    </DecorativeWrapper>
  );
}
