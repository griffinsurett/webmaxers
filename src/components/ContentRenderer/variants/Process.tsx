// src/components/ContentRenderer/variants/Process.tsx
/**
 * Process — React island for the "Our Process" / "How we work" section body.
 *
 * Renders the steps grid + the rail (track, drawn line, checkpoint markers, and
 * a travelling spinning logo) and owns the pinned-scrub GSAP timeline:
 *   - a single logo travels left→right along the bottom rail,
 *   - a connector line draws in behind it (line width follows the logo),
 *   - each step brightens as the logo reaches its column,
 *   - a logo copy is left behind at every checkpoint it passes.
 * Mirrors the homepage pinned-scrub ScrollTrigger pattern (CurtainStack).
 *
 * The header (eyebrow + heading + lead) stays in the Astro wrapper so it keeps
 * server-rendered EyebrowSection/Button; this island is just the animated body.
 */
import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

export interface ProcessStep {
  title: string;
  body: string;
}

interface Props {
  steps: ProcessStep[];
  /** Resolved logo-mark image URL (resolved in the Astro wrapper via astro:assets). */
  logoSrc: string;
  /** Checkpoint X positions (fractions of the rail) where a logo copy is left. */
  checkpoints: number[];
}

/**
 * A padded logo mark on a bg circle — same treatment for markers and traveller.
 * Mirrors LogoMark.astro's wrapper: an inline-flex, shrink-0, centered span
 * around the <img>. This wrapper is REQUIRED — without it the bare <img> takes
 * its sizing from the (block) spin container and, once rotate() is applied to a
 * non-square box, the mark squishes into a thin ellipse.
 */
function LogoMark({ src }: { src: string }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0 logo-class">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="lazy"
        className="block w-5 h-5 md:w-6 md:h-6"
      />
    </span>
  );
}

// This island only ever mounts on desktop — it's hydrated with
// client:media="(min-width: 861px)", and the mobile static cards
// (ProcessStepsStatic) take over below that width.
export default function Process({ steps, logoSrc, checkpoints }: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const island = sectionRef.current;
    if (!island) return;
    // Pin the whole variant section (header + body) like the original, but query
    // the animated elements from this island's own subtree.
    const section = island.closest<HTMLElement>(".process-section") ?? island;

    const stepEls = Array.from(
      section.querySelectorAll<HTMLElement>("[data-process-step]"),
    );
    const markers = Array.from(
      section.querySelectorAll<HTMLElement>("[data-process-marker]"),
    );
    const line = section.querySelector<HTMLElement>("[data-process-line]");
    const logo = section.querySelector<HTMLElement>("[data-process-logo]");
    const spin = section.querySelector<HTMLElement>("[data-process-logo-spin]");
    if (!stepEls.length || !line || !logo) return;

    let killed = false;
    const cleanups: Array<() => void> = [];

    // Reduced motion: skip GSAP — reveal everything, draw the full line, hide
    // the traveller.
    if (reduced) {
      stepEls.forEach((s) => s.classList.add("is-active"));
      markers.forEach((m) => m.classList.add("is-active"));
      line.style.width = "100%";
      return;
    }

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);

      const n = stepEls.length;
      const totalRot = 360 * (n + 1); // a few full rolls across the row

      // Logo position = scroll progress across the full rail (0 → 1). It rolls
      // continuously to the end and stops there. No special-casing.
      const apply = (p: number) => {
        const xFrac = Math.min(Math.max(p, 0), 1);

        logo.style.left = `${xFrac * 100}%`;
        line.style.width = `${xFrac * 100}%`;
        // totalRot is a whole number of turns, so at the end (xFrac === 1) the
        // logo lands at an exact multiple of 360° → upright, then stays put.
        if (spin) spin.style.transform = `rotate(${totalRot * xFrac}deg)`;

        // A step is revealed once the logo reaches its column (step i at i/n).
        stepEls.forEach((step, i) => {
          step.classList.toggle("is-active", xFrac >= i / n - 1e-4);
        });
        // A checkpoint logo copy is left behind once the logo reaches it.
        markers.forEach((marker) => {
          const fx = parseFloat(marker.getAttribute("data-frac") || "0");
          marker.classList.toggle("is-active", xFrac >= fx - 1e-4);
        });
      };

      apply(0);

      const st = ScrollTrigger.create({
        trigger: section,
        start: "center center",
        end: () => "+=" + Math.round(window.innerHeight * (n * 0.6 + 0.4)),
        pin: true,
        pinSpacing: true,
        scrub: true,
        onUpdate: (self) => apply(self.progress),
        invalidateOnRefresh: true,
      });

      cleanups.push(() => st.kill());
    })();

    return () => {
      killed = true;
      while (cleanups.length) cleanups.pop()!();
    };
  }, [reduced, steps, checkpoints]);

  return (
    <section ref={sectionRef} data-process>
      <div className="process-grid">
        <ol className="process-steps" role="list">
          {steps.map((step, i) => (
            <li
              key={i}
              className="process-step"
              data-process-step
              style={{ ["--step-i" as any]: i }}
            >
              <p className="eyebrow-text font-medium text-text process-step-label">
                Step {String(i + 1)}
              </p>
              <h3 className="process-step-title">{step.title}</h3>
              {step.body && <p className="process-step-body">{step.body}</p>}
            </li>
          ))}
        </ol>

        {/* ── Rail: static track + line that draws behind a travelling logo ── */}
        <div className="process-rail" aria-hidden="true">
          <span className="process-rail-track" />
          <span className="process-rail-line" data-process-line />
          {/* A logo copy is left at every checkpoint: the start, each
              between-steps boundary, and the end. */}
          {checkpoints.map((frac, i) => (
            <span
              key={i}
              className="process-rail-marker"
              data-process-marker
              data-frac={frac}
              style={{ left: `${frac * 100}%` }}
            >
              <LogoMark src={logoSrc} />
            </span>
          ))}
          <span className="process-logo" data-process-logo>
            <span className="process-logo-spin" data-process-logo-spin>
              <LogoMark src={logoSrc} />
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
