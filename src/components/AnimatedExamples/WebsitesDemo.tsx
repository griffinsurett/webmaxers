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
import { motion, AnimatePresence } from "framer-motion";
import ExampleFrame, { useExampleSteps } from "./ExampleFrame";

// The single real-life colour pop (a site's primary CTA). Not the site accent.
const CTA = "#2f6df6";

export interface DemoProject {
  title: string;
  thumb?: string;
  alt?: string;
}

interface Props {
  className?: string;
  /** Real featured projects (queried in the Astro wrapper) shown as the
   *  demo's opening frame before the wireframe→live-site build plays. */
  projects?: DemoProject[];
}

export default function WebsitesDemo({ className = "", projects = [] }: Props) {
  // Step timeline: an extra opening beat (the real projects) when we have them,
  // then the wireframe build. INTRO holds for ~1.4s, then the build runs.
  const hasIntro = projects.length > 0;
  const step = useExampleSteps([450, 1100, 1750, 2600], 5200);
  // While `intro` is true we show the 2 real projects; it ends as the build
  // begins (step >= 1) so the first thing the viewer sees is real work.
  const showIntro = hasIntro && step < 1;
  const rendered = step >= 4;

  const block = (show: boolean, delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: show ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <ExampleFrame label="Animation: a website being designed and built" className={className}>
      {/* Opening frame: 2 real featured projects, then it crossfades into the
          wireframe→live-site build below. */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10 flex items-center justify-center gap-3 p-5"
          >
            {projects.slice(0, 2).map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 * i }}
                className="flex-1 overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg2)]"
              >
                <div className="aspect-[16/11] w-full overflow-hidden bg-[var(--color-heading)]/8">
                  {p.thumb && (
                    <img
                      src={p.thumb}
                      alt={p.alt ?? ""}
                      loading="lazy"
                      decoding="async"
                      className="block h-full w-full object-cover object-top"
                    />
                  )}
                </div>
                <p className="truncate px-2.5 py-2 text-[0.7rem] font-medium text-[var(--color-heading)]/80">
                  {p.title}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
