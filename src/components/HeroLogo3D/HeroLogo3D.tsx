// src/components/HeroLogo3D/HeroLogo3D.tsx
// React island: the fracturing 3D brand mark. Renders the poster (children)
// immediately; the heavy Three.js scene only mounts AFTER hydration — and the
// island is hydrated with `client:firstInteraction` from the .astro wrapper, so
// nothing heavy loads until the user interacts. Reduced motion: poster only, the
// WebGL scene never loads (mirrors LottieLogo / OptimizedLottie).
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMotionPreference, readMotionPreference } from "@/hooks/useMotionPreference";

const MODEL_URL = "/lotties/scroll-affected-lottie-that-breaks/logo.glb";

interface Props {
  /** Tailwind classes for positioning/sizing/opacity at the usage site. */
  className?: string;
  /** Selector of the element the break scrubs across (top → bottom). */
  breakSelector?: string;
  /** Crossfade duration poster → canvas, ms. */
  fadeMs?: number;
  respectReducedMotion?: boolean;
}

export default function HeroLogo3D({
  className = "",
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

      // Renderer / scene / camera — transparent, sits behind content.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      canvasHost.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
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
        faceCount: number;
      };
      const faces: Face[] = [];
      let isReady = false;
      let progress = 0;

      const applyBreak = (amount: number) => {
        for (const f of faces) {
          const arr = f.position.array as Float32Array;
          for (let s = 0; s < f.faceCount; s++) {
            const t = Math.max(0, (amount - f.delays[s]) / (1 - f.delays[s])) * f.strengths[s];
            const ox = f.offsets[s * 3];
            const oy = f.offsets[s * 3 + 1];
            const oz = f.offsets[s * 3 + 2];
            for (let v = 0; v < 3; v++) {
              const i = (s * 3 + v) * 3;
              arr[i] = f.original[i] + ox * t;
              arr[i + 1] = f.original[i + 1] + oy * t;
              arr[i + 2] = f.original[i + 2] + oz * t;
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
            for (let i = 0; i < faceCount; i++) {
              // Shards scatter half the distance (tighter shatter).
              offsets[i * 3] = (Math.random() - 0.5) * 5;
              offsets[i * 3 + 1] = (Math.random() - 0.5) * 5;
              offsets[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
              delays[i] = Math.random() * 0.4;
              strengths[i] = 0.5 + Math.random() * 1.5;
            }
            const mesh = new THREE.Mesh(geom, material);
            obj.updateWorldMatrix(true, false);
            mesh.applyMatrix4(obj.matrixWorld);
            group.add(mesh);
            faces.push({ position: pos, original, offsets, delays, strengths, faceCount });
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
      // Scroll runs in two phases: first the logo spins UP (faster spin, no
      // break), then it shatters.
      //   progress 0 → SPIN_END : spin accelerates, break stays 0
      //   progress SPIN_END → 1 : break ramps 0 → 1
      const SPIN_END = 0.15;
      let scrollSpin = 0; // 0 (idle) → 1 (max spin-up), set by phase 1

      const trigger = document.querySelector<HTMLElement>(breakSelector);
      const st = ScrollTrigger.create({
        trigger: trigger ?? undefined,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          progress = self.progress;
          // Phase 1: ramp spin speed up to full by SPIN_END.
          scrollSpin = Math.min(progress / SPIN_END, 1);
          // Phase 2: remap the back half to the break amount 0 → 1.
          const breakAmount =
            progress <= SPIN_END
              ? 0
              : (progress - SPIN_END) / (1 - SPIN_END);
          if (isReady) applyBreak(breakAmount);
        },
        onLeave: () => setVisible(false),
        onEnterBack: () => setVisible(true),
      });

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
      const tick = () => {
        raf = requestAnimationFrame(tick);
        spin += BASE_SPIN + (MAX_SPIN - BASE_SPIN) * scrollSpin;
        group.rotation.y = spin;
        group.rotation.x += (mouseY * 0.25 - group.rotation.x) * 0.04;
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
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
  }, [motionDisabled, breakSelector]);

  return (
    <div ref={rootRef} className={`hero-logo3d pointer-events-none ${className}`} aria-hidden="true">
      {/* Poster: shown until the 3D scene is ready (and forever under reduced motion). */}
      <div
        className="absolute inset-0"
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: ready ? 0 : 1 }}
      >
        {children}
      </div>

      {/* WebGL canvas mounts here, fades in when ready. */}
      <div
        ref={canvasHostRef}
        className="absolute inset-0 [&>canvas]:!w-full [&>canvas]:!h-full [&>canvas]:block"
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
