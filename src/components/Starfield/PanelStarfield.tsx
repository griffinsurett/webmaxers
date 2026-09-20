// src/components/Starfield/PanelStarfield.tsx
/**
 * PanelStarfield — a star field scoped to its PARENT BOX, not the viewport.
 *
 * ── Why this exists alongside StarfieldCanvas ──────────────────────────────
 * `StarfieldCanvas` cannot be reused here, for two reasons that are structural
 * rather than cosmetic:
 *
 *   1. IT IS VIEWPORT-SIZED. It computes `W() = window.innerWidth` /
 *      `H() = window.innerHeight` and seeds star density from that. Inside a
 *      modal panel a few hundred pixels wide, that paints a full-screen field
 *      into a small box — the visible corner is near-empty and the DPR buffer
 *      is many times larger than the element. This one measures its own
 *      element via ResizeObserver.
 *   2. IT IS DARK-MODE ONLY. `HeroBackdrop` gates it behind
 *      `[data-theme="dark"]`. The popup shows in both themes, so the field has
 *      to carry its own contrast — hence `starColor`.
 *
 * The drift model is the one from the /game rocket loader: delta-time scaled,
 * every star WRAPS, so no value accumulates without bound however long the
 * popup stays open. This is the same invariant the 3D hero and the game hold
 * (see the HeroLogo3D notes) — amplitude never grows with elapsed time.
 *
 * Reduced motion: the loop never starts and the stars are painted once, static.
 * A still field is right here (unlike HeroBackdrop, which hides entirely),
 * because this one IS the panel's background — removing it leaves a bare slab.
 */
import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  /** px/second — nearer (bigger) stars drift faster, for parallax. */
  v: number;
}

export interface PanelStarfieldProps {
  className?: string;
  /** Paint colour for the stars. Defaults to white (for dark panels). */
  starColor?: string;
  /**
   * Divisor on the element's area — larger means sparser.
   *
   * 1600 gives ~135 stars in a 510x424 panel. The first value tried (4200,
   * carried over from the /game rocket loader) produced ~51, which measured as
   * 212 lit pixels over the whole canvas — a handful of specks rather than a
   * field. The loader covers a FULL SCREEN, so the same divisor that reads as
   * a sky there reads as almost nothing in a modal.
   */
  density?: number;
}

export default function PanelStarfield({
  className = "",
  starColor = "#ffffff",
  density = 1600,
}: PanelStarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let stars: Star[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const seed = () => {
      // Measure the ELEMENT, not the window — the whole point of this variant.
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      // Cap DPR at 2: past that the cost climbs with no visible gain. Same
      // clamp StarfieldCanvas and the game's loader use.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels

      const count = Math.round((w * h) / density);
      stars = [];
      for (let i = 0; i < count; i++) {
        const near = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: near > 0.92 ? 1.5 : near > 0.7 ? 1.05 : 0.65,
          a: 0.3 + Math.random() * 0.5,
          v: near > 0.92 ? 12 : near > 0.7 ? 7 : 4,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = starColor;
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    seed();
    draw();

    // The panel animates in (scale/opacity) and can reflow as its content
    // wraps, so re-seed on size changes rather than measuring once.
    const ro = new ResizeObserver(() => {
      seed();
      draw();
    });
    ro.observe(canvas);

    if (!reduced) {
      let last = performance.now();
      const tick = (now: number) => {
        // Clamp so a backgrounded tab cannot teleport the field on return.
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        for (const s of stars) {
          // Stars fall; wrapping keeps every value bounded no matter how long
          // this runs.
          s.y += s.v * dt;
          if (s.y > h + 2) {
            s.y = -2;
            s.x = Math.random() * w;
          }
        }
        draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, starColor, density]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
