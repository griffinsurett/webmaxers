// src/components/HeroLogo3D/HeroLogo3D.tsx
// React island: the fracturing 3D brand mark. Renders the poster (children)
// immediately; the heavy Three.js scene only mounts AFTER hydration — and the
// island is hydrated with `client:firstInteraction` from the .astro wrapper, so
// nothing heavy loads until the user interacts. Reduced motion: poster only, the
// WebGL scene never loads (mirrors LottieLogo / OptimizedLottie).
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMotionPreference, readMotionPreference } from "@/hooks/useMotionPreference";

const MODEL_URL = "/lotties/scroll-affected-lottie-that-breaks/logo.glb";

/**
 * Two variants of the same fracturing mark:
 *   1 — HERO: full-viewport `fixed` instance. Spins up, shatters, then the
 *       self-running vacuum sucks the rubble away and the canvas hides. Scrub
 *       range is tied to the viewport TOP (the wrapper scrolls up past it).
 *   2 — FOOTER: contained instance that NEVER disappears. Spins while whole,
 *       FREEZES its rotation the moment it starts breaking, then explodes into
 *       a wide, continuously-jittering rubble field that stays in frame. Scrub
 *       range is tied to the viewport BOTTOM (it plays as it scrolls INTO view).
 */
type Variant = 1 | 2;

interface VariantConfig {
  scrollStart: string;
  scrollEnd: string;
  enableVacuum: boolean;
  hideOnLeave: boolean;
  /** Cap the scrubbed break (1 = full). <1 keeps shards in frame (no vacuum). */
  maxBreak: number;
  /** Random scatter half-extent per axis at break==1 — [x, y, z]. Bigger = crazier. */
  scatter: [number, number, number];
  /** Spin keeps running once shattered (hero) vs. freezes hard on break (footer). */
  freezeSpinOnBreak: boolean;
  /** Per-shard continuous jitter amplitude (local units) once shattered. 0 = off. */
  jitter: number;
  /**
   * Scroll-progress fraction at which the break reaches `maxBreak`. Smaller =
   * a quicker, snappier shatter with little whole↔rubble in-between (it then
   * just holds as rubble for the rest of the range). For the hero this is
   * effectively VAC_TRIGGER; `null` means "use VAC_TRIGGER".
   */
  breakEnd: number | null;
  /** Per-shard break-delay spread. Smaller = shards shatter more in unison (snappier). */
  breakDelaySpread: number;
}

const VARIANTS: Record<Variant, VariantConfig> = {
  1: {
    scrollStart: "top top",
    scrollEnd: "bottom top",
    enableVacuum: true,
    hideOnLeave: true,
    maxBreak: 1,
    scatter: [5, 5, 2.5],
    freezeSpinOnBreak: false,
    jitter: 0,
    breakEnd: null, // hero hands off to the vacuum at VAC_TRIGGER
    breakDelaySpread: 0.4,
  },
  2: {
    scrollStart: "top bottom",
    scrollEnd: "bottom bottom",
    enableVacuum: false,
    hideOnLeave: false,
    maxBreak: 1,
    scatter: [11, 11, 6], // much wider explosion — "crazier" particles
    freezeSpinOnBreak: true,
    jitter: 0.18,
    breakEnd: 0.35, // snap whole → rubble fast, then hold as jittering rubble
    breakDelaySpread: 0.08, // shards shatter near-simultaneously (little in-between)
  },
};

interface Props {
  /** Tailwind classes for positioning/sizing/opacity at the usage site. */
  className?: string;
  /** 1 = hero (spin→shatter→vacuum), 2 = footer (frozen wide jittering rubble). */
  variant?: Variant;
  /** Selector of the element the break scrubs across (top → bottom). */
  breakSelector?: string;
  /** Crossfade duration poster → canvas, ms. */
  fadeMs?: number;
  respectReducedMotion?: boolean;
}

export default function HeroLogo3D({
  className = "",
  variant = 1,
  breakSelector = "[data-logo-break]",
  fadeMs = 180,
  respectReducedMotion = true,
  children,
}: PropsWithChildren<Props>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const motionDisabled = useMotionPreference(respectReducedMotion);

  useEffect(() => {
    if (motionDisabled) return;
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    let canceled = false;
    let cleanup = () => {};

    (async () => {
      // Fresh, synchronous re-check right before the heavy imports: the motion
      // store can briefly report stale `false` on first render, and we must
      // NEVER load Three.js under reduced motion.
      if (readMotionPreference()) return;

      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      if (canceled) return;

      const cfg = VARIANTS[variant];

      // Render size. A PerspectiveCamera frames the scene by its VERTICAL fov
      // against the render HEIGHT — so to make the contained footer logo (v2)
      // start at the SAME on-screen size as the full-viewport hero (v1), we size
      // the render height to the viewport height in BOTH variants. Width comes
      // from the container for v2 (so the wide/short footer box doesn't squash
      // the canvas), and from the viewport for v1.
      const getSize = () => {
        const h = window.innerHeight;
        const w =
          variant === 1
            ? window.innerWidth
            : rootRef.current?.getBoundingClientRect().width || window.innerWidth;
        return { w: w || 1, h: h || 1 };
      };

      // Renderer / scene / camera — transparent, sits behind content.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const initSize = getSize();
      renderer.setSize(initSize.w, initSize.h);
      canvasHost.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, initSize.w / initSize.h, 0.1, 100);
      camera.position.z = 5;

      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(3, 5, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.25);
      fill.position.set(-3, -2, -3);
      scene.add(fill);
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));

      const group = new THREE.Group();
      scene.add(group);

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.12,
        metalness: 0.05,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

      // Per-face fracture: each face displaces along a random offset 0 → 1.
      type Face = {
        position: any;
        original: Float32Array;
        offsets: Float32Array;
        delays: Float32Array;
        strengths: Float32Array;
        /** Per-shard jitter seed: [phaseX, phaseY, phaseZ, freq] for variant-2 wobble. */
        jitterSeed: Float32Array;
        faceCount: number;
      };
      const faces: Face[] = [];
      let isReady = false;
      let progress = 0;

      // `time` (seconds) drives the per-shard continuous wobble; `jitterAmp` is
      // the variant's jitter amplitude (0 for the hero — pure scrubbed break).
      const applyBreak = (amount: number, time = 0, jitterAmp = 0) => {
        for (const f of faces) {
          const arr = f.position.array as Float32Array;
          for (let s = 0; s < f.faceCount; s++) {
            // How broken THIS shard is, 0 → 1+ (its delay-staggered progress).
            const shard = Math.max(0, (amount - f.delays[s]) / (1 - f.delays[s]));
            const t = shard * f.strengths[s];
            const ox = f.offsets[s * 3];
            const oy = f.offsets[s * 3 + 1];
            const oz = f.offsets[s * 3 + 2];
            // Wobble grows with how shattered the shard is, so the whole logo
            // stays crisp and only loose rubble jitters.
            let jx = 0, jy = 0, jz = 0;
            if (jitterAmp > 0 && shard > 0) {
              const px = f.jitterSeed[s * 4];
              const py = f.jitterSeed[s * 4 + 1];
              const pz = f.jitterSeed[s * 4 + 2];
              const freq = f.jitterSeed[s * 4 + 3];
              const a = jitterAmp * Math.min(shard, 1);
              jx = Math.sin(time * freq + px) * a;
              jy = Math.cos(time * freq * 1.3 + py) * a;
              jz = Math.sin(time * freq * 0.7 + pz) * a;
            }
            for (let v = 0; v < 3; v++) {
              const i = (s * 3 + v) * 3;
              arr[i] = f.original[i] + ox * t + jx;
              arr[i + 1] = f.original[i + 1] + oy * t + jy;
              arr[i + 2] = f.original[i + 2] + oz * t + jz;
            }
          }
          f.position.needsUpdate = true;
        }
      };

      // Vacuum: from the fully-broken positions, lerp every vertex toward a
      // single point below-and-centred (local space), so the rubble gets sucked
      // down toward the horizontal-centre / vertical-bottom as `v` goes 0 → 1.
      const VAC_TARGET = { x: 0, y: -4.0, z: 0 }; // below the logo, on its axis
      const applyVacuum = (v: number) => {
        const e = v * v; // ease-in so it accelerates as it's swallowed
        for (const f of faces) {
          const arr = f.position.array as Float32Array;
          for (let s = 0; s < f.faceCount; s++) {
            // fully-broken displacement (break == 1) for this shard
            const t = f.strengths[s];
            const ox = f.offsets[s * 3];
            const oy = f.offsets[s * 3 + 1];
            const oz = f.offsets[s * 3 + 2];
            for (let vert = 0; vert < 3; vert++) {
              const i = (s * 3 + vert) * 3;
              const bx = f.original[i] + ox * t;
              const by = f.original[i + 1] + oy * t;
              const bz = f.original[i + 2] + oz * t;
              arr[i] = bx + (VAC_TARGET.x - bx) * e;
              arr[i + 1] = by + (VAC_TARGET.y - by) * e;
              arr[i + 2] = bz + (VAC_TARGET.z - bz) * e;
            }
          }
          f.position.needsUpdate = true;
        }
      };

      // Load + fracture the GLB.
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      loader.setDRACOLoader(draco);

      loader.load(
        MODEL_URL,
        (gltf) => {
          if (canceled) return;
          gltf.scene.traverse((obj: any) => {
            if (!obj.isMesh) return;
            const geom = obj.geometry.toNonIndexed();
            geom.computeVertexNormals();
            const pos = geom.attributes.position;
            const faceCount = pos.count / 3;
            const original = new Float32Array(pos.array);
            const offsets = new Float32Array(faceCount * 3);
            const delays = new Float32Array(faceCount);
            const strengths = new Float32Array(faceCount);
            const jitterSeed = new Float32Array(faceCount * 4);
            for (let i = 0; i < faceCount; i++) {
              // Per-axis scatter extent comes from the variant (footer = crazier).
              offsets[i * 3] = (Math.random() - 0.5) * cfg.scatter[0];
              offsets[i * 3 + 1] = (Math.random() - 0.5) * cfg.scatter[1];
              offsets[i * 3 + 2] = (Math.random() - 0.5) * cfg.scatter[2];
              delays[i] = Math.random() * cfg.breakDelaySpread;
              strengths[i] = 0.5 + Math.random() * 1.5;
              // Independent wobble phase per axis + a per-shard speed multiplier.
              jitterSeed[i * 4] = Math.random() * Math.PI * 2;
              jitterSeed[i * 4 + 1] = Math.random() * Math.PI * 2;
              jitterSeed[i * 4 + 2] = Math.random() * Math.PI * 2;
              jitterSeed[i * 4 + 3] = 0.6 + Math.random() * 1.8;
            }
            const mesh = new THREE.Mesh(geom, material);
            obj.updateWorldMatrix(true, false);
            mesh.applyMatrix4(obj.matrixWorld);
            group.add(mesh);
            faces.push({ position: pos, original, offsets, delays, strengths, jitterSeed, faceCount });
          });

          // Center + normalise scale to ~2.5 units.
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
          group.scale.setScalar(2.5 / Math.max(size.x, size.y, size.z));

          isReady = true;
          applyBreak(progress); // snap to current scroll position
          // Wait a frame so the first WebGL frame paints, then crossfade in.
          requestAnimationFrame(() => !canceled && setReady(true));
        },
        undefined,
        (err) => console.error("HeroLogo3D: failed to load logo.glb", err)
      );

      // Scroll → break. The wrapper bounds the range; the page owns "when".
      // The canvas is fixed (full-viewport), so the wrapper bounds WHEN it breaks
      // but not WHERE it paints — past the wrapper it would show through the
      // footer. Hide the root once scrolled past the wrapper's range.
      const setVisible = (v: boolean) => {
        if (rootRef.current) rootRef.current.style.visibility = v ? "visible" : "hidden";
      };
      // Scroll-SCRUBBED: spin up, then shatter out (break 0 → 1) across the range.
      //   progress 0 → SPIN_END : spin accelerates, logo whole
      //   progress SPIN_END → 1 : break ramps 0 → 1
      const SPIN_END = 0.15;
      let scrollSpin = 0; // 0 (idle) → 1 (max spin-up)

      // Latest scrubbed break amount, re-applied every frame (so variant-2
      // jitter keeps animating even when the scroll position is static).
      let breakAmount = 0;

      // The vacuum is NOT scrubbed — it's a self-running animation that fires
      // once scroll crosses VAC_TRIGGER and plays to completion on its own
      // (independent of whether the user keeps scrolling). `vacuum` 0 → 1 is
      // driven by a GSAP tween; the break/spin freeze while it's active.
      let vacuum = 0;
      let brokenness = 0; // 0 = whole, 1 = fully shattered (slows the spin)
      const vacState = { v: 0 };
      const VAC_TRIGGER = 0.85; // fraction of the wrapper where the vacuum kicks in

      const trigger = document.querySelector<HTMLElement>(breakSelector);
      const st = ScrollTrigger.create({
        trigger: trigger ?? undefined,
        start: cfg.scrollStart,
        end: cfg.scrollEnd,
        scrub: true,
        onUpdate: (self) => {
          progress = self.progress;
          scrollSpin = Math.min(progress / SPIN_END, 1);
          if (!isReady) return;
          // While the vacuum animation is running/active, it owns the geometry.
          if (vacuum > 0) return;
          // Break completes at `breakEnd` (hero: VAC_TRIGGER, then the vacuum
          // takes over; footer: an early fraction so it snaps whole → rubble fast
          // with little in-between, then just holds/jitters for the rest).
          const breakEnd = cfg.breakEnd ?? (cfg.enableVacuum ? VAC_TRIGGER : 1);
          const breakSpan = breakEnd - SPIN_END;
          breakAmount =
            progress <= SPIN_END
              ? 0
              : Math.min((progress - SPIN_END) / breakSpan, 1) * cfg.maxBreak;
          brokenness = breakAmount;
          // The tick loop re-applies break+jitter every frame; this snap keeps
          // the static (no-jitter) variant exact between frames too.
          applyBreak(breakAmount);
        },
        // Hide once scrolled past the range only for the hero (its fixed canvas
        // would otherwise show through later sections). The footer mark stays.
        onLeave: cfg.hideOnLeave ? () => setVisible(false) : undefined,
        onEnterBack: cfg.hideOnLeave ? () => setVisible(true) : undefined,
      });

      // Self-running vacuum trigger: fires near the end of the scroll range.
      const VAC_DURATION = 1.4; // seconds — its own pace, NOT scroll-tied
      const runVacuum = (forward: boolean) => {
        gsap.to(vacState, {
          v: forward ? 1 : 0,
          duration: VAC_DURATION,
          ease: forward ? "power2.in" : "power2.out",
          overwrite: true,
          onUpdate: () => {
            vacuum = vacState.v;
            brokenness = 1; // stay fully shattered → spin stays slowed
            if (isReady) {
              if (vacuum > 0) applyVacuum(vacuum);
              else applyBreak(1); // back to fully-shattered when the vacuum undoes
            }
          },
        });
      };
      // Match the vacuum's viewport reference to the break range's end (its
      // second token), so the vacuum fires at the same proportional scroll point
      // whether the range is tied to the viewport top (hero) or bottom (footer).
      const vacViewportRef = cfg.scrollEnd.split(/\s+/)[1] ?? "top";
      if (cfg.enableVacuum) {
        ScrollTrigger.create({
          trigger: trigger ?? undefined,
          // Fires when a point VAC_TRIGGER down the wrapper reaches that viewport edge.
          start: `${VAC_TRIGGER * 100}% ${vacViewportRef}`,
          onEnter: () => runVacuum(true),      // crossed the point going down → vacuum out
          onLeaveBack: () => runVacuum(false), // scrolled back up → vacuum back in
        });
      }

      // Mouse parallax + auto-spin (idle base speed, boosted by scroll phase 1).
      let mouseY = 0;
      const onMove = (e: MouseEvent) => {
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      const BASE_SPIN = 0.004; // idle rotation per frame
      const MAX_SPIN = 0.05; // spun-up rotation per frame at full scroll-up
      let spin = 0;
      let raf = 0;
      // Slow factor: fast while whole/transforming, eased down to a crawl once
      // it's rubble. `brokenness` 0 → 1 scales the spin velocity (never reverses).
      const SLOWED = 0.08; // residual spin speed once fully rubble
      let slow = 1;
      const t0 = performance.now();
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const elapsed = (performance.now() - t0) / 1000; // seconds

        // Spin. Variant 2 FREEZES rotation the instant breaking begins (so the
        // rubble field doesn't rotate); variant 1 only eases the spin slower.
        if (cfg.freezeSpinOnBreak) {
          // Spin only while whole; once any break has started, hold the angle.
          if (brokenness <= 0.0001) {
            spin += BASE_SPIN + (MAX_SPIN - BASE_SPIN) * scrollSpin;
          }
        } else {
          // Ease the slow factor toward its target so the slowdown is smooth.
          const targetSlow = 1 - (1 - SLOWED) * brokenness;
          slow += (targetSlow - slow) * 0.08;
          // Spin keeps the SAME direction — we only reduce its speed, never unwind.
          spin += (BASE_SPIN + (MAX_SPIN - BASE_SPIN) * scrollSpin) * slow;
        }
        group.rotation.y = spin;
        group.rotation.x += (mouseY * 0.25 - group.rotation.x) * 0.04;

        // Continuous rubble jitter (variant 2): re-apply break + time-based
        // wobble every frame so the shattered field keeps writhing even when the
        // scroll position is static. Skip while the (hero-only) vacuum owns it.
        if (isReady && cfg.jitter > 0 && vacuum <= 0) {
          applyBreak(breakAmount, elapsed, cfg.jitter);
        }

        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        const { w, h } = getSize();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("resize", onResize);
        st.kill();
        renderer.dispose();
        draco.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      canceled = true;
      cleanup();
    };
  }, [motionDisabled, breakSelector, variant]);

  // Variant 1 (hero): the canvas fills its full-viewport box exactly.
  // Variant 2 (footer): the render buffer is container-wide but viewport-TALL
  // (so the logo starts at the hero's size). The canvas is therefore displayed
  // full-width and viewport-height, centred and clipped by the short footer box
  // — never stretched to the box height (which would squash it).
  const isContained = variant === 2;
  const hostClass = isContained
    ? "absolute inset-0 overflow-hidden flex items-center justify-center [&>canvas]:!w-full [&>canvas]:!h-screen [&>canvas]:block [&>canvas]:max-w-none"
    : "absolute inset-0 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:block";

  return (
    <div ref={rootRef} className={`hero-logo3d pointer-events-none ${className}`} aria-hidden="true">
      {/* Poster: shown until the 3D scene is ready (and forever under reduced
          motion). It must frame the mark at the SAME scale as the live canvas,
          so the contained variant centres it over a viewport-tall box too. */}
      <div
        className={
          isContained
            ? "absolute inset-0 overflow-hidden flex items-center justify-center"
            : "absolute inset-0"
        }
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: ready ? 0 : 1 }}
      >
        {children}
      </div>

      {/* WebGL canvas mounts here, fades in when ready. */}
      <div
        ref={canvasHostRef}
        className={hostClass}
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
