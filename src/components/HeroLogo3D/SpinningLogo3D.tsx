// src/components/HeroLogo3D/SpinningLogo3D.tsx
// React island: the 3D brand mark, turning slowly. Nothing else.
//
// The hero's HeroLogo3D is the full effect — an idle spin that holds while you
// scroll, mouse tilt, and a ~17,700-fragment GPU shatter scrubbed against a
// scroll range. This is the same mark with all of that removed: one mesh, one
// constant rotation, no scroll listener, no custom shader. Use it anywhere the
// mark should just sit and turn (the closing CTA).
//
// Same model, material and lighting as the hero, so the two read as one object.
// The canvas sizes itself to its OWN box (ResizeObserver), not the viewport, and
// the render loop only runs while the box is on screen and the tab is visible.
// Under reduced motion Three.js never loads and the poster (children) stands in.
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useMotionPreference, readMotionPreference } from "@/hooks/useMotionPreference";

const MODEL_URL = "/lotties/scroll-affected-lottie-that-breaks/logo.glb";

/** Rotation rate, rad/second — the hero's idle spin rate. */
const SPIN_SPEED = 0.24;

interface Props {
  /** Positioning/sizing/opacity classes from the usage site. */
  className?: string;
  /** Crossfade duration poster → canvas, ms. */
  fadeMs?: number;
}

export default function SpinningLogo3D({
  className = "",
  fadeMs = 180,
  children,
}: PropsWithChildren<Props>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const motionDisabled = useMotionPreference(true);

  useEffect(() => {
    if (motionDisabled) {
      setReady(false);
      return;
    }
    const root = rootRef.current;
    const canvasHost = canvasHostRef.current;
    if (!root || !canvasHost) return;

    let canceled = false;
    let cleanup = () => {};

    (async () => {
      // Never load Three.js under reduced motion, even if the store is stale.
      if (readMotionPreference()) return;

      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (canceled) return;

      const size = () => ({
        w: Math.max(root.clientWidth, 1),
        h: Math.max(root.clientHeight, 1),
      });

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const init = size();
      renderer.setSize(init.w, init.h);
      canvasHost.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // Same camera as the hero (z=5, 45° vertical fov), so the mark fills the
      // same share of the box height and the square poster lines up with it.
      const camera = new THREE.PerspectiveCamera(45, init.w / init.h, 0.1, 100);
      camera.position.z = 5;

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

      let angle = 0;
      let raf = 0;
      let running = false;
      let onScreen = false;
      let last = 0;

      const tick = () => {
        if (!running) return;
        raf = requestAnimationFrame(tick);
        const now = performance.now();
        // Clamp so a long task or a throttled frame can't jump the angle.
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        angle += SPIN_SPEED * dt;
        group.rotation.y = angle;
        renderer.render(scene, camera);
      };

      const start = () => {
        if (running || !onScreen || document.hidden) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      };

      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen ? start() : stop();
      });
      io.observe(root);

      const ro = new ResizeObserver(() => {
        const { w, h } = size();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (!running) renderer.render(scene, camera);
      });
      ro.observe(root);

      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);

      new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
          if (canceled) return;
          // The model as authored — indexed geometry, the stock material, no
          // per-triangle attributes. That is the whole saving over the hero.
          gltf.scene.traverse((obj: any) => {
            if (obj.isMesh) obj.material = material;
          });
          group.add(gltf.scene);

          // Centre and normalise to ~2.5 units, as the hero does.
          const box = new THREE.Box3().setFromObject(group);
          const dims = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
          group.scale.setScalar(2.5 / Math.max(dims.x, dims.y, dims.z));

          renderer.render(scene, camera);
          requestAnimationFrame(() => !canceled && setReady(true));
        },
        undefined,
        (err) => console.error("SpinningLogo3D: failed to load logo.glb", err),
      );

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
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
  }, [motionDisabled]);

  const showCanvas = ready && !motionDisabled;

  return (
    <div ref={rootRef} className={`pointer-events-none ${className}`} aria-hidden="true">
      {/* Poster until the scene is ready, and forever under reduced motion. */}
      <div
        className="absolute inset-0"
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: showCanvas ? 0 : 1 }}
      >
        {children}
      </div>
      <div
        ref={canvasHostRef}
        className="absolute inset-0 [&>canvas]:!h-full [&>canvas]:!w-full [&>canvas]:block"
        style={{ transition: `opacity ${fadeMs}ms ease`, opacity: showCanvas ? 1 : 0 }}
      />
    </div>
  );
}
