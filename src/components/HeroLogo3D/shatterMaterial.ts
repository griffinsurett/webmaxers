// src/components/HeroLogo3D/shatterMaterial.ts
/**
 * GPU shatter material for HeroLogo3D.
 *
 * See `docs/hero-logo-3d-spec.md` for what this is supposed to look like. In
 * short: the mark disintegrates into ~17,700 individually-staggered fragments
 * that shrink as they break free, then blow around the frame like torn paper —
 * thrown outward, pushed by a shared gust, each scrap fluttering on its own.
 *
 * ── The two invariants ─────────────────────────────────────────────────────
 * A previous version of this effect glitched badly, and both causes were
 * structural rather than a matter of tuning. These rules are what prevent them,
 * and every term below is written to obey them:
 *
 *  1. TIME IS ALWAYS BOUNDED. `uTime` may appear ONLY inside sin/cos. It
 *     animates the SHAPE of the flutter, never its amplitude, and never an angle
 *     or a position directly.
 *
 *     The old tumble was `ang = (uTime * rate + seed) * free` — an angle fed
 *     straight into a rotation matrix, growing forever. After 15 minutes on the
 *     page each shard had spun 206 times, and because the term was scaled by
 *     `free` the rate also changed as you scrolled. That is what "spins wildly
 *     and unpredictably" was.
 *
 *  2. AMPLITUDES ARE SCALED TO THE CAMERA FRAME. At z=5 with a 45° fov the
 *     visible area is only ±3.31 × ±2.07 units and the mark is 2.5 units. The
 *     old scatter threw shards ~15 units — 7× outside the frame — so the rubble
 *     left the screen instantly instead of filling it, and a flutter 4× the
 *     frame height swept the survivors in and out of view. Every amplitude here
 *     is chosen against those numbers; see CFG in HeroLogo3D.tsx.
 *
 * Because every displacement term is scaled by the shard's own break amount,
 * displacement is a pure function of `uBreak`: scrolling up retraces scrolling
 * down exactly, and `uBreak == 0` is provably the untouched mark.
 *
 * Built on MeshStandardMaterial via onBeforeCompile so the mark keeps the
 * scene's real lighting instead of dropping to a flat custom shader.
 */

/** Per-shard attribute buffers, built once at load and uploaded to the GPU. */
export interface ShatterAttributes {
  /** Random scatter direction × per-axis extent (x,y,z). */
  aOffset: Float32Array;
  /** [delay, strength, sliver, tumbleRate] packed per vertex. */
  aShard: Float32Array;
  /** Rest centroid — the pivot each shard tumbles and shrinks around. */
  aCentroid: Float32Array;
  /** Fixed outward dispersal direction (normalised). */
  aDriftDir: Float32Array;
  /** [phaseX, phaseY, phaseZ, freq] for the fast in-place jitter. */
  aJitterSeed: Float32Array;
  /** [phaseX, phaseY, phaseZ, freqScale] for the slow wide drift. */
  aDriftSeed: Float32Array;
  /** [phaseX, phaseY, phaseZ, rateScale] for the flutter/tumble. */
  aTumbleSeed: Float32Array;
}

export interface ShatterUniforms {
  /** 0 = whole, 1 = fully shattered. Scroll-driven. */
  uBreak: { value: number };
  /** Flutter clock, seconds. Only ever inside sin/cos — see invariant 1. */
  uTime: { value: number };
  uJitter: { value: number };
  uDrift: { value: number };
  uTumble: { value: number };
  uShardShrink: { value: number };
  /** Peak rock of the per-shard flutter, radians. Bounded by construction. */
  uTumbleSwing: { value: number };
}

const SHATTER_CHUNK = /* glsl */ `
  // How broken THIS shard is, 0 → 1 (its delay-staggered progress). The stagger
  // is what makes the mark erode in a spreading wave instead of detonating.
  //
  // LINEAR on purpose: uBreak is already smoothstepped once by the CPU
  // (breakFromProgress). Smoothstepping again stacks two S-curves, and the
  // squared spread term below turns that into a 6th-order ramp whose
  // acceleration spikes mid-burst — shards lurch, coast, then lurch to a halt.
  float delay    = aShard.x;
  float strength = aShard.y;
  float sliver   = aShard.z;
  float tumbRate = aShard.w;

  float shard = clamp((uBreak - delay) / max(1.0 - delay, 1e-4), 0.0, 1.0);
  // free IS the shard's break amount — scroll owns "how loose", time owns only
  // "how it flutters". This is what makes the effect exactly reversible.
  float free = shard;

  vec3 displaced = position;

  if (free > 1e-4) {
    vec3 shardPivot = aCentroid;

    // ── Sliver shards ────────────────────────────────────────────────────
    // Long thin triangles render as ugly streaks once loose, but they are real
    // surface faces — removing them from the solid mark would gash it. So they
    // stay full-size while whole and collapse to a point as they break free.
    if (sliver > 0.5) {
      displaced = mix(position, shardPivot, free);
    } else {
      // ── Shrink toward the centroid ─────────────────────────────────────
      // Full size while whole (the mark reads solid), down to a small fleck
      // once loose, so the rubble looks like dust rather than chunks.
      float shardScale = 1.0 - uShardShrink * free;
      vec3 local = (position - shardPivot) * shardScale;

      // ── Flutter / tumble ───────────────────────────────────────────────
      // A BOUNDED ROCK, not a spin. uTime lives strictly inside sin(), and
      // free scales the resulting AMPLITUDE — so a scrap rocks through at most
      // ±uTumbleSwing radians, starts from exactly 0 as it breaks free, and
      // unwinds to exactly 0 as it reassembles.
      //
      // It must NOT be (uTime * rate) * free: that is an angle that grows
      // without bound, so shards spin ever faster and change rate as you scroll.
      // Keeping the swing modest also matters for the wind-down — the group's
      // own spin fades to zero as the mark breaks, and if each scrap then
      // whirled through ±150° the rotation would not have stopped at all, it
      // would just have moved from one object to fifty thousand.
      float rate = tumbRate * uTumble;
      vec3 ang = vec3(
        sin(uTime * rate         + aTumbleSeed.x),
        sin(uTime * rate * 0.83  + aTumbleSeed.y),
        sin(uTime * rate * 1.17  + aTumbleSeed.z)
      ) * (uTumbleSwing * free);

      vec3 s = sin(ang);
      vec3 c = cos(ang);

      // Rotate about X, then Y, then Z.
      vec3 r = local;
      float ny = r.y * c.x - r.z * s.x;
      float nz = r.y * s.x + r.z * c.x;
      r.y = ny; r.z = nz;

      float nx = r.x * c.y + r.z * s.y;
      nz = -r.x * s.y + r.z * c.y;
      r.x = nx; r.z = nz;

      nx = r.x * c.z - r.y * s.z;
      ny = r.x * s.z + r.y * c.z;
      r.x = nx; r.y = ny;

      displaced = shardPivot + r;

      // ── Throw ──────────────────────────────────────────────────────────
      // The primary scatter: each shard flies along its own random vector,
      // fastest at the moment it breaks free. Sized so the field lands ON the
      // frame (see invariant 2), not far beyond it.
      displaced += aOffset * (shard * strength);

      // ── Jitter: fast, small, in-place wobble ───────────────────────────
      float jf = aJitterSeed.w;
      float ja = uJitter * free;
      displaced += vec3(
        sin(uTime * jf         + aJitterSeed.x),
        cos(uTime * jf * 1.3   + aJitterSeed.y),
        sin(uTime * jf * 0.7   + aJitterSeed.z)
      ) * ja;

      // ── Dispersal + wind + turbulence ──────────────────────────────────
      float fsc = aDriftSeed.w;
      float da  = uDrift * free;

      // Outward push along the shard's fixed direction. Driven by free
      // (scroll), never by elapsed time: a (1 - exp(-t)) style ramp would only
      // ever grow, so shards would keep travelling outward while you scrolled
      // back up and reassembly would not be the inverse of breakup.
      displaced += aDriftDir * (free * uDrift * free);

      // A shared slow gust. Because every shard reads the SAME wt, the whole
      // field drifts together as one mass — that is what reads as wind rather
      // than as an explosion.
      float wt = uTime * 0.18;
      vec3 wind = vec3(
        sin(wt + aDriftSeed.x * 0.5) + 0.7 * sin(wt * 0.37 + 1.3) + 0.5 * sin(wt * 1.9 + aDriftSeed.x),
        cos(wt * 0.8 + aDriftSeed.y * 0.5) + 0.6 * sin(wt * 0.53 + 2.1) + 0.4 * cos(wt * 1.7 + aDriftSeed.y),
        sin(wt * 1.1 + aDriftSeed.z * 0.5) + 0.6 * cos(wt * 0.41 + 0.7)
      );

      // Fast per-shard swirl so each scrap darts on its own erratic path.
      float w = 0.9 * fsc;
      vec3 turb = vec3(
        sin(uTime * w * 2.1 + aDriftSeed.z) * 0.6,
        cos(uTime * w * 1.7 + aDriftSeed.x) * 0.6,
        sin(uTime * w * 2.4 + aDriftSeed.y) * 0.5
      );

      // Wind/turbulence are FLUTTER on top of the dispersal — a fraction of the
      // amplitude, so they shimmy the field without dominating its travel.
      vec3 flutter = (wind + turb) * (da * 0.28);
      displaced += vec3(flutter.x, flutter.y * 0.95, flutter.z * 0.8);
    }
  }
`;

/**
 * Patch a MeshStandardMaterial to displace vertices on the GPU.
 *
 * Returns the uniforms object so the render loop can drive `uBreak` / `uTime`
 * without touching geometry — the whole per-frame cost is two uniform writes,
 * and the vertex shader does the maths for every vertex in parallel.
 */
export function applyShatterToMaterial(
  material: any,
  opts: {
    jitter: number;
    drift: number;
    tumble: number;
    shardShrink: number;
    tumbleSwing: number;
  },
): ShatterUniforms {
  const uniforms: ShatterUniforms = {
    uBreak: { value: 0 },
    uTime: { value: 0 },
    uJitter: { value: opts.jitter },
    uDrift: { value: opts.drift },
    uTumble: { value: opts.tumble },
    uShardShrink: { value: opts.shardShrink },
    uTumbleSwing: { value: opts.tumbleSwing },
  };

  material.onBeforeCompile = (shader: any) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uBreak;
        uniform float uTime;
        uniform float uJitter;
        uniform float uDrift;
        uniform float uTumble;
        uniform float uShardShrink;
        uniform float uTumbleSwing;
        attribute vec3 aOffset;
        attribute vec4 aShard;
        attribute vec3 aCentroid;
        attribute vec3 aDriftDir;
        attribute vec4 aJitterSeed;
        attribute vec4 aDriftSeed;
        attribute vec4 aTumbleSeed;
      `,
      )
      // `begin_vertex` defines `transformed`, the position everything downstream
      // (projection, shadows, fog) builds on — so replacing it is enough to move
      // the mark without touching the rest of the standard pipeline.
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        ${SHATTER_CHUNK}
        vec3 transformed = displaced;
      `,
      );
  };

  // Force a recompile if the material was already used, and vary the program
  // cache key so three.js cannot hand this material a program compiled for an
  // unpatched MeshStandardMaterial.
  material.needsUpdate = true;
  material.customProgramCacheKey = () => "logo-shatter-v2";

  return uniforms;
}

/**
 * Build the per-shard attribute buffers for one non-indexed geometry.
 *
 * Every vertex of a triangle gets the SAME shard values, so the three corners
 * move together and the face stays rigid.
 *
 * Randomness is a deterministic hash of the triangle index rather than
 * Math.random(), so a reload produces the identical shatter — one less way for
 * "it looked different that time" to be true.
 */
export function buildShatterAttributes(
  original: Float32Array,
  faceCount: number,
  cfg: { scatter: [number, number, number]; breakDelaySpread: number },
): ShatterAttributes {
  const vertCount = faceCount * 3;
  const aOffset = new Float32Array(vertCount * 3);
  const aShard = new Float32Array(vertCount * 4);
  const aCentroid = new Float32Array(vertCount * 3);
  const aDriftDir = new Float32Array(vertCount * 3);
  const aJitterSeed = new Float32Array(vertCount * 4);
  const aDriftSeed = new Float32Array(vertCount * 4);
  const aTumbleSeed = new Float32Array(vertCount * 4);

  // Deterministic hash → [0,1). Same model, same shatter, every load.
  let seedN = 0;
  const rand = () => {
    seedN += 1;
    const x = Math.sin(seedN * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const TAU = Math.PI * 2;

  for (let i = 0; i < faceCount; i++) {
    const ox = (rand() - 0.5) * cfg.scatter[0];
    const oy = (rand() - 0.5) * cfg.scatter[1];
    const oz = (rand() - 0.5) * cfg.scatter[2];
    const delay = rand() * cfg.breakDelaySpread;
    const strength = 0.5 + rand() * 1.5;

    const jp = [rand() * TAU, rand() * TAU, rand() * TAU, 0.6 + rand() * 1.8];
    const dp = [rand() * TAU, rand() * TAU, rand() * TAU, 0.5 + rand() * 1.0];
    const tp = [rand() * TAU, rand() * TAU, rand() * TAU, 0.6 + rand() * 1.4];

    const i0 = (i * 3 + 0) * 3;
    const i1 = (i * 3 + 1) * 3;
    const i2 = (i * 3 + 2) * 3;
    const cX = (original[i0] + original[i1] + original[i2]) / 3;
    const cY = (original[i0 + 1] + original[i1 + 1] + original[i2 + 1]) / 3;
    const cZ = (original[i0 + 2] + original[i1 + 2] + original[i2 + 2]) / 3;

    // Flag long thin triangles — they render as streaks once loose, so the
    // shader collapses them to a point as they break free.
    const eA = Math.hypot(
      original[i1] - original[i0],
      original[i1 + 1] - original[i0 + 1],
      original[i1 + 2] - original[i0 + 2],
    );
    const eB = Math.hypot(
      original[i2] - original[i1],
      original[i2 + 1] - original[i1 + 1],
      original[i2 + 2] - original[i1 + 2],
    );
    const eC = Math.hypot(
      original[i0] - original[i2],
      original[i0 + 1] - original[i2 + 1],
      original[i0 + 2] - original[i2 + 2],
    );
    const longest = Math.max(eA, eB, eC);
    const shortest = Math.min(eA, eB, eC);
    const SLIVER_ASPECT = 6;
    const sliver = shortest <= 1e-6 || longest / shortest >= SLIVER_ASPECT ? 1 : 0;

    // Outward dispersal direction: centroid-away-from-origin, biased wide on the
    // screen plane and damped in Z so the field fans across the frame rather
    // than diving toward the camera.
    let dX = cX + (rand() - 0.5) * 3;
    let dY = cY + (rand() - 0.5) * 3;
    let dZ = (cZ + (rand() - 0.5) * 1.5) * 0.4;
    const dLen = Math.hypot(dX, dY, dZ) || 1;
    dX /= dLen;
    dY /= dLen;
    dZ /= dLen;

    // Write the same shard values to all three corners of the triangle.
    for (let v = 0; v < 3; v++) {
      const vi = i * 3 + v;
      aOffset[vi * 3] = ox;
      aOffset[vi * 3 + 1] = oy;
      aOffset[vi * 3 + 2] = oz;

      aShard[vi * 4] = delay;
      aShard[vi * 4 + 1] = strength;
      aShard[vi * 4 + 2] = sliver;
      aShard[vi * 4 + 3] = tp[3];

      aCentroid[vi * 3] = cX;
      aCentroid[vi * 3 + 1] = cY;
      aCentroid[vi * 3 + 2] = cZ;

      aDriftDir[vi * 3] = dX;
      aDriftDir[vi * 3 + 1] = dY;
      aDriftDir[vi * 3 + 2] = dZ;

      for (let k = 0; k < 4; k++) {
        aJitterSeed[vi * 4 + k] = jp[k];
        aDriftSeed[vi * 4 + k] = dp[k];
        aTumbleSeed[vi * 4 + k] = tp[k];
      }
    }
  }

  return { aOffset, aShard, aCentroid, aDriftDir, aJitterSeed, aDriftSeed, aTumbleSeed };
}
