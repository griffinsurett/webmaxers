import { useEffect, useState } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

export interface WebsitePlanningDemoProps {
  className?: string;
}

type NoteConfig = {
  id: string;
  label: string;
  detail?: string;
  appearAt: number;
  finalClassName: string;
  draftClassName: string;
  tone?: "yellow" | "blue" | "green" | "pink";
};

const toneClasses: Record<NonNullable<NoteConfig["tone"]>, string> = {
  yellow: "bg-[#FFF7CF] border-[#E8DFA6]",
  blue: "bg-[#E8F2FF] border-[#BED8FF]",
  green: "bg-[#E4F6E7] border-[#B7DEBC]",
  pink: "bg-[#FFE8F0] border-[#F4BED0]",
};

const notes: NoteConfig[] = [
  {
    id: "homepage",
    label: "Homepage",
    detail: "First impression",
    appearAt: 1,
    draftClassName: "left-3 top-4 rotate-[-4deg]",
    finalClassName: "left-4 top-5",
    tone: "yellow",
  },
  {
    id: "services",
    label: "Services",
    detail: "What you offer",
    appearAt: 1,
    draftClassName: "left-[6.25rem] top-10 rotate-[3deg]",
    finalClassName: "left-[6.7rem] top-5",
    tone: "blue",
  },
  {
    id: "trust",
    label: "Trust",
    detail: "Proof + reviews",
    appearAt: 1,
    draftClassName: "left-[2.35rem] top-[4.9rem] rotate-[-2deg]",
    finalClassName: "left-[4.1rem] top-[4.8rem]",
    tone: "green",
  },
  {
    id: "fit",
    label: "Right fit",
    detail: "Who it's for",
    appearAt: 2,
    draftClassName: "right-4 top-6 rotate-[5deg]",
    finalClassName: "left-[12.5rem] top-5",
    tone: "pink",
  },
  {
    id: "call",
    label: "Book a Call",
    detail: "Clear next step",
    appearAt: 5,
    draftClassName: "right-4 bottom-6 rotate-[-3deg]",
    finalClassName: "left-[12.9rem] top-[4.8rem]",
    tone: "blue",
  },
];

export default function WebsitePlanningDemo({ className = "" }: WebsitePlanningDemoProps) {
  const prefersReducedMotion = useMotionPreference();
  const [step, setStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setStep(6);
      return;
    }

    setStep(0);

    const timings = [500, 1300, 2400, 3600, 4700, 5600];
    const timers: NodeJS.Timeout[] = [];

    timings.forEach((delay, index) => {
      timers.push(setTimeout(() => setStep(index + 1), delay));
    });

    timers.push(
      setTimeout(() => {
        setAnimationKey((key) => key + 1);
      }, 7600),
    );

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [animationKey, prefersReducedMotion]);

  const showFlow = step >= 4;
  const showCallHighlight = step >= 5;
  const showReadyState = step >= 6;

  return (
    <DecorativeWrapper
      className={`w-full rounded-2xl overflow-hidden faded-border bg-text/10 select-none pointer-events-none ${className}`}
    >
      <div className="bg-gradient-to-br from-[#F8F5EE] via-[#F3EFE6] to-[#ECE7DD] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="rounded-full border border-[#D7D0C5] bg-white/85 px-2.5 py-1 text-[9px] font-semibold tracking-[0.16em] text-[#5E584F] uppercase">
            Planning Board
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-[#7A7368]">
            <span className={`h-1.5 w-1.5 rounded-full ${showReadyState ? "bg-[#637AFF]" : "bg-[#B8B1A7]"}`} />
            <span>{showReadyState ? "Clear path ready" : "Ideas in progress"}</span>
          </div>
        </div>

        <div className="relative h-[11rem] overflow-hidden rounded-[1.15rem] border border-[#D7D0C5] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,242,234,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(131,120,102,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(131,120,102,0.08)_1px,transparent_1px)] [background-size:1.2rem_1.2rem]" />

          {notes.map((note) => {
            const isVisible = step >= note.appearAt;
            const isInFinalFlow = step >= 3;
            const isCallout = note.id === "call";
            const currentClassName = isInFinalFlow ? note.finalClassName : note.draftClassName;
            const toneClass = toneClasses[note.tone ?? "yellow"];

            return (
              <div
                key={note.id}
                className={[
                  "absolute w-[5.55rem] rounded-xl border p-2 shadow-[0_10px_24px_rgba(52,44,31,0.12)] transition-all duration-500 ease-out",
                  toneClass,
                  currentClassName,
                  isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95",
                  isCallout && showCallHighlight
                    ? "ring-2 ring-[#637AFF] shadow-[0_0_0_1px_rgba(99,122,255,0.18),0_14px_30px_rgba(99,122,255,0.18)]"
                    : "",
                ].join(" ")}
              >
                <div className="text-[10px] font-semibold leading-none text-[#2E2A23]">
                  {note.label}
                </div>
                {note.detail && (
                  <div className="mt-1 text-[8px] leading-[1.25] text-[#5C554B]">
                    {note.detail}
                  </div>
                )}
              </div>
            );
          })}

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 176" fill="none">
            <path
              d="M72 40C110 40 96 88 132 88"
              stroke="rgba(99,122,255,0.8)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={showFlow ? "120 0" : "0 120"}
              className="transition-all duration-700"
            />
            <path
              d="M174 40C212 40 198 88 234 88"
              stroke="rgba(99,122,255,0.8)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={showFlow ? "120 0" : "0 120"}
              className="transition-all duration-700 delay-150"
            />
            <path
              d="M132 88H234"
              stroke="rgba(99,122,255,0.8)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={showFlow ? "120 0" : "0 120"}
              className="transition-all duration-700 delay-300"
            />
            {showFlow && (
              <>
                <path d="M228 83L238 88L228 93" stroke="rgba(99,122,255,0.95)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="132" cy="88" r="4" fill="rgba(99,122,255,0.85)" />
              </>
            )}
          </svg>

          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-3">
            <div className="rounded-full border border-[#D7D0C5] bg-white/80 px-2.5 py-1 text-[9px] font-medium text-[#5D564B]">
              Ideas first, path second
            </div>
            <div
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold transition-all duration-300 ${
                showCallHighlight
                  ? "bg-[#637AFF] text-white shadow-[0_10px_24px_rgba(99,122,255,0.28)]"
                  : "bg-white/80 text-[#5D564B] border border-[#D7D0C5]"
              }`}
            >
              {showCallHighlight ? "Book a Call" : "Choose next step"}
            </div>
          </div>
        </div>
      </div>
    </DecorativeWrapper>
  );
}
