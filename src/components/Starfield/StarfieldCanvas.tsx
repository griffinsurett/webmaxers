// src/components/Starfield/StarfieldCanvas.tsx
// Animated starfield overlay — twinkling stars + occasional shooting stars on a
// full-viewport <canvas>. This is the INTERACTIVE layer: it's a React island
// hydrated `client:idle` from Starfield.astro, so none of this canvas work runs
// until the browser is idle. Until then the static CSS placeholder (rendered by
// the .astro wrapper) is on screen.
//
// Motion preference is read via the shared useMotionPreference() hook, so it
// reacts live to the in-page motion toggle / OS setting (no reload): when motion
// is reduced the canvas stays blank and the calm CSS placeholder is the whole
// effect.
import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/hooks/useMotionPreference";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleAmount: number;
  phase: number;
}
interface Shooting {
  x: number;
  y: number;
  len: number;
  speed: number;
  angle: number;
  life: number;
}

export default function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    // Reduced motion: never run the loop. The canvas stays transparent and the
    // static CSS placeholder beneath shows through (calm, no twinkle, no shooting
    // stars). Re-runs when `reduced` flips, so the toggle takes effect live.
    if (reduced) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let stars: Star[] = [];
    let shootingStars: Shooting[] = [];
    let raf = 0;
    let stopped = false;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W() * dpr);
      canvas.height = Math.floor(H() * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    };

    const initStars = () => {
      const count = Math.floor((W() * H()) / 1800);
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W(),
          y: Math.random() * H(),
          r: Math.random() * 1.4 + 0.2,
          baseAlpha: Math.random() * 0.4 + 0.5,
          twinkleSpeed: Math.random() * 0.06 + 0.02,
          twinkleAmount: Math.random() * 0.5 + 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const spawnShootingStar = () => {
      shootingStars.push({
        x: Math.random() * W(),
        y: Math.random() * H() * 0.4,
        len: Math.random() * 120 + 80,
        speed: Math.random() * 8 + 6,
        angle: Math.PI / 5,
        life: 1,
      });
    };

    const frame = () => {
      if (stopped) return;
      ctx.clearRect(0, 0, W(), H());

      // Twinkling stars.
      for (const s of stars) {
        s.phase += s.twinkleSpeed;
        const alpha = s.baseAlpha + Math.sin(s.phase) * s.twinkleAmount;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, alpha))})`;
        ctx.fill();
      }

      // Shooting stars.
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        const dx = Math.cos(ss.angle) * ss.len;
        const dy = Math.sin(ss.angle) * ss.len;
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - dx, ss.y - dy);
        grad.addColorStop(0, `rgba(255,255,255,${ss.life})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - dx, ss.y - dy);
        ctx.stroke();

        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.life -= 0.012;
        if (ss.life <= 0) shootingStars.splice(i, 1);
      }

      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      sizeCanvas();
      initStars();
    };

    sizeCanvas();
    initStars();
    // Fade the canvas in over the static placeholder once it's ready.
    canvas.style.opacity = "1";
    frame();

    const shootingTimer = window.setInterval(() => {
      if (Math.random() < 0.7) spawnShootingStar();
    }, 2200);
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(shootingTimer);
      window.removeEventListener("resize", onResize);
      // Hand back to the static placeholder (e.g. when motion is turned off).
      if (canvas) {
        canvas.style.opacity = "0";
        ctx.clearRect(0, 0, W(), H());
      }
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="starfield-canvas"
      aria-hidden="true"
      style={{ opacity: 0, transition: "opacity 600ms ease" }}
    />
  );
}
