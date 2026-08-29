// src/components/HeroLogo3D/HeroLogo3D.tsx
// React island: the fracturing 3D brand mark.
//
// See `docs/hero-logo-3d-spec.md` for the intended look. Summary: the mark turns
// slowly at rest, holds whole through the first third of its scroll range, then
// disintegrates into ~17,700 staggered fragments that shrink and blow around the
// frame like torn paper while the rotation winds down. Scrolling up reverses it
// exactly.
//
// Renders the poster (children) immediately; Three.js mounts only after
// hydration, and the .astro wrapper hydrates client:visible at xl+ only. Under
// reduced motion the WebGL scene never loads and the poster stands in.
//
// ── Drive layer ────────────────────────────────────────────────────────────
// Scroll drives ONE number, `progress` ∈ [0,1], smoothed exactly once. From it:
//
//     breakAmount = breakFromProgress(progress)   → the GPU shatter
//     rotation    = idleSpin                       → time, NOT scroll
//
// The rotation is IDLE-ONLY and deliberately not coupled to scroll. The mark
// turns while you sit still, and HOLDS ITS ANGLE while you scroll — scrolling
// drives the shatter, never the spin. Turning the mark as it comes apart reads
// as the whole thing whirling, which is exactly the effect we do not want.
//
// The idle spin's INCREMENT is gated two ways, so it pauses rather than being
// cut off:
//
//   • by `wholeness`, so as the mark breaks it turns more and more slowly and
//     has stopped entirely by the time it is rubble;
//   • by `scrollHold`, which drops to 0 while the user is actively scrolling
//     and eases back to 1 shortly after they stop.
//
// Gating the INCREMENT and not the accumulated angle matters: multiplying the
// total by either factor would rotate the mark BACKWARDS toward 0. Gating the
// increment means the velocity goes to zero and the angle simply holds where it
// is — a pause, which is what a physical object does.
//
// Two further rules, both learned from the version this replaces:
//   • The scroll range is snapshotted in absolute document pixels. The target is
//     sized in `svh`, a unit whose pixel height CHANGES when a mobile URL bar or
//     desktop toolbar collapses; re-measuring it mid-scroll (as a GSAP
//     ScrollTrigger does) makes the range move under the user and progress jump.
//   • Exactly ONE smoothing stage. Stacking a GSAP scrub and a per-frame ease
//     put one wheel event through two different lags, which reads as the mark
//     trailing the cursor and then catching up.
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMotionPreference, readMotionPreference } from "@/hooks/useMotionPreference";
import { applyShatterToMaterial, buildShatterAttributes } from "./shatterMaterial";

const MODEL_URL = "/lotties/scroll-affected-lottie-that-breaks/logo.glb";

/**
 * All amplitudes are sized against the CAMERA FRAME, which at z=5 / 45° fov is
 * ±3.31 × ±2.07 units, with the mark itself 2.5 units. The previous version used
 * values 7–13× that, so the rubble left the screen instantly instead of filling
 * it. See docs/hero-logo-3d-spec.md §3.1.
 */
const CFG = {
  /** Cap the scrubbed break (1 = full shatter). */
  maxBreak: 1,
  /**
   * Random scatter half-extent per axis — [x, y, z]. Mean throw lands at
   * ±3.8 × ±2.5 (the frame is ±3.31 × ±2.07), so the field FILLS the frame and
   * only the strongest outliers leave it.
   */
  scatter: [6, 4, 3] as [number, number, number],
  /** Per-shard in-place wobble amplitude, local units. */
  jitter: 0.25,
  /**
   * Wind-blown wander. Drives BOTH the outward push and the flutter amplitude
   * (flutter ≈ drift × 0.28 × the wind/turb sum ≈ 1.2 units here, about half the
   * frame half-height — visible movement inside the frame rather than a sweep
   * across it).
   */
  drift: 1.5,
  /** Flutter rate multiplier (how fast each scrap rocks). */
  tumble: 2.4,
  /**
   * Peak rock of the per-shard flutter, radians. ±0.5 ≈ ±29°.
   * Deliberately modest: the group's own spin fades to zero through the break,
   * and if each scrap whirled through ±150° (as the old version did) the
   * rotation would not have wound down at all — it would just have moved from
   * one object to fifty thousand. See spec §3.3.
   */
  tumbleSwing: 0.5,
  /**
   * Idle spin while whole, rad/SECOND. Constant in real time — scaled by the
   * frame's delta-time, so it turns at the same rate at 30/60/120Hz and a
   * dropped frame costs no angle.
   */
  spinSpeed: 0.24,
  /**
   * How long (SECONDS) after the last scroll event the idle spin stays paused
   * before easing back in. Long enough that a continuous scroll never lets it
   * restart between wheel events, short enough that it resumes promptly once
   * the user settles.
   */
  scrollHoldFor: 0.18,
  /** Time constant (seconds) for the spin easing back in after a scroll. */
  scrollHoldTau: 0.45,
  /** Mouse-tilt magnitude (radians) and its follow time constant (seconds). */
  tiltMax: 0.25,
  tiltTau: 0.4,
  /**
   * Time constant (seconds) for the scroll → progress follow. THE ONLY smoothing
   * in the component. Small enough to feel locked to the wheel, large enough
   * that one wheel notch does not land as a visible step.
   */
  progressTau: 0.1,
  /** Fraction of the range the mark stays whole before it begins to break. */
  spinEnd: 0.35,
  /** Fraction of the range by which the break is complete. */
  breakEnd: 0.95,
  /** Per-shard break-delay spread — drives the erosion wave. */
  breakDelaySpread: 0.4,
  /** How much each shard shrinks toward its centroid as it breaks free (0→1). */
  shardShrink: 0.82,
  /** Global slow-motion factor for all rubble flutter. */
  motionSpeed: 0.15,
};

interface Props {
  /** Tailwind classes for positioning/sizing/opacity at the usage site. */
  className?: string;
  /** Contained (footer box) vs full-viewport (hero). Only affects sizing. */
  contained?: boolean;
  /** Hide the root once scrolled past the range (fixed/overlapping canvases). */
  hideOnLeave?: boolean;
  /** Selector of the element the break scrubs across (top → bottom). */
  breakSelector?: string;
  /** Crossfade duration poster → canvas, ms. */
  fadeMs?: number;
  respectReducedMotion?: boolean;
}

export default function HeroLogo3D({
  className = "",
  contained = false,
  hideOnLeave = true,
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
    // Reduced motion: the scene never loads, so make sure we're back to the
    // poster. If motion is disabled AFTER the scene was ready, `ready` is still
    // true and the poster sits at opacity 0 — reset it so the placeholder shows
    // again in place instead of going blank.
    if (motionDisabled) {
      setReady(false);
      return;
    }
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    let canceled = false;
    let cleanup = () => {};

    (async () => {
      // Synchronous re-check right before the heavy import: the motion store can
      // briefly report a stale `false` on first render, and we must never load
      // Three.js under reduced motion.
      if (readMotionPreference()) return;

      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (canceled) return;

      const cfg = CFG;

      // A PerspectiveCamera frames by its VERTICAL fov against the render
      // height, so we size the render height to the viewport either way and the
      // contained (footer) mark starts at the same on-screen size as the hero's.
      const getSize = () => {
        const h = window.innerHeight;
        const w = contained
          ? rootRef.current?.getBoundingClientRect().width || window.innerWidth
          : window.innerWidth;
        return { w: w || 1, h: h || 1 };
      };

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const initSize = getSize();
      renderer.setSize(initSize.w, initSize.h);
      canvasHost.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, initSize.w / initSize.h, 0.1, 100);
      // Apparent size scales inversely with distance, so push the camera back on
      // small screens to shrink the mark.
      const BASE_Z = 5;
      const MOBILE_BP = 768;
      const cameraZ = () => (window.innerWidth < MOBILE_BP ? BASE_Z * 2.6 : BASE_Z);
      camera.position.z = cameraZ();

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(3, 5, 5);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
      fillLight.position.set(-3, -2, -3);
      scene.add(fillLight);
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

      const shatter = applyShatterToMaterial(material, {
        jitter: cfg.jitter,
        drift: cfg.drift,
        tumble: cfg.tumble,
        shardShrink: cfg.shardShrink,
        tumbleSwing: cfg.tumbleSwing,
      });

      // ── Scroll range, snapshotted in absolute document pixels ──────────────
      const trigger = document.querySelector<HTMLElement>(breakSelector);
      let rangeStart = 0;
      let rangeLen = 1;

      const measure = () => {
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        rangeStart = rect.top + window.scrollY;
        rangeLen = Math.max(rect.height, 1);
      };

      /** Raw scroll position → 0-1 across the range. */
      const readProgress = () => {
        if (!trigger) return 0;
        return Math.min(Math.max((window.scrollY - rangeStart) / rangeLen, 0), 1);
      };

      /**
       * Range progress → break amount. The ONE place this mapping lives, so the
       * load-time snap and the per-frame update can never disagree about what a
       * given scroll position looks like.
       */
      const breakFromProgress = (p: number) => {
        const raw =
          p <= cfg.spinEnd
            ? 0
            : Math.min((p - cfg.spinEnd) / (cfg.breakEnd - cfg.spinEnd), 1);
        // Smoothstep: a bare linear ramp has a corner at spinEnd, where the
        // break's rate of change jumps from 0 to 1/span in one frame and reads
        // as a snap. Smoothstep is C1-continuous at both ends.
        return raw * raw * (3 - 2 * raw) * cfg.maxBreak;
      };

      // Raw target from scroll, and the smoothed value actually rendered.
      let progressTarget = 0;
      let progress = 0;

      // The free idle spin. An accumulator, but its INCREMENT is gated below so
      // the velocity goes to zero and the angle holds, rather than freezing.
      let idleSpin = 0;
      // 0 → 1: how much of the idle spin is currently allowed. Driven to 0 on
      // every scroll event and eased back once scrolling stops.
      let scrollHold = 1;
      let lastScrollAt = -Infinity;
      let tilt = 0;
      let mouseY = 0;

      let onScreen = true;
      let running = false;
      let raf = 0;
      let shown = true;
      const t0 = performance.now();
      let last = t0;

      function stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }

      function start() {
        if (running || !onScreen || document.hidden) return;
        running = true;
        // Reset the delta-time baseline: `last` is stale after a pause, and a
        // huge dt would jump the spin on the first frame back.
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }

      // Visibility is derived from scroll STATE rather than enter/leave events:
      // a fling that crosses the range in one frame, or a reload already past
      // it, can skip boundary callbacks and strand the canvas over later
      // sections. Recomputing from progress is self-correcting at any speed.
      const setShown = (v: boolean) => {
        if (shown === v) return;
        shown = v;
        if (rootRef.current) rootRef.current.style.visibility = v ? "visible" : "hidden";
        onScreen = v;
        if (v) start();
        else stop();
      };

      function tick() {
        if (!running) return;
        raf = requestAnimationFrame(tick);

        const now = performance.now();
        // Clamp dt so a backgrounded tab or a long task cannot teleport the
        // animation on the first frame back (rAF is throttled while hidden).
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const elapsed = ((now - t0) / 1000) * cfg.motionSpeed;

        // THE one smoothing stage. 1 - e^(-dt/tau) is the fraction of the
        // remaining distance closed this frame, which converges identically at
        // any refresh rate.
        const k = 1 - Math.exp(-dt / cfg.progressTau);
        progress += (progressTarget - progress) * k;
        if (Math.abs(progressTarget - progress) < 1e-4) progress = progressTarget;

        const breakAmount = breakFromProgress(progress);
        const wholeness = 1 - Math.min(breakAmount, 1);

        // Pause the spin while the user is scrolling. `scrollHold` snaps to 0 on
        // a scroll event and eases back toward 1 once they have been still for
        // `scrollHoldFor` — so the mark holds its angle through a scroll and
        // picks the turn back up smoothly afterwards, instead of stopping and
        // starting abruptly.
        const stillFor = (now - lastScrollAt) / 1000;
        if (stillFor < cfg.scrollHoldFor) {
          scrollHold = 0;
        } else {
          const hk = 1 - Math.exp(-dt / cfg.scrollHoldTau);
          scrollHold += (1 - scrollHold) * hk;
        }

        // Idle spin advances in real time, but only while the mark is whole AND
        // the user is not scrolling. Once it is rubble, wholeness is 0 and it
        // stops advancing entirely — so the shards never orbit as a clump.
        idleSpin += cfg.spinSpeed * wholeness * scrollHold * dt;
        group.rotation.y = idleSpin;

        // Mouse tilt only while whole; eases back to 0 as the mark breaks.
        const tiltTarget = mouseY * cfg.tiltMax * wholeness;
        const tk = 1 - Math.exp(-dt / cfg.tiltTau);
        tilt += (tiltTarget - tilt) * tk;
        group.rotation.x = tilt;

        // Two uniform writes; no geometry is touched.
        shatter.uBreak.value = breakAmount;
        shatter.uTime.value = elapsed;

        renderer.render(scene, camera);
      }

      const syncFromScroll = () => {
        lastScrollAt = performance.now();
        progressTarget = readProgress();
        if (hideOnLeave) setShown(progressTarget < 1);
        start(); // a scroll while the loop sleeps must wake it
      };

      /** Re-measure and jump (no smoothing) — layout moved under us. */
      const resync = () => {
        measure();
        progressTarget = readProgress();
        progress = progressTarget;
        if (hideOnLeave) setShown(progressTarget < 1);
        start();
      };

      const onScroll = () => syncFromScroll();
      window.addEventListener("scroll", onScroll, { passive: true });

      const onMove = (e: MouseEvent) => {
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      const onResize = () => {
        const { w, h } = getSize();
        camera.aspect = w / h;
        camera.position.z = cameraZ();
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        resync();
      };
      window.addEventListener("resize", onResize);

      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);

      // Late webfont/image shifts move the range; re-measure once settled.
      const onLoad = () => resync();
      window.addEventListener("load", onLoad);

      // ── Load + fracture the GLB ────────────────────────────────────────────
      // No DRACOLoader: this GLB declares no extensions (checked), so it is not
      // Draco-compressed and a decoder only added a dependency and a failure
      // mode without ever being used.
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          if (canceled) return;
          gltf.scene.traverse((obj: any) => {
            if (!obj.isMesh) return;
            // Non-indexed so every triangle owns its three vertices — shards
            // must be able to fly apart independently.
            const geom = obj.geometry.toNonIndexed();
            geom.computeVertexNormals();
            const pos = geom.attributes.position;
            const faceCount = pos.count / 3;
            const original = new Float32Array(pos.array);

            const attrs = buildShatterAttributes(original, faceCount, {
              scatter: cfg.scatter,
              breakDelaySpread: cfg.breakDelaySpread,
            });
            geom.setAttribute("aOffset", new THREE.BufferAttribute(attrs.aOffset, 3));
            geom.setAttribute("aShard", new THREE.BufferAttribute(attrs.aShard, 4));
            geom.setAttribute("aCentroid", new THREE.BufferAttribute(attrs.aCentroid, 3));
            geom.setAttribute("aDriftDir", new THREE.BufferAttribute(attrs.aDriftDir, 3));
            geom.setAttribute("aJitterSeed", new THREE.BufferAttribute(attrs.aJitterSeed, 4));
            geom.setAttribute("aDriftSeed", new THREE.BufferAttribute(attrs.aDriftSeed, 4));
            geom.setAttribute("aTumbleSeed", new THREE.BufferAttribute(attrs.aTumbleSeed, 4));

            const mesh = new THREE.Mesh(geom, material);
            obj.updateWorldMatrix(true, false);
            mesh.applyMatrix4(obj.matrixWorld);
            // Shards travel outside the mark's rest bounds; without this the
            // renderer frustum-culls the mesh mid-burst and the rubble vanishes.
            mesh.frustumCulled = false;
            group.add(mesh);
          });

          // Centre and normalise scale to ~2.5 units.
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
          group.scale.setScalar(2.5 / Math.max(size.x, size.y, size.z));

          // Snap to the current scroll position with no smoothing, so a load
          // that finishes mid-range appears already correct.
          resync();
          requestAnimationFrame(() => !canceled && setReady(true));
        },
        undefined,
        (err) => console.error("HeroLogo3D: failed to load logo.glb", err)
      );

      measure();
      syncFromScroll();

      cleanup = () => {
        stop();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("load", onLoad);
        document.removeEventListener("visibilitychange", onVisibility);
        group.traverse((o: any) => o.isMesh && o.geometry?.dispose());
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      canceled = true;
      cleanup();
    };
  }, [motionDisabled, breakSelector, contained, hideOnLeave]);

  // Full-viewport: the canvas fills its box. Contained (footer): the buffer is
  // container-wide but viewport-tall, centred and clipped by the short box so
  // the mark is never squashed.
  const hostClass = contained
    ? "absolute inset-0 overflow-hidden flex items-center justify-center [&>canvas]:!w-full [&>canvas]:!h-screen [&>canvas]:block [&>canvas]:max-w-none"
    : "absolute inset-0 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:block";

  const showCanvas = ready && !motionDisabled;

  return (
    <div ref={rootRef} className={`hero-logo3d pointer-events-none ${className}`} aria-hidden="true">
      {/* Poster: shown until the scene is ready, and forever under reduced
          motion. Frames the mark at the same scale as the live canvas. */}
      <div
        className={
          contained
            ? "absolute inset-0 overflow-hidden flex items-center justify-center"
            : "absolute inset-0"
        }
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: showCanvas ? 0 : 1 }}
      >
        {children}
      </div>

      <div
        ref={canvasHostRef}
        className={hostClass}
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: showCanvas ? 1 : 0 }}
      />
    </div>
  );
}
