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
  /** Base spin velocity (rad/frame) while whole. CONSTANT — never speeds up. */
  spinSpeed: 0.004,
  /** Scroll-progress fraction at which the break reaches `maxBreak`. Higher =
   *  the shatter is spread over more scroll, so it breaks more gradually/slowly. */
  breakEnd: 0.95,
  /** Per-shard break-delay spread. Smaller = shards shatter more in unison. */
  breakDelaySpread: 0.4,
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
      const cameraZ = () => (window.innerWidth < MOBILE_BP ? BASE_Z * 2 : BASE_Z);
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

      // Per-face fracture: each face displaces along a random offset 0 → 1.
      type Face = {
        position: any;
        original: Float32Array;
        offsets: Float32Array;
        delays: Float32Array;
        strengths: Float32Array;
        /** Per-shard jitter seed: [phaseX, phaseY, phaseZ, freq] for the in-place wobble. */
        jitterSeed: Float32Array;
        /** Per-shard drift seed: [phaseX, phaseY, phaseZ, freqScale] for the slow wide wander. */
        driftSeed: Float32Array;
        /** Per-shard rest centroid (x,y,z) — the pivot each shard tumbles around. */
        centroids: Float32Array;
        /** Per-shard fixed outward direction (x,y,z) — where it disperses to. */
        driftDir: Float32Array;
        /** Per-shard tumble seed: [phaseX, phaseY, phaseZ, rateScale] for confetti spin. */
        tumbleSeed: Float32Array;
        /** Per-shard streak flag (1 = long thin sliver) — collapsed once broken. */
        sliver: Uint8Array;
        faceCount: number;
      };
      const faces: Face[] = [];
      let isReady = false;
      let progress = 0;

      // `time` (seconds) drives the per-shard motion. `jitterAmp` is the fast,
      // small in-place wobble; `driftAmp` is a slow, WIDE wander that carries
      // shards away from their rest point so the rubble roams the whole
      // container instead of clustering. `floatGate` (0→1) is the FREE-FLOAT
      // amount — once the mark is rubble it's purely time-driven (NOT scroll-
      // tied), so the debris drifts merrily on its own no matter the scroll.
      // All three are 0 for the hero.
      const applyBreak = (amount: number, time = 0, jitterAmp = 0, driftAmp = 0, tumbleAmp = 0, floatGate = 1) => {
        for (const f of faces) {
          const arr = f.position.array as Float32Array;
          for (let s = 0; s < f.faceCount; s++) {
            // How broken THIS shard is, 0 → 1+ (its delay-staggered progress).
            const shard = Math.max(0, (amount - f.delays[s]) / (1 - f.delays[s]));
            const t = shard * f.strengths[s];
            const ox = f.offsets[s * 3];
            const oy = f.offsets[s * 3 + 1];
            const oz = f.offsets[s * 3 + 2];
            // Motion grows with how shattered the shard is, so the whole logo
            // stays crisp and only loose rubble moves.
            // Free-float amplitude is gated by `floatGate` (time-driven once the
            // mark is rubble), NOT by this shard's scrubbed break — so the drift
            // doesn't scale with scroll position once it's blown apart.
            const free = shard > 0 ? floatGate : 0;
            let jx = 0, jy = 0, jz = 0;
            if (free > 0 && (jitterAmp > 0 || driftAmp > 0)) {
              if (jitterAmp > 0) {
                const px = f.jitterSeed[s * 4];
                const py = f.jitterSeed[s * 4 + 1];
                const pz = f.jitterSeed[s * 4 + 2];
                const freq = f.jitterSeed[s * 4 + 3];
                const a = jitterAmp * free;
                jx += Math.sin(time * freq + px) * a;
                jy += Math.cos(time * freq * 1.3 + py) * a;
                jz += Math.sin(time * freq * 0.7 + pz) * a;
              }
              if (driftAmp > 0) {
                const px = f.driftSeed[s * 4];
                const py = f.driftSeed[s * 4 + 1];
                const pz = f.driftSeed[s * 4 + 2];
                const fs = f.driftSeed[s * 4 + 3]; // per-shard turbulence-speed scale
                const a = driftAmp * free;

                // 0) DISPERSE — a persistent OUTWARD push along each shard's own
                // fixed direction (driftDir) so the field spreads apart to fill the
                // frame and STAYS spread, instead of swarming as a clump. Eases in
                // and saturates (1 - e^-t) so it's a one-way spread, not an orbit.
                const spread = (1 - Math.exp(-time * 0.5)) * driftAmp * free;
                jx += f.driftDir[s * 3] * spread;
                jy += f.driftDir[s * 3 + 1] * spread;
                jz += f.driftDir[s * 3 + 2] * spread;

                // 1) WIND — a shared, slow gust on top of the spread, so the
                // dispersed scraps keep fluttering and shifting (never returns to
                // center; just adds restless motion to the spread-out field).
                const wt = time * 0.18;
                const windX = Math.sin(wt + px * 0.5) + 0.7 * Math.sin(wt * 0.37 + 1.3) + 0.5 * Math.sin(wt * 1.9 + px);
                const windY = Math.cos(wt * 0.8 + py * 0.5) + 0.6 * Math.sin(wt * 0.53 + 2.1) + 0.4 * Math.cos(wt * 1.7 + py);
                const windZ = Math.sin(wt * 1.1 + pz * 0.5) + 0.6 * Math.cos(wt * 0.41 + 0.7);

                // 2) TURBULENCE — fast, sharp per-shard swirl on top of the gust, so
                // each scrap of paper flutters and darts on its own erratic path.
                const w = 0.9 * fs;
                const turbX = Math.sin(time * w * 2.1 + pz) * 0.6;
                const turbY = Math.cos(time * w * 1.7 + px) * 0.6;
                const turbZ = Math.sin(time * w * 2.4 + py) * 0.5;

                // Wind/turbulence are FLUTTER on top of the dispersal — a fraction
                // of the amplitude, so they shimmy the spread-out field without
                // dominating it (the outward spread above is the main travel).
                const fa = a * 0.28;
                jx += (windX + turbX) * fa;
                jy += (windY + turbY) * fa * 0.95;
                jz += (windZ + turbZ) * fa * 0.8;
              }
            }
            // Confetti tumble: spin each shard about its own centroid on all 3
            // axes. Angles advance purely with TIME once the shard is free —
            // gated by `free` (time-driven), so the spin doesn't scale with scroll.
            let useTumble = false;
            let s0 = 1, c0 = 0, s1 = 1, c1 = 0, s2 = 1, c2 = 0;
            let cx = 0, cy = 0, cz = 0;
            if (tumbleAmp > 0 && free > 0) {
              const rate = f.tumbleSeed[s * 4 + 3] * tumbleAmp;
              const ax = time * rate + f.tumbleSeed[s * 4];
              const ay = time * rate * 0.83 + f.tumbleSeed[s * 4 + 1];
              const az = time * rate * 1.17 + f.tumbleSeed[s * 4 + 2];
              // Ease rotation in with the float gate so solid shards stay put.
              s0 = Math.sin(ax * free); c0 = Math.cos(ax * free);
              s1 = Math.sin(ay * free); c1 = Math.cos(ay * free);
              s2 = Math.sin(az * free); c2 = Math.cos(az * free);
              useTumble = true;
            }
            // Centroid (pivot for both tumble and the shrink below).
            cx = f.centroids[s * 3];
            cy = f.centroids[s * 3 + 1];
            cz = f.centroids[s * 3 + 2];
            // Streak shards: collapse to a point as they break free so the rubble
            // has no line-confetti — but they stay FULL while whole (they're real
            // surface faces; removing them from the solid logo would gash it).
            if (f.sliver[s] && free > 0) {
              for (let v = 0; v < 3; v++) {
                const i = (s * 3 + v) * 3;
                // Lerp the 3 verts to the centroid by `free` → zero-area when loose.
                arr[i] = f.original[i] + (cx - f.original[i]) * free;
                arr[i + 1] = f.original[i + 1] + (cy - f.original[i + 1]) * free;
                arr[i + 2] = f.original[i + 2] + (cz - f.original[i + 2]) * free;
              }
              continue;
            }
            // Shrink each shard toward its centroid as it breaks free: full size
            // while WHOLE (so the starting logo is solid and continuous), down to
            // half size once it's loose rubble. `free` 0→1 drives it.
            const shardScale = 1 - 0.5 * free;
            for (let v = 0; v < 3; v++) {
              const i = (s * 3 + v) * 3;
              // Start from the centroid-relative vertex, scaled by shardScale.
              let bx = cx + (f.original[i] - cx) * shardScale;
              let by = cy + (f.original[i + 1] - cy) * shardScale;
              let bz = cz + (f.original[i + 2] - cz) * shardScale;
              if (useTumble) {
                // Rotate (vert - centroid) about X, then Y, then Z; restore centroid.
                let dx = bx - cx, dy = by - cy, dz = bz - cz;
                let ny = dy * c0 - dz * s0; let nz = dy * s0 + dz * c0; dy = ny; dz = nz; // X
                let nx = dx * c1 + dz * s1; nz = -dx * s1 + dz * c1; dx = nx; dz = nz;    // Y
                nx = dx * c2 - dy * s2; ny = dx * s2 + dy * c2; dx = nx; dy = ny;         // Z
                bx = cx + dx; by = cy + dy; bz = cz + dz;
              }
              arr[i] = bx + ox * t + jx;
              arr[i + 1] = by + oy * t + jy;
              arr[i + 2] = bz + oz * t + jz;
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
            const driftSeed = new Float32Array(faceCount * 4);
            const centroids = new Float32Array(faceCount * 3);
            const driftDir = new Float32Array(faceCount * 3);
            const tumbleSeed = new Float32Array(faceCount * 4);
            const sliver = new Uint8Array(faceCount); // 1 = streak shard, hidden once broken
            for (let i = 0; i < faceCount; i++) {
              // Per-axis scatter extent (how far each shard flies on full break).
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
              // Drift: independent phases + a slow per-shard frequency scale, so
              // each shard wanders the container on its own slow, unique path.
              driftSeed[i * 4] = Math.random() * Math.PI * 2;
              driftSeed[i * 4 + 1] = Math.random() * Math.PI * 2;
              driftSeed[i * 4 + 2] = Math.random() * Math.PI * 2;
              driftSeed[i * 4 + 3] = 0.5 + Math.random() * 1.0;
              // Tumble: rest centroid (pivot) + per-axis phase + a per-shard rate
              // scale, so each flake of confetti spins at its own speed/angle.
              const i0 = (i * 3 + 0) * 3, i1 = (i * 3 + 1) * 3, i2 = (i * 3 + 2) * 3;
              const cX = (original[i0] + original[i1] + original[i2]) / 3;
              const cY = (original[i0 + 1] + original[i1 + 1] + original[i2 + 1]) / 3;
              const cZ = (original[i0 + 2] + original[i1 + 2] + original[i2 + 2]) / 3;
              centroids[i * 3] = cX;
              centroids[i * 3 + 1] = cY;
              centroids[i * 3 + 2] = cZ;

              // FLAG line/sliver shards — long thin triangles that render as
              // streaks once they break free. We do NOT remove them from the solid
              // logo (they're real surface faces — removing them gashes the mark);
              // instead applyBreak collapses them to a point ONLY as they shatter,
              // so the whole logo stays intact but the rubble has no streaks.
              const eA = Math.hypot(original[i1] - original[i0], original[i1 + 1] - original[i0 + 1], original[i1 + 2] - original[i0 + 2]);
              const eB = Math.hypot(original[i2] - original[i1], original[i2 + 1] - original[i1 + 1], original[i2 + 2] - original[i1 + 2]);
              const eC = Math.hypot(original[i0] - original[i2], original[i0 + 1] - original[i2 + 1], original[i0 + 2] - original[i2 + 2]);
              const longest = Math.max(eA, eB, eC);
              const shortest = Math.min(eA, eB, eC);
              const SLIVER_ASPECT = 6; // longest edge ≥ 6× shortest ⇒ a streak
              sliver[i] = shortest <= 1e-6 || longest / shortest >= SLIVER_ASPECT ? 1 : 0;
              // Fixed OUTWARD dispersal direction: centroid-away-from-origin biased
              // wide on the screen plane (x,y) + a big random component so the
              // field fans out everywhere, not as a clean radial starburst. Z is
              // damped so shards spread across the frame, not deep toward camera.
              let dX = cX + (Math.random() - 0.5) * 3;
              let dY = cY + (Math.random() - 0.5) * 3;
              let dZ = (cZ + (Math.random() - 0.5) * 1.5) * 0.4;
              const dLen = Math.hypot(dX, dY, dZ) || 1;
              driftDir[i * 3] = dX / dLen;
              driftDir[i * 3 + 1] = dY / dLen;
              driftDir[i * 3 + 2] = dZ / dLen;
              tumbleSeed[i * 4] = Math.random() * Math.PI * 2;
              tumbleSeed[i * 4 + 1] = Math.random() * Math.PI * 2;
              tumbleSeed[i * 4 + 2] = Math.random() * Math.PI * 2;
              tumbleSeed[i * 4 + 3] = 0.6 + Math.random() * 1.4;
            }
            const mesh = new THREE.Mesh(geom, material);
            obj.updateWorldMatrix(true, false);
            mesh.applyMatrix4(obj.matrixWorld);
            group.add(mesh);
            faces.push({ position: pos, original, offsets, delays, strengths, jitterSeed, driftSeed, centroids, driftDir, tumbleSeed, sliver, faceCount });
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
      // Scroll-SCRUBBED shatter + reassembly across the WHOLE page:
      //   progress 0 → SPIN_END           : whole (break 0)
      //   SPIN_END → SHATTER_END          : break ramps 0 → 1 (falls apart)
      //   SHATTER_END → REBUILD_START     : full rubble (drifts behind the lower
      //                                     sections — blog / testimonials)
      //   REBUILD_START → REBUILD_END     : break eases 1 → 0 (reassembles)
      //   REBUILD_END → 1                 : fully whole, HELD (covers the footer
      //                                     with margin so scrub-lag never leaves
      //                                     stray shards at the bottom).
      // Tuned against the WHOLE-page scroll: stay whole through the hero +
      // solutions, then shatter WHILE the About text is on screen (it used to
      // break during the About section), hold as rubble through the
      // portfolio/blog/testimonials, and reassemble for the footer.
      const SPIN_END = 0.16;       // whole through the hero
      const SHATTER_END = 0.34;    // shatter spans the About section
      const REBUILD_START = 0.78;  // start reassembling before the footer
      const REBUILD_END = 0.94;    // fully back together → whole through the footer

      // Latest break amount (scroll-driven), re-applied every frame by the tick
      // loop so the rubble keeps animating even when the scroll position is static.
      let breakAmount = 0;

      const trigger = document.querySelector<HTMLElement>(breakSelector);
      // Scroll → break. The break scrubs across the range; the tick loop owns the
      // continuous rubble motion (so the float never judders with scroll speed) —
      // here we only update `breakAmount` (how shattered it is).
      const st = ScrollTrigger.create({
        trigger: trigger ?? undefined,
        start: cfg.scrollStart,
        end: cfg.scrollEnd,
        scrub: 1,
        onUpdate: (self) => {
          progress = self.progress;
          if (!isReady) return;
          // Triangle-ish curve: ramp up to full break, hold, then ramp back down.
          if (progress <= SPIN_END) {
            breakAmount = 0;
          } else if (progress < SHATTER_END) {
            // Shatter 0 → 1.
            breakAmount = ((progress - SPIN_END) / (SHATTER_END - SPIN_END)) * cfg.maxBreak;
          } else if (progress < REBUILD_START) {
            // Full rubble — drifts behind the lower sections.
            breakAmount = cfg.maxBreak;
          } else if (progress < REBUILD_END) {
            // Reassemble 1 → 0.
            breakAmount =
              (1 - (progress - REBUILD_START) / (REBUILD_END - REBUILD_START)) * cfg.maxBreak;
          } else {
            // Held fully whole through the footer (exactly 0 — no stray shards).
            breakAmount = 0;
          }
        },
        // Hide once scrolled past the range when requested (a fixed/overlapping
        // canvas would otherwise show through later sections).
        onLeave: hideOnLeave ? () => setVisible(false) : undefined,
        onEnterBack: hideOnLeave ? () => setVisible(true) : undefined,
      });

      // Mouse parallax (tilt). Spin velocity is handled in the tick loop.
      let mouseY = 0;
      const onMove = (e: MouseEvent) => {
        mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("mousemove", onMove, { passive: true });

      let spin = 0;
      let raf = 0;
      // Free-float gate: 0 while whole, eases toward 1 once it's rubble, and
      // eases back to 0 as the mark REASSEMBLES — so the wind/drift/tumble unwind
      // and the shards return to their origin for a clean rebuild (it no longer
      // latches open). Tracks breakAmount so float is present only while broken.
      let floatGate = 0;
      const FLOAT_BREAK_THRESH = 0.25; // float on once break passes this; off again as it falls back below
      // Global slow-motion factor for ALL rubble motion (wind, turbulence, jitter,
      // tumble). Lower = lazier, more languid drift. One knob to set the pace.
      const MOTION_SPEED = 0.15;
      const t0 = performance.now();
      // True on frames where applyBreak displaced vertices — so we can write the
      // identity positions ONE more time when motion stops, then skip the hot
      // per-vertex work while the mark sits whole.
      let brokeLastFrame = false;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const elapsed = ((performance.now() - t0) / 1000) * MOTION_SPEED; // scaled seconds

        // Open the gate once shattered; ease it (time-based) so it fades in quickly
        // enough to be storming while the shards are still bursting outward.
        const floatTarget = breakAmount >= FLOAT_BREAK_THRESH ? 1 : 0;
        floatGate += (floatTarget - floatGate) * 0.12;

        // Spin only the WHOLE mark at a CONSTANT rate — never speeds up. As it
        // shatters toward full rubble the spin velocity fades to zero so it eases
        // to a stop, then the frozen angle holds (the rubble must not rotate).
        const wholeness = 1 - Math.min(breakAmount, 1); // 1 = whole → 0 = full rubble
        spin += cfg.spinSpeed * wholeness;
        group.rotation.y = spin;
        // Mouse tilt only while whole — once it's rubble the GROUP must not rotate
        // at all (the shards disperse/tumble individually instead of orbiting as a
        // clump). Ease the body tilt back to 0 as it shatters.
        group.rotation.x += ((mouseY * 0.25 * wholeness) - group.rotation.x) * 0.04;

        // Continuous rubble motion: re-apply break + time-based jitter + drift
        // (outward dispersal + wind) + tumble every frame, so the shattered field
        // keeps blowing around even when the scroll position is static.
        //
        // PERF: applyBreak is the hot path — it touches every shard vertex. When
        // the mark is fully WHOLE and settled (breakAmount ~0 AND the float gate
        // has eased shut), there is nothing to displace, so skip it entirely. We
        // run it once more after settling (`brokeLastFrame`) to write the final
        // identity positions, then stay idle until the next shatter. This is what
        // keeps the now-full-page logo from burning the main thread forever.
        const animating = breakAmount > 1e-3 || floatGate > 1e-3;
        let dirty = false; // did anything visible change this frame?
        if (isReady && (cfg.jitter > 0 || cfg.drift > 0 || cfg.tumble > 0)) {
          if (animating) {
            applyBreak(breakAmount, elapsed, cfg.jitter, cfg.drift, cfg.tumble, floatGate);
            brokeLastFrame = true;
            dirty = true;
          } else if (brokeLastFrame) {
            applyBreak(0); // settle to exact whole once, then idle
            brokeLastFrame = false;
            dirty = true;
          }
        }

        // While WHOLE the mark still spins, so its rotation changes each frame —
        // that's a cheap visual update and must keep rendering. Track it as dirty
        // too. (When fully rubble, wholeness→0 so the spin delta is ~0 and the
        // applyBreak path above carries the motion instead.)
        if (Math.abs(cfg.spinSpeed * wholeness) > 1e-5 || Math.abs(group.rotation.x) > 1e-4) {
          dirty = true;
        }

        // Only touch the GPU when something actually changed. When the mark sits
        // fully whole + still (e.g. tab backgrounded, or settled), skip the
        // render so the now-full-page canvas isn't a perpetual main-thread cost.
        if (dirty) renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        const { w, h } = getSize();
        camera.aspect = w / h;
        camera.position.z = cameraZ(); // half size below the mobile breakpoint
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
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
