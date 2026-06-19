// src/components/AnimatedExamples/WebsitesDemo.tsx
/**
 * Websites solution demo — "wireframe → live site".
 *
 * Greyscale wireframe blocks (nav, hero, copy, CTA) snap into place, then the
 * page "renders" into a finished layout. Everything is monochrome (heading /
 * muted / bg tokens) except the CTA button, which gets the one real color pop —
 * a live site's call-to-action is exactly where colour earns its place.
 *
 * Steps: 0 empty browser · 1 nav · 2 hero+copy blocks · 3 CTA block ·
 *        4 render to finished site.
 */
import { motion } from "framer-motion";
import ExampleFrame, { useExampleSteps } from "./ExampleFrame";

// The single real-life colour pop (a site's primary CTA). Not the site accent.
const CTA = "#2f6df6";

interface Props {
  className?: string;
}

export default function WebsitesDemo({ className = "" }: Props) {
  const step = useExampleSteps([450, 1100, 1750, 2600], 5200);
  const rendered = step >= 4;

  const block = (show: boolean, delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: show ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <ExampleFrame label="Animation: a website being designed and built" className={className}>
      <div className="absolute inset-0 flex items-center justify-center p-5">
        {/* Browser chrome */}
        <div className="w-full max-w-[22rem] overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg2)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--color-border-soft)] px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-heading)]/20" />
            <span className="h-2 w-2 rounded-full bg-[var(--color-heading)]/20" />
            <span className="h-2 w-2 rounded-full bg-[var(--color-heading)]/20" />
            <span className="ml-2 h-3 flex-1 rounded bg-[var(--color-heading)]/8" />
          </div>

          {/* Page canvas */}
          <div className="relative flex flex-col gap-3 p-4" style={{ minHeight: "13rem" }}>
            {/* Nav */}
            <motion.div {...block(step >= 1)} className="flex items-center justify-between">
              <div className="h-3 w-12 rounded bg-[var(--color-heading)]/30" />
              <div className="flex gap-1.5">
                <div className="h-2 w-6 rounded bg-[var(--color-heading)]/15" />
                <div className="h-2 w-6 rounded bg-[var(--color-heading)]/15" />
                <div className="h-2 w-6 rounded bg-[var(--color-heading)]/15" />
              </div>
            </motion.div>

            {/* Hero heading */}
            <motion.div {...block(step >= 2)} className="mt-2 flex flex-col items-center gap-2">
              <div
                className={`h-4 rounded transition-all duration-500 ${
                  rendered ? "w-3/4 bg-[var(--color-heading)]/70" : "w-2/3 bg-[var(--color-heading)]/25"
                }`}
              />
              <div className="h-2.5 w-1/2 rounded bg-[var(--color-heading)]/15" />
            </motion.div>

            {/* Copy lines */}
            <motion.div {...block(step >= 2, 0.08)} className="flex flex-col items-center gap-1.5">
              <div className="h-1.5 w-4/5 rounded bg-[var(--color-heading)]/12" />
              <div className="h-1.5 w-3/5 rounded bg-[var(--color-heading)]/12" />
            </motion.div>

            {/* CTA — the one colour pop, only once "rendered" */}
            <motion.div {...block(step >= 3)} className="mt-1 flex justify-center">
              <motion.div
                className="flex h-7 w-28 items-center justify-center rounded-md"
                animate={{
                  backgroundColor: rendered ? CTA : "rgba(255,255,255,0.14)",
                }}
                transition={{ duration: 0.5 }}
              >
                <div
                  className="h-2 w-12 rounded"
                  style={{ background: rendered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}
                />
              </motion.div>
            </motion.div>

            {/* "Rendered" sheen sweep */}
            {rendered && (
              <motion.div
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[var(--color-heading)]/8 to-transparent"
              />
            )}
          </div>
        </div>
      </div>
    </ExampleFrame>
  );
}
