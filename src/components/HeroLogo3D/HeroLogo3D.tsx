// src/components/HeroLogo3D/HeroLogo3D.tsx
// React island: the fracturing 3D brand mark. Renders the poster (children)
// immediately; the heavy Three.js scene only mounts AFTER hydration — and the
// island is hydrated with `client:firstInteraction` from the .astro wrapper, so
// nothing heavy loads until the user interacts. Reduced motion: poster only, the
// WebGL scene never loads (mirrors LottieLogo / OptimizedLottie).
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMotionPreference, readMotionPreference } from "@/hooks/useMotionPreference";
import { applyShatterToMaterial, buildShatterAttributes } from "./shatterMaterial";

const MODEL_URL = "/lotties/scroll-affected-lottie-that-breaks/logo.glb";

/**
 * The fracturing 3D brand mark. ONE behavior everywhere:
 *   • spins at a constant rate while whole (NEVER speeds up — not with scroll,
 *     not with anything),
 *   • shatters apart as it scrolls through its range (the spin eases to a stop),
 *   • then the shards disperse and get blown everywhere like ripped paper —
 *     spreading out to fill the frame and fluttering/tumbling individually.
 * The group never rotates as a clump once it's rubble.
 *
 * Used full-screen in the hero and contained in the footer — the ONLY difference
 * is layout (the `contained` prop) and where the break scrubs (`breakSelector`).
 */
const CFG = {
  scrollStart: "top top",
  scrollEnd: "bottom top",
  /** Cap the scrubbed break (1 = full shatter). */
  maxBreak: 1,
  /** Random scatter half-extent per axis at break==1 — [x, y, z]. */
  scatter: [16, 16, 8] as [number, number, number],
  /** Per-shard continuous jitter amplitude (local units) once shattered. */
  jitter: 0.4,
  /**
   * Wind-blown wander once shattered — base half-extent (local units) for the
   * outward dispersal + shared gust + per-shard turbulence that blow the shards
   * everywhere like torn paper.
   */
  drift: 11,
  /** Per-shard tumble speed once shattered — each shard flips like ripped paper. */
  tumble: 2.4,
  /**
   * Base spin velocity while whole, in rad/SECOND. CONSTANT — never speeds up.
   * Frame-rate independent: this is multiplied by the frame's delta-time, so the
   * mark spins at the same real-world rate at 30/60/120Hz and a dropped frame
   * costs no angle. (0.24 rad/s ≈ the old 0.004 rad/frame at 60fps.)
   */
  spinSpeed: 0.24,
  /**
   * Time constant (SECONDS) for the eased mouse tilt — the time to close ~63% of
   * the remaining distance. Used with an exponential smoother so the easing rate
   * is identical at any frame rate.
   */
  tiltTau: 0.4,
  /** Scroll-progress fraction at which the break reaches `maxBreak`. Higher =
   *  the shatter is spread over more scroll, so it breaks more gradually/slowly. */
  breakEnd: 0.95,
  /** Per-shard break-delay spread. Smaller = shards shatter more in unison. */
  breakDelaySpread: 0.4,
  /**
   * How much each shard shrinks toward its centroid as it breaks free (0→1).
   * 0 = stays full size; higher = smaller, more particle-like flecks. At 0.82
   * a broken shard collapses to ~18% of its size, reading as a dust particle
   * rather than a chunk of the logo.
   */
  shardShrink: 0.82,
};

interface Props {
  /** Tailwind classes for positioning/sizing/opacity at the usage site. */
  className?: string;
  /**
   * Contained (footer box) vs full-viewport (hero). Only affects canvas sizing /
   * poster framing — the animation is identical either way.
   */
  contained?: boolean;
  /** Hide the root once scrolled past the break range (fixed/overlapping canvases). */
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
    // poster. If motion gets disabled AFTER the scene was ready, `ready` is
    // still true and the poster sits at opacity 0 — reset it so the placeholder
    // shows again in-place instead of going blank.
    if (motionDisabled) {
      setReady(false);
      return;
    }
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

      const cfg = CFG;

      // Render size. A PerspectiveCamera frames the scene by its VERTICAL fov
      // against the render HEIGHT — so the contained (footer) logo starts at the
      // SAME on-screen size as the full-viewport one, we size the render height to
      // the viewport height either way. Width comes from the container when
      // contained (so the wide/short box doesn't squash the canvas), else viewport.
      const getSize = () => {
        const h = window.innerHeight;
        const w = contained
          ? rootRef.current?.getBoundingClientRect().width || window.innerWidth
          : window.innerWidth;
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
      // Apparent size scales inversely with camera distance, so pushing the
      // camera to 2× its base distance halves the logo on screen. Do that below
      // the mobile breakpoint (Tailwind `md` = 768px). Recomputed on resize so
      // it tracks orientation / DPR changes.
      const BASE_Z = 5;
      const MOBILE_BP = 768;
      // Push the camera back further on mobile so the mark reads smaller (the
      // apparent size scales inversely with distance — 2.6× distance ≈ 38% size).
      const cameraZ = () => (window.innerWidth < MOBILE_BP ? BASE_Z * 2.6 : BASE_Z);
      camera.position.z = cameraZ();

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

      // The fracture runs on the GPU. Per-shard constants are uploaded once as
      // vertex attributes; each frame we set two uniforms (`uBreak`, `uTime`)
      // and the vertex shader displaces all ~53,000 vertices in parallel.
      //
      // This replaces a JS loop that rewrote every vertex and re-uploaded the
      // position buffer each frame. Same motion, but the main thread — the one
      // resource a scrolling page can't spare — does almost nothing.
      const shatter = applyShatterToMaterial(material, {
        jitter: cfg.jitter,
        drift: cfg.drift,
        tumble: cfg.tumble,
        shardShrink: cfg.shardShrink,
      });

      let isReady = false;
      let progress = 0;
      // Scroll-SCRUBBED shatter (break 0 → 1) across the wrapper's range:
      //   progress 0 → SPIN_END : logo whole (break hasn't started)
      //   SPIN_END → breakEnd   : break ramps 0 → 1
      // Past the wrapper the logo hides (hideOnLeave) so the projects/curtain
      // section below covers it.
      // Declared here (above breakFromProgress and the GLB callback that calls
      // it) so neither can hit the temporal dead zone on a fast/cached load.
      const SPIN_END = 0.35; // stay whole longer before it starts to fall apart
      // Latest break amount (scroll-driven), re-applied every frame by the tick
      // loop so the rubble keeps animating even when the scroll position is static.
      let breakAmount = 0;
      // Scroll progress (0→1 across the trigger) → break amount. The ONE place
      // this mapping lives, so the load-time snap and the scroll handler can
      // never disagree about what a given scroll position looks like.
      // A function *declaration* so it hoists — the GLB callback below can run
      // before the ScrollTrigger further down has been constructed.
      function breakFromProgress(p: number) {
        const raw =
          p <= SPIN_END
            ? 0
            : Math.min((p - SPIN_END) / (cfg.breakEnd - SPIN_END), 1);
        // Smoothstep: a bare linear ramp has a corner at SPIN_END — the break's
        // rate of change jumps from 0 to 1/span in a single frame, which reads as
        // a snap right where the shatter engages (and again where it completes).
        // Smoothstep is C1-continuous at both ends, so the break eases in and out.
        return raw * raw * (3 - 2 * raw) * cfg.maxBreak;
      }

      // Drive the GPU fracture. The whole per-frame cost is two uniform writes;
      // the vertex shader does the displacement maths for every vertex in
      // parallel. `amount` is the scroll-driven break, `time` the flutter clock.
      const applyBreak = (amount: number, time = 0) => {
        shatter.uBreak.value = amount;
        shatter.uTime.value = time;
      };

      // Load + fracture the GLB.
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      // Self-hosted decoder (public/draco/), NOT gstatic.com. Three reasons:
      // it removes a third-party origin from the critical path (extra DNS +
      // TLS + connection before the GLB can even start decoding); it keeps the
      // site's external dependencies to the sanctioned list; and it pins the
      // decoder to the exact `three` version in package.json, where the CDN URL
      // hard-coded 1.5.7 independently of the installed loader.
      //
      // The files are copied from `three/examples/jsm/libs/draco/gltf/` by the
      // `sync:draco` npm script — re-run it after bumping `three`.
      draco.setDecoderPath("/draco/");
      loader.setDRACOLoader(draco);

      loader.load(
        MODEL_URL,
        (gltf) => {
          if (canceled) return;
          gltf.scene.traverse((obj: any) => {
            if (!obj.isMesh) return;
            // Non-indexed so every triangle owns its three vertices — shards must
            // be able to fly apart independently.
            const geom = obj.geometry.toNonIndexed();
            geom.computeVertexNormals();
            const pos = geom.attributes.position;
            const faceCount = pos.count / 3;
            const original = new Float32Array(pos.array);

            // Build the per-shard constants and hand them to the GPU as vertex
            // attributes. This happens ONCE; from here the fracture costs two
            // uniform writes per frame instead of a full buffer rewrite.
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

            // Shards fly far outside the mark's rest bounds; without a generous
            // bounding sphere the renderer frustum-culls the mesh mid-burst and
            // the rubble vanishes.
            geom.computeBoundingSphere();
            if (geom.boundingSphere) {
              geom.boundingSphere.radius +=
                Math.max(cfg.scatter[0], cfg.scatter[1]) * 2 + cfg.drift * 2;
            }

            const mesh = new THREE.Mesh(geom, material);
            obj.updateWorldMatrix(true, false);
            mesh.applyMatrix4(obj.matrixWorld);
            // The bounding sphere above is already padded for the burst; keep the
            // renderer from recomputing a tight one and culling the shards.
            mesh.frustumCulled = false;
            group.add(mesh);
          });

          // Center + normalise scale to ~2.5 units.
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);
          group.scale.setScalar(2.5 / Math.max(size.x, size.y, size.z));

          isReady = true;
          // Snap to the current scroll position through the SAME mapping the
          // scroll handler uses. Passing raw `progress` here (as this did) fed an
          // unmapped 0–1 into a function expecting `breakAmount`, shattering the
          // mark far harder than the scroll warranted on any load that finished
          // mid-range. onUpdate may not have fired yet, so map `progress` now.
          breakAmount = breakFromProgress(progress);
          applyBreak(breakAmount);
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
      // Also the run-gate for the animation loop. An IntersectionObserver is no
      // use here: the hero canvas is `fixed inset-0`, so it technically
      // intersects the viewport at every scroll position and IO never reports it
      // as offscreen (measured — the loop kept running at 60fps far down the
      // page). This callback already knows the truth, because `hideOnLeave`
      // computes exactly when the mark stops being shown.
      //
      // Assigned late (see `onRunGate` below) so it can call start/stop, which
      // are declared further down.
      let onRunGate: ((visible: boolean) => void) | null = null;
      const setVisible = (v: boolean) => {
        if (rootRef.current) rootRef.current.style.visibility = v ? "visible" : "hidden";
        onRunGate?.(v);
      };
      const trigger = document.querySelector<HTMLElement>(breakSelector);
      // Scroll → break. The break scrubs across the range; the tick loop owns the
      // continuous rubble motion (so the float never judders with scroll speed) —
      // here we only update `breakAmount` (how shattered it is).
      const st = ScrollTrigger.create({
        trigger: trigger ?? undefined,
        start: cfg.scrollStart,
        end: cfg.scrollEnd,
        // `true` = the break maps 1:1 to scroll position, with NO easing.
        //
        // Measured in-browser over an uneven (realistic) scroll through this
        // range, comparing the rendered break frame to frame:
        //
        //   scrub   biggest jump   max/median jump   lag
        //   true       0.260            1.7×          0%
        //   0.08       0.096           75.7×         19%
        //   1 (orig)   0.027            4.0×         70%
        //
        // A numeric scrub does shrink the single biggest jump, but it makes the
        // motion far LESS even: between wheel events the eased value keeps
        // creeping, so frames alternate between catch-up and near-zero drift.
        // With `true` every frame moves exactly as much as the wheel moved —
        // ratio 1.7×, i.e. the motion is proportional to the input — and the
        // largest frame is large only because the user really did scroll that
        // far. That proportionality is what reads as "locked to my scroll",
        // and the original `scrub: 1` traded it away for 70% lag.
        scrub: true,
        // The break target (`.about-sticky-section`) is sticky and sized in svh,
        // so its height changes when the mobile URL bar shows/hides or on
        // orientation change. Without this the trigger keeps its stale start/end
        // and `progress` steps discontinuously after any such reflow.
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progress = self.progress;
          // Derive visibility from STATE rather than from enter/leave callbacks.
          // A fling that crosses the whole range within one frame, or a reload
          // already scrolled past it, can skip the boundary events and strand the
          // canvas visible over later sections (or hidden over the hero).
          // Recomputing it here is self-correcting at any scroll speed.
          if (hideOnLeave) setVisible(self.progress < 1);
          if (!isReady) return;
          breakAmount = breakFromProgress(progress);
        },
        // Re-assert after a layout refresh, which can move the range under us.
        onRefresh: hideOnLeave ? (self) => setVisible(self.progress < 1) : undefined,
      });

      // Mouse parallax (tilt). Spin velocity is handled in the tick loop.
      let mouseY = 0;
      const onMove = (e: MouseEvent) => {
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      let spin = 0;
      let raf = 0;
      // Global slow-motion factor for ALL rubble motion (wind, turbulence, jitter,
      // tumble). Lower = lazier, more languid drift. One knob to set the pace.
      const MOTION_SPEED = 0.15;
      const t0 = performance.now();
      // Wall-clock of the previous frame, for delta-time. Every accumulator and
      // eased follow below is scaled by dt, so the animation runs at the same
      // real-world rate at 30/60/120Hz and a dropped frame costs no angle. (The
      // old per-frame `+=` made `spin` a running total of frames rendered, so any
      // hitch permanently changed the orientation — the same scroll position
      // could not reproduce the same visual state.)
      let last = t0;
      // NOTE: there is deliberately no SECOND smoothing stage here. `breakAmount`
      // arrives already lightly eased by the ScrollTrigger's small `scrub` (see
      // there for why), and stacking another follow on top of it was what made
      // the mark lag the user and then visibly catch up.
      // ── Run-gating ──────────────────────────────────────────────────────────
      // The mark spins constantly while whole, so it is never "settled" in place
      // — without a gate the loop wakes every frame for the life of the page,
      // even scrolled far past the hero. Profiling an IDLE page found this loop
      // alone responsible for ~630 rAF callbacks in 10s, a large share of the
      // main-thread time Lighthouse attributes to "Other".
      //
      // So the loop runs only when the canvas is actually on screen AND the tab
      // is visible. Both are event-driven (IntersectionObserver / visibility
      // change) — no polling — and `start()` is idempotent so repeated signals
      // can't stack multiple rAF chains.
      let onScreen = true;
      let running = false;

      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };

      const start = () => {
        if (running || !onScreen || document.hidden) return;
        running = true;
        // Reset the delta-time baseline: `last` is stale after a pause, and a
        // huge dt would jump the spin/tilt on the first frame back. (dt is
        // clamped anyway, but this keeps the resume seamless rather than merely
        // bounded.)
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };

      function tick() {
        if (!running) return;
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        // Clamp dt so a backgrounded tab / long task can't teleport the animation
        // on the first frame back (rAF is throttled to ~0 while hidden).
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const elapsed = ((now - t0) / 1000) * MOTION_SPEED; // scaled seconds

        // Spin only the WHOLE mark at a CONSTANT rate — never speeds up. As it
        // shatters toward full rubble the spin velocity fades to zero so it eases
        // to a stop, then the frozen angle holds (the rubble must not rotate).
        const wholeness = 1 - Math.min(breakAmount, 1); // 1 = whole → 0 = full rubble
        spin += cfg.spinSpeed * wholeness * dt;
        group.rotation.y = spin;
        // Mouse tilt only while whole — once it's rubble the GROUP must not rotate
        // at all (the shards disperse/tumble individually instead of orbiting as a
        // clump). Ease the body tilt back to 0 as it shatters.
        //
        // Frame-rate-independent exponential smoothing: 1 - e^(-dt/tau) is the
        // fraction of the remaining distance to close this frame, which converges
        // identically at any refresh rate (a fixed per-frame 0.04 did not).
        const tiltK = 1 - Math.exp(-dt / cfg.tiltTau);
        const tiltTarget = mouseY * 0.25 * wholeness;
        group.rotation.x += (tiltTarget - group.rotation.x) * tiltK;

        // Push this frame's break + flutter clock to the GPU. Two uniform
        // writes — no geometry is touched, so unlike the old CPU path there is
        // nothing expensive to guard against and no "settle once then idle"
        // bookkeeping. The shader reads uBreak == 0 as exactly whole.
        applyBreak(breakAmount, elapsed);

        // Decide whether anything actually changed, purely to avoid a pointless
        // GPU draw when the mark sits whole and still:
        //   • shattered (or mid-flutter) → the shards are moving every frame
        //   • whole → only the idle spin and the easing mouse tilt can change it
        // Test the tilt against its REMAINING DISTANCE, not its absolute angle:
        // the absolute test both missed a tilt easing toward a non-zero target
        // from ~0, and stayed permanently true once tilted.
        const dirty =
          breakAmount > 1e-3 ||
          cfg.spinSpeed * wholeness * dt > 1e-6 ||
          Math.abs(tiltTarget - group.rotation.x) > 1e-5;

        // Only touch the GPU when something actually changed. When the mark sits
        // fully whole + still (e.g. tab backgrounded, or settled), skip the
        // render so the canvas isn't a perpetual main-thread cost.
        if (dirty) renderer.render(scene, camera);
      }

      // Wire the run-gate now that start/stop exist: the moment `hideOnLeave`
      // hides the mark (scrolled past its range) the loop sleeps, and it wakes
      // again when the mark is shown. This is the big win — the hero is a small
      // fraction of a long page, so most of a session now costs zero frames.
      onRunGate = (visible: boolean) => {
        onScreen = visible;
        if (visible) start();
        else stop();
      };

      // A backgrounded tab throttles rAF to ~0 anyway; stopping outright also
      // frees the GPU work and makes the resume deterministic (see `start`).
      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);

      start();

      const onResize = () => {
        const { w, h } = getSize();
        camera.aspect = w / h;
        camera.position.z = cameraZ(); // half size below the mobile breakpoint
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        stop();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("resize", onResize);
        st?.kill();
        renderer.dispose();
        draco.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      canceled = true;
      cleanup();
    };
  }, [motionDisabled, breakSelector, contained, hideOnLeave]);

  // Full-viewport: the canvas fills its box exactly.
  // Contained (footer): the render buffer is container-wide but viewport-TALL (so
  // the logo starts at the full-screen size). The canvas is displayed full-width
  // and viewport-height, centred and clipped by the short box — never stretched
  // to the box height (which would squash it).
  const hostClass = contained
    ? "absolute inset-0 overflow-hidden flex items-center justify-center [&>canvas]:!w-full [&>canvas]:!h-screen [&>canvas]:block [&>canvas]:max-w-none"
    : "absolute inset-0 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:block";

  // The live scene is only shown when it's ready AND motion is allowed. Under
  // reduced motion the poster always wins, so it falls back to the placeholder
  // image in-place no matter when the preference flips.
  const showCanvas = ready && !motionDisabled;

  return (
    <div ref={rootRef} className={`hero-logo3d pointer-events-none ${className}`} aria-hidden="true">
      {/* Poster: shown until the 3D scene is ready (and forever under reduced
          motion). It must frame the mark at the SAME scale as the live canvas,
          so the contained (footer) layout centres it over a viewport-tall box too. */}
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

      {/* WebGL canvas mounts here, fades in when ready. */}
      <div
        ref={canvasHostRef}
        className={hostClass}
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: showCanvas ? 1 : 0 }}
      />
    </div>
  );
}
