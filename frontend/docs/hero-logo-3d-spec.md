# Hero Logo 3D — Effect Specification

**Status:** IMPLEMENTED. `src/components/HeroLogo3D/` was rebuilt from scratch
against this document — both `HeroLogo3D.tsx` and `shatterMaterial.ts` are new,
not patched. This spec is now the reference for what the effect is meant to be;
keep it in sync with any change to those files.

**Goal:** recreate the original "shattering brand mark" effect *exactly as it was
meant to look*, in a system that cannot produce the glitching the old one did.

---

## 1. What the user sees

This section is the source of truth for the look. Everything after it is in
service of this.

### 1.1 At rest (top of page)

A large white Webmaxxers logo mark sits centered behind the hero headline, faint
— roughly 40% opacity, inverted in dark mode — filling the screen behind the
text.

It **rotates slowly and continuously**, like a display piece turning on a stand.
It never speeds up and never slows down while it is whole; the rate is constant
in real time.

The rotation is **idle-only**. It turns while you are still, and **holds its
angle the moment you start scrolling** — up or down — picking the turn back up
shortly after you stop. Scrolling drives the shatter and nothing else; the mark
must never appear to spin as it comes apart.

Moving the mouse up and down tilts the mark slightly toward the cursor, following
with a soft lag. Subtle, but it makes the mark feel like a physical object in
space rather than a flat background image.

### 1.2 The hold

Scrolling begins. For roughly the **first third** of the scroll range, nothing
changes — the mark stays whole and keeps turning at its steady rate.

This delay is deliberate and load-bearing: the viewer needs to register the mark
as a solid object before it does anything, or the effect reads as noise.

### 1.3 The break

The mark begins to come apart.

It does **not** crack into a few large chunks. The model is ~17,700 triangles,
and each one breaks loose on its own slightly staggered schedule. The mark
**disintegrates** — the surface granulates, pieces detaching in a spreading wave
rather than all at once. The staggering is what makes it read as erosion instead
of an explosion.

As each fragment breaks free it **shrinks toward its own centre**, down to a
small fraction of its original size. A loose piece should read as a fleck or mote
— not as a recognisable chunk of letterform. The mark visibly loses substance as
it comes apart.

The rotation is already held still here (you are scrolling), and it also
**winds down permanently**: the more shattered the mark becomes, the slower its
idle turn, reaching zero by the time it is rubble. So even if you stop
mid-shatter it does not resume spinning.

The mouse tilt also fades out over the same stretch — once it is rubble, the
field must not tilt as a slab.

### 1.4 The rubble

Once loose, fragments behave like **torn paper caught in wind**. Three things
happen at once:

- **Thrown** — each piece flies off along its own random direction, fastest at
  the moment it breaks free.
- **Blown** — a shared slow gust pushes the whole field around *together*, so the
  scatter drifts as one mass rather than dispersing evenly. This is what makes it
  read as wind rather than as an explosion.
- **Fluttering and tumbling** — each scrap rotates on its own axes at its own
  rate, catching the light differently as it turns, the way a torn scrap flickers
  as it falls.

The field **spreads out to fill the frame and keeps churning there** — alive and
turbulent — for as long as the viewer is in that stretch of the page. It does not
settle, and it does not fall. It blows around.

### 1.5 Exit

Past the About/testimonials stretch the mark is hidden entirely and the projects
filmstrip covers where it was. Scrolling back up runs the whole thing in reverse:
the rubble gathers, the pieces regrow, the mark reassembles and resumes turning.

---

## 2. Staging

| | |
|---|---|
| Mount | `src/pages/index.astro`, one usage |
| Positioning | `fixed inset-0 -z-10 opacity-40 dark:invert` |
| Scroll range | `#about .about-sticky-section` — top hits viewport top → bottom hits viewport top |
| Range height | `250svh` (the element is `min-height: 250svh`, containing a `position: sticky` child) |
| Hydration | `client:visible`, **xl (1280px) and up only** — below that nothing renders at all, not even the poster |
| Reduced motion | WebGL never loads; the poster image stands in permanently |
| Poster | `src/assets/hero-logo3d-poster.png` — a render of the mark at progress 0, crossfaded out when the live canvas is ready |
| Model | `public/lotties/scroll-affected-lottie-that-breaks/logo.glb` — 6 meshes, ~17,716 triangles, **not** Draco-compressed |
| Camera | `PerspectiveCamera(45°)` at `z = 5`; `z = 13` below 768px so the mark reads smaller |
| Lighting | key directional 1.2 @ (3,5,5); fill directional 0.25 @ (-3,-2,-3); ambient 0.35 |
| Material | `MeshStandardMaterial`, white, `emissive 0xffffff @ 0.12`, `metalness 0.05`, `roughness 0.9`, `DoubleSide` |

### 2.1 The visible frame — critical

At `z = 5` with a 45° vertical fov, the visible area at the origin is:

```
half-height  2.07 units
half-width   3.31 units   (at 16:10)
logo size    2.50 units
```

**Every motion amplitude must be judged against this.** This is the single most
important number in the document, and getting it wrong is what made the old
version look like chaos rather than like the description in §1.

---

## 3. Why the old implementation failed

Not to assign blame — these are the specific traps a rebuild must avoid, because
each one is easy to reintroduce.

### 3.1 The motion was 7–13× too large for the frame

| Term | Old value | In frame-heights |
|---|---|---|
| Scatter throw | ~15 units | **7.2×** the visible half-height |
| Outward drift | 11 units | 5.3× |
| Wind/turbulence flutter | ~8.6 units | **4.2×** |

The spec in §1.4 says the field *spreads out to fill the frame and churns there*.
What actually happened: pieces left the screen almost immediately, and the few
still visible were swept in and out of view by a flutter four times taller than
the frame. It read as debris rocketing away, not as blown paper.

**Rule for the rebuild:** the shard field at full break should occupy roughly
±3.3 × ±2.1 units — the frame — with only the outliers leaving it.

### 3.2 The tumble angle grew without bound

The per-shard rotation was:

```glsl
ang = (uTime * rate + seed) * free
```

`uTime` is elapsed seconds since page load, fed directly into a rotation matrix.
That is not an oscillation — it is an angle that increases forever:

| Time on page | Rotation per shard |
|---|---|
| 1 s | 0.2 turns |
| 60 s | 13.8 turns |
| 15 min | **206 turns** |

Worse, the whole term was multiplied by `free`, so the spin *rate* changed
whenever the break changed. Shards spun faster the longer the page had been open,
and lurched to a different speed as you scrolled.

**Rule for the rebuild:** a time variable may appear **only inside a bounded
function** (`sin`/`cos`). It must never be a bare multiplier on a position or an
angle.

### 3.3 The rotation never actually stopped

The group spin *did* fade — `wholeness = 1 - break` drove its velocity to zero.
But the per-shard tumble was scaled by `free` (the break), so as the group spin
faded out, the shard tumble ramped **up**:

| Break | Group spin | Shard tumble |
|---|---|---|
| 0.00 | 0.240 rad/s | 0° |
| 0.50 | 0.120 rad/s | 74° |
| 1.00 | **0** | **±150°** |

The rotation never stopped. It moved from one object to 17,716 of them. Fading
one spin while ramping another is not a wind-down.

**Rule for the rebuild:** the *total* visible rotation must decrease as the mark
breaks. If shard tumble is introduced during the break, its amplitude must be
small enough that the overall impression is of motion winding down.

### 3.4 A free-running spin cannot be stopped, only frozen

The spin was an accumulator (`spin += rate * dt`), so it was a running total of
elapsed time. Fading its velocity to zero froze it at whatever arbitrary angle it
happened to have reached — a different angle on every visit. The same scroll
position never produced the same frame.

**This is in tension with §1.1**, which requires a continuous free spin while
whole. The rebuild must reconcile the two — see §4.3.

### 3.5 The drive layer smoothed twice

Scroll was fed through a GSAP `scrub` (a 1-second eased follow) and *then*
through a second per-frame ease inside the render loop. One wheel event passed
through two different lag filters, which reads as the mark trailing the cursor
and then catching up.

**Rule for the rebuild:** exactly one smoothing stage between raw scroll and
rendered state.

### 3.6 The scroll range was re-measured mid-scroll

The range element is sized in `svh` — a unit whose pixel height **changes** when
a mobile URL bar or desktop toolbar collapses. GSAP ScrollTrigger re-measured it
continuously, so the range moved under the user and progress jumped
discontinuously.

**Rule for the rebuild:** snapshot the range in absolute document pixels;
re-snapshot only on a real `resize`/`load`, never during a scroll.

---

## 4. Requirements for the rebuild

### 4.1 Visual — must match §1

- [ ] Constant slow rotation while whole AND still
- [ ] Rotation holds its angle while scrolling (up or down), resumes after
- [ ] Mouse tilt with soft lag, fading out as the mark breaks
- [ ] ~First third of the range: whole, no change
- [ ] Disintegration into ~17,700 individually-staggered fragments (a spreading
      wave, not a uniform fade and not a few big chunks)
- [ ] Fragments shrink toward their own centres as they break free
- [ ] Overall rotation winds down as the mark shatters
- [ ] Rubble: per-piece throw + shared gust + per-piece flutter/tumble
- [ ] The field **fills the frame** and churns there
- [ ] Hidden past the range; reverses exactly on scroll-up

### 4.2 Correctness — the invariants

These are what make the effect un-glitchable. They are structural, not tuning.

1. **Bounded time.** Any time variable appears only inside `sin`/`cos`. It may
   animate the *shape* of the flutter, never its amplitude, and never an angle
   or position directly. (§3.2)
2. **Amplitudes scaled to the frame.** All displacement is sized against the
   ±3.3 × ±2.1 unit visible area, not against arbitrary model units. (§3.1)
3. **One smoothing stage.** Raw scroll → one delta-time-correct filter → rendered
   state. (§3.5)
4. **Range snapshotted in pixels.** Never re-measured during a scroll. (§3.6)
5. **Frame-rate independence.** Every accumulator and follow scaled by `dt`;
   `dt` clamped so a backgrounded tab cannot teleport the animation.
6. **Reversibility.** Scrolling up retraces scrolling down. Break amount 0 must
   be provably the untouched mark.
7. **Monotonic wind-down.** Total visible rotation decreases through the break.
   (§3.3)

### 4.3 The spin — idle only, never scroll-driven

The mark free-spins while the user is still and **holds its angle while they
scroll**. Scroll drives the shatter and nothing else.

```
rotation  = idleSpin                        (an angle that only ever accumulates)
idleSpin += spinSpeed · wholeness · scrollHold · dt
```

Two gates on the INCREMENT, never on the accumulated angle:

- `wholeness` (= 1 − break) — the turn slows as the mark comes apart and has
  stopped by the time it is rubble, so the shards never orbit as a clump. This
  is the permanent wind-down.
- `scrollHold` — snaps to 0 on any scroll event and eases back to 1 once the
  user has been still for `scrollHoldFor`. This is the momentary pause.

Gating the increment rather than the total is what makes this a *pause*: the
velocity goes to zero and the angle simply holds. Multiplying the accumulated
angle by either factor would instead rotate the mark backwards toward 0.

A free-running accumulator cannot be cleanly *stopped*, only frozen at an
arbitrary angle (§3.4) — but it can be *paused*, which is what a physical object
does and what this produces.

### 4.4 Performance

- [ ] Displacement on the GPU (per-shard constants as vertex attributes,
      uniforms per frame) — never a per-frame rewrite of the position buffer
- [ ] Render loop sleeps when the mark is offscreen or the tab is hidden
- [ ] Bounding sphere padded (or `frustumCulled = false`) so rubble is not culled
      mid-burst
- [ ] No `DRACOLoader` — the GLB is not Draco-compressed

---

## 5. Reference values from the original

Starting points, **not** targets. Several were wrong (§3.1) and must be re-scaled
to the frame; they are recorded so the rebuild starts from the original intent
rather than from scratch.

| Parameter | Original | Note |
|---|---|---|
| `spinSpeed` | 0.24 rad/s | Constant while whole. Felt right — keep. |
| `tiltTau` | 0.4 s | Mouse-tilt follow time constant. Keep. |
| tilt magnitude | 0.25 rad | Keep. |
| hold before break | 0.35 of range | Keep — see §1.2. |
| `breakEnd` | 0.95 of range | Keep. |
| `breakDelaySpread` | 0.4 | Per-shard stagger. Keep — drives the erosion wave. |
| `shardShrink` | 0.82 (→18% size) | Keep if the throw is frame-scaled; the flecks read as dust only when they also travel. |
| `scatter` | `[16, 16, 8]` | **Far too large** — 7.2× the frame. Re-scale to ≈ `[6, 4, 3]`. |
| `drift` | 11 | **Far too large** — flutter was 4.2× frame height. Re-scale to ≈ 1.5–2. |
| `jitter` | 0.4 | Small in-place wobble. Roughly right; ≈0.25 with a tighter field. |
| `tumble` | 2.4 | Rate is fine; the **formula** was broken (§3.2). Amplitude must be bounded. |

---

## 6. How to verify

A build passing a typecheck proves nothing here — the old version built cleanly
throughout. Nor is a headless browser sufficient: it runs software GL at
uncapped frame rates and will not reproduce what a real display shows. Two of the
failures above were missed exactly this way.

**Structural checks** (cheap, catch the whole class of past bugs):

- `grep` the shader: every time variable appears only inside `sin`/`cos`
- Every `+=` in the render loop is a follow toward a fixed target, or is `* dt`
- Max displacement is bounded — simulate the displacement maths over a long
  elapsed time at fixed break and confirm it does not grow
- At break 0, displacement is exactly 0

**Behavioural checks:**

- Same scroll position, revisited after scrolling away, renders the same frame
- Scroll down then up: matched positions match
- Idle at the top: the loop still renders (the mark is spinning), but past the
  range it drops to **zero** draw calls

**The real check** is a human scrolling the hero on a real display. Motion quality
is not measurable from here.
