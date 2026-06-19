// src/components/AnimatedExamples/ExampleFrame.tsx
/**
 * ExampleFrame — shared shell for the solutions' animated examples.
 *
 * Ports the Griffin's Web Services accessibility pattern onto this project's
 * primitives:
 *   - wraps content in DecorativeWrapper (aria-hidden, removed from tab order —
 *     these are illustrative, not interactive),
 *   - pointer-events-none / select-none so they never trap input,
 *   - exposes a looping step-machine via `useExampleSteps`, and
 *   - honours useMotionPreference(): when reduced motion is on, the demo jumps
 *     straight to its final resting step and never animates.
 *
 * Each demo declares its step timings; the visuals are Framer Motion driven off
 * the current step. Keeps every example consistent + accessible by construction.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";
import DecorativeWrapper from "@/integrations/preferences/accessibility/ui/DecorativeWrapper";

/**
 * Drives a looping step sequence.
 * @param timings  ms offsets at which to advance to step 1, 2, 3, … (step 0 is
 *                 the start). e.g. [400, 1200, 2200] → 4 steps total (0..3).
 * @param loopAfter ms after the last step at which to reset to step 0 and loop.
 * @returns the current step index. On reduced motion it is pinned to the final
 *          step (timings.length) and never advances.
 */
export function useExampleSteps(timings: number[], loopAfter: number): number {
  const reduced = useMotionPreference();
  const finalStep = timings.length;
  const [step, setStep] = useState(reduced ? finalStep : 0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) {
      setStep(finalStep);
      return;
    }
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timings.forEach((delay, i) => {
      timers.push(setTimeout(() => setStep(i + 1), delay));
    });
    timers.push(setTimeout(() => setCycle((c) => c + 1), loopAfter));
    return () => timers.forEach(clearTimeout);
  }, [reduced, cycle, finalStep, loopAfter]);

  return step;
}

interface Props {
  children: ReactNode;
  /** Accessible summary for assistive tech (the frame is otherwise decorative). */
  label?: string;
  className?: string;
}

export default function ExampleFrame({ children, label, className = "" }: Props) {
  return (
    <DecorativeWrapper
      className={`pointer-events-none relative h-full w-full select-none overflow-hidden ${className}`}
    >
      {label && <span className="sr-only">{label}</span>}
      {children}
    </DecorativeWrapper>
  );
}
