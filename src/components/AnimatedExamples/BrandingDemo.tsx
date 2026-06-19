// src/components/AnimatedExamples/BrandingDemo.tsx
/**
 * Branding solution demo — "identity system assembling".
 *
 * A monogram mark draws itself (SVG stroke), a type specimen settles, then the
 * brand palette flips in. The palette swatches are the ONLY real colour in the
 * whole set — which is the point: branding is literally where colour lives. The
 * mark, type, and frame stay monochrome so the swatches read as the payload.
 *
 * Steps: 0 empty · 1 mark draws · 2 wordmark + specimen · 3 palette swatches.
 */
import { motion } from "framer-motion";
import ExampleFrame, { useExampleSteps } from "./ExampleFrame";

// Real palette swatches — the sole colour in the demo (a brand's actual palette).
const SWATCHES = ["#1f2a44", "#e2b659", "#c8553d", "#8aa399", "#efe9dd"];

interface Props {
  className?: string;
}

export default function BrandingDemo({ className = "" }: Props) {
  const step = useExampleSteps([500, 1500, 2400], 5400);

  return (
    <ExampleFrame label="Animation: a brand identity and palette being designed" className={className}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6">
        {/* Monogram mark — draws its stroke */}
        <svg viewBox="0 0 100 100" className="h-20 w-20" fill="none">
          <motion.path
            d="M22 78 V30 L50 58 L78 30 V78"
            stroke="var(--color-heading)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={step >= 1 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
          <motion.circle
            cx="50" cy="20" r="5"
            fill="var(--color-heading)"
            initial={{ scale: 0 }}
            animate={step >= 1 ? { scale: 1 } : { scale: 0 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 320, damping: 18 }}
          />
        </svg>

        {/* Wordmark + type specimen */}
        <motion.div
          className="flex flex-col items-center gap-1.5"
          initial={{ opacity: 0, y: 10 }}
          animate={step >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-sm font-medium tracking-[0.32em] text-[var(--color-heading)]">
            MAXX
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-[var(--color-heading)]/35">
            Aa · Identity system
          </span>
        </motion.div>

        {/* Palette swatches — the only real colour */}
        <div className="flex items-center gap-2">
          {SWATCHES.map((c, i) => (
            <motion.span
              key={c}
              className="h-8 w-8 rounded-md border border-[var(--color-heading)]/10"
              style={{ background: c }}
              initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
              animate={
                step >= 3
                  ? { opacity: 1, scale: 1, rotate: 0 }
                  : { opacity: 0, scale: 0.4, rotate: -12 }
              }
              transition={{
                delay: step >= 3 ? i * 0.09 : 0,
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
            />
          ))}
        </div>
      </div>
    </ExampleFrame>
  );
}
