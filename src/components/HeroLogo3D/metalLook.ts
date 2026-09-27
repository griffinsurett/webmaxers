// src/components/HeroLogo3D/metalLook.ts
/**
 * The brand mark's polished-metal look, used by HeroLogo3D — which renders
 * every 3D logo on the site (the hero, and the CTA via `variant="spin"`), so
 * they are always the same object. Tune the look here.
 *
 *   • Material: fully metallic, low roughness, clearcoat. The base tone follows
 *     the page theme (METAL below) and switches live when the theme toggles.
 *   • Reflections: metal has no colour of its own — it only shows what it
 *     reflects. A prefiltered studio environment gives every bevel something to
 *     mirror. It lights the mark only; the canvas background stays transparent.
 *   • Lights: a flat face reflects a distant environment as ONE flat tone, so
 *     the environment alone reads as grey plastic. The sweeping highlights come
 *     from point lights CLOSE to the mark, whose reflection moves across each
 *     face as it turns.
 *   • Normals: creased (see loadSmoothNormals).
 *
 * Both placements frame the mark the same way (centred at the origin, ~2.5
 * units, camera at z=5), which is what the light positions are placed against.
 */

/**
 * Mirror images of each other: white metal on the near-black dark background
 * (#080808), deep black metal on the near-white light one. Gunmetal was tried
 * on dark and read as silver — mid-grey sitting between the two.
 */
const METAL = {
  dark: { color: 0xf4f5f7, env: 1.4 },
  light: { color: 0x08090a, env: 0.4 },
};

/**
 * Loads the creased-normals helper and returns a SYNC `smooth(geometry)` — the
 * GLTF load callback that uses it is synchronous. `smooth` returns NON-INDEXED
 * geometry (every triangle owns its vertices), which the hero's shatter needs
 * anyway.
 *
 * computeVertexNormals() on non-indexed geometry gives every triangle its own
 * flat normal, so each facet of the ring caught the light separately and the
 * curve read as a strip of bands. toCreasedNormals averages normals across
 * edges shallower than the crease angle (the ring's facets, a few degrees apart
 * → one smooth curve) and keeps them split across sharper ones (the 90°
 * front/side edges → still crisp).
 */
export async function loadSmoothNormals() {
  const { toCreasedNormals } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  return (geometry: any) => toCreasedNormals(geometry, Math.PI / 6);
}

/**
 * Set up the metal look on a renderer + scene. `onThemeChange` runs after a
 * theme switch so an idle render loop can repaint.
 */
export async function createMetalLook(
  THREE: any,
  renderer: any,
  scene: any,
  onThemeChange: () => void = () => {},
) {
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  // Filmic tone mapping rolls the bright reflections off smoothly instead of
  // clipping them to flat white — what keeps the metal reading as polished.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap; // intensity is set per theme (applyTheme)

  // In FRONT of the mark (z > 0, near the camera line) so its reflection lands
  // on the broad front faces as a soft gradient from the lower left.
  const sweepLow = new THREE.PointLight(0xffffff, 30, 0, 2);
  sweepLow.position.set(-1.2, -1.6, 3.2);
  scene.add(sweepLow);
  const sweepHigh = new THREE.PointLight(0xffffff, 14, 0, 2);
  sweepHigh.position.set(1.8, 2.6, 1.6);
  scene.add(sweepHigh);
  // A faint key so edges on the unlit side still separate from the page.
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(3, 5, 5);
  scene.add(keyLight);

  // Polished metal plus a clearcoat layer for the glossy lacquer highlight.
  const material = new THREE.MeshPhysicalMaterial({
    color: METAL.dark.color,
    metalness: 1,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });

  const applyTheme = () => {
    const t = document.documentElement.dataset.theme === "light" ? METAL.light : METAL.dark;
    material.color.setHex(t.color);
    scene.environmentIntensity = t.env;
  };
  applyTheme();

  const themeObserver = new MutationObserver(() => {
    applyTheme();
    onThemeChange();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return {
    material,
    dispose() {
      themeObserver.disconnect();
      material.dispose();
      envMap.dispose();
      pmrem.dispose();
    },
  };
}
