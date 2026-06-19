// src/components/AnimatedExamples/AiAgentsDemo.tsx
/**
 * AI Agents solution demo — "chat that performs a task".
 *
 * A user request appears, the agent shows a thinking indicator, then instead of
 * merely replying it RUNS a tool ("Booking…") which resolves to a ✓ result card
 * — the differentiator: agents that act, not just chat. Everything is monochrome
 * except the success check, which gets the one real colour pop (a real success
 * green) because that's the meaningful state change.
 *
 * Steps: 0 empty · 1 user msg · 2 thinking dots · 3 tool running · 4 ✓ result.
 */
import { motion } from "framer-motion";
import ExampleFrame, { useExampleSteps } from "./ExampleFrame";

const SUCCESS = "#3ba55d"; // real success green — the sole colour pop

interface Props {
  className?: string;
}

export default function AiAgentsDemo({ className = "" }: Props) {
  const step = useExampleSteps([500, 1300, 2100, 3200], 5600);

  const bubble = {
    initial: { opacity: 0, y: 12, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <ExampleFrame label="Animation: an AI agent performing a task from a chat request" className={className}>
      <div className="absolute inset-0 flex flex-col justify-center gap-2.5 p-5">
        {/* User request */}
        {step >= 1 && (
          <motion.div {...bubble} className="self-end">
            <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-[var(--color-heading)]/12 px-3 py-2">
              <div className="h-1.5 w-28 rounded bg-[var(--color-heading)]/45" />
              <div className="mt-1.5 h-1.5 w-20 rounded bg-[var(--color-heading)]/30" />
            </div>
          </motion.div>
        )}

        {/* Agent: thinking → tool run → result */}
        {step >= 2 && (
          <motion.div {...bubble} className="self-start">
            <div className="flex min-w-[10rem] flex-col gap-2 rounded-2xl rounded-bl-sm border border-[var(--color-border-soft)] bg-[var(--color-bg2)] px-3 py-2.5">
              {/* Thinking dots (only before the tool starts) */}
              {step === 2 && (
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[var(--color-heading)]/45"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                    />
                  ))}
                </div>
              )}

              {/* Tool-call chip */}
              {step >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg3)] px-2 py-1.5"
                >
                  {step === 3 ? (
                    <motion.span
                      className="h-3 w-3 rounded-full border-2 border-[var(--color-heading)]/25 border-t-[var(--color-heading)]/70"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 360, damping: 16 }}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ background: SUCCESS }}
                    >
                      <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.span>
                  )}
                  <span className="text-[0.6rem] font-medium tracking-wide text-[var(--color-heading)]/70">
                    {step === 3 ? "Booking appointment…" : "Appointment booked"}
                  </span>
                </motion.div>
              )}

              {/* Result line after success */}
              {step >= 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col gap-1"
                >
                  <div className="h-1.5 w-24 rounded bg-[var(--color-heading)]/35" />
                  <div className="h-1.5 w-16 rounded bg-[var(--color-heading)]/20" />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </ExampleFrame>
  );
}
