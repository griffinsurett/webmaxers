# Scroll Animation Migration Plan
## From: Hand-rolled rAF controllers → To: GSAP ScrollTrigger

---

## Why we're doing this

The current system works for what it was built for. The problem is **extension**. Every animated section currently speaks a private language:

- `CurtainReveal.astro` owns a singleton `window.__curtainReveal` controller
- Components join it by stamping `el.__curtainOverlay` or `el.__curtainUnderlay` contracts onto their DOM nodes
- `AboutSection` has its own separate singleton `window.__aboutStickyController`
- `ServicesScene` has its own standalone rAF loop for when it's outside a curtain
- Phase boundaries are hardcoded constants spread across multiple files (`REVEAL_END = 0.3`, `CARDS_START = 0.30`, etc.)

Adding a new animated section — or adding a new animation to an existing section — means learning that section's internal contract protocol, manually splicing a new phase into existing math, and hoping the resize/scroll coordination still works.

**The vision going forward is multiple full-bleed 3D sections stacked on top of each other.** The curtain model (one overlay, one underlay, one pin) cannot support that. Patching it will keep costing time.

GSAP ScrollTrigger is the right tool because it _is_ the coordination layer. Every animation registers itself. No contracts, no singletons, no shared state between components.

---

## What gets deleted

| File | What happens |
|------|-------------|
| `src/components/CurtainReveal.astro` | **Deleted entirely** |
| `FilmstripVariant.astro` `<script>` block | Rewritten — `__curtainOverlay` contract removed |
| `ServicesScene.astro` `<script>` block | Rewritten — `__curtainUnderlay` contract + standalone rAF removed |
| `AboutSection.astro` `<script>` block | Rewritten — `__aboutStickyController` singleton removed |
| `PortfolioSection.astro` | Simplified — no longer needs to be a `CurtainReveal` slot |

---

## What gets added

| What | Where |
|------|-------|
| `gsap` npm package | `package.json` |
| `src/scripts/scroll-animations.ts` | New file — single GSAP initialization script, imported once in `BaseLayout.astro` |

That's it. One package. One new file.

---

## New page structure (`index.astro`)

**Before:**
```astro
<FrontPageHero />
<AboutSection />
<Marquee />
<CurtainReveal>
  <PortfolioSection slot="overlay" />
  <ServicesScene slot="underlay" />
</CurtainReveal>
<TestimonialCarousel />
```

**After:**
```astro
<FrontPageHero />
<AboutSection />
<Marquee />
<PortfolioSection />
<ServicesScene />
<TestimonialCarousel />
```

No wrapper. No slots. Plain sections in normal document flow.

---

## How the new scroll system works

`scroll-animations.ts` runs once on page load. It finds sections by `data-*` attributes and sets up GSAP ScrollTrigger timelines for each. Each section is independent — they don't know about each other.

### The pinned sequence (Portfolio → Services)

GSAP pins the **portfolio filmstrip** and scrubs it horizontally. When the filmstrip finishes, it unpins and the services section enters normally. The services section then pins itself and runs its own phase sequence.

This is the key difference from the old system: **each section owns its own pin**. There is no shared curtain container. GSAP handles the handoff naturally because `ScrollTrigger.create()` pins are stacked in document order.

```
scroll down →

[Portfolio filmstrip pins]
  track slides left → cards rise in → track finishes
[Portfolio unpins, normal scroll resumes]

[Services section pins]
  dim fades → intro exits → cards slide in → cards scroll through
[Services unpins, normal scroll resumes]

[Testimonials enters normally]
```

Adding a third section next month:

```astro
<PortfolioSection />
<ServicesScene />
<NewSection />         ← just add it here
```

And in `scroll-animations.ts`:

```ts
// NewSection animation
gsap.from("[data-new-section] .my-element", {
  opacity: 0, y: 40,
  scrollTrigger: { trigger: "[data-new-section]", start: "top 75%" }
});
```

That's the entire change needed to add a new animated section.

---

## Visual parity guarantee (desktop)

The goal is **zero visible difference** on desktop. Every animation is preserved exactly:

### Portfolio Filmstrip
| Behavior | Old system | New system |
|----------|-----------|------------|
| Section pins to top | `position:sticky` on `.curtain-pin` inside `CurtainReveal` | `ScrollTrigger: { pin: true }` on `.fs-section` |
| Track slides left | `track.style.transform = translateX(-currentX)` driven by `__curtainOverlay.onProgress` | GSAP `x: -maxTravel` on the track, `scrub: true` |
| Cards rise in from bottom as they enter | `translateY((1-v) * panelH)` + `opacity: v` per card | GSAP `y: panelH, opacity: 0` → `y: 0, opacity: 1` on each card as it enters |
| Overlay slides off left revealing services | `translateX(-slide * 100%)` on `.curtain-overlay-layer` | `.fs-section` itself scrolls away (no overlay layer needed — it's a normal section now) |
| Mobile: vertical stack, no pin | CSS `@media (max-width: 767px)` flattens track | Same CSS, unchanged. GSAP ScrollTrigger respects `matchMedia` and skips the pin |
| Reduced motion | CSS + JS flat fallback | `ScrollTrigger.matchMedia("(prefers-reduced-motion: reduce)")` skips all animations |

### Services Scene
| Behavior | Old system | New system |
|----------|-----------|------------|
| Section pins | Driven by `CurtainReveal` pin (underlay mode) or self-pin (standalone) | `ScrollTrigger: { pin: true }` on `.services-scene` |
| Fire background un-dims | `--dim` CSS custom prop: `1 → 0` via `applyPhases()` | GSAP `opacity: 0.5 → 0` on `.services-dim` |
| Intro stack exits upward | `--intro-shift: 0 → 44vh`, `--intro-opacity: 1 → 0` | GSAP `y: 0 → -44vh, opacity: 1 → 0` on `.services-intro-copy` |
| Cards slide in from sides with stagger | `--card-progress: 0 → 1` per card with `i * 0.08` stagger | GSAP `x: ±60vw, opacity: 0` → `x: 0, opacity: 1` with `stagger: 0.08` |
| Cards scroll vertically through pin | `--cards-scroll: 0 → -scrollHeight` | GSAP `y: 0 → -scrollHeight` on `.services-cards-scroll` |
| Phase boundaries | `REVEAL_END=0.3`, `INTRO_END=0.22`, `CARDS_START=0.30`, `CARDS_IN_END=0.55` | GSAP timeline positions: `tl.add("reveal")`, `tl.add("cards", "reveal+=0.3")` etc. Same timing, readable labels |
| Mobile / reduced motion flat | CSS fallback + `applyFlat()` | Same CSS, unchanged |

### About Section (word reveal)
| Behavior | Old system | New system |
|----------|-----------|------------|
| Section sticks | `position:sticky` in CSS, scroll math in JS | `position:sticky` in CSS unchanged — about section keeps its CSS sticky, GSAP just drives the word progress |
| Words reveal left → right | `--word-progress` per word driven by `__aboutStickyController.update()` | GSAP stagger on `.about-word-layer--overlay` opacity, linked to scroll progress |
| Rolling logo | CSS `animation-timeline: view()` — already pure CSS | Unchanged, not touched |

---

## The `data-*` attribute convention

Each section keeps its existing `data-*` attributes (they're already there). The new scroll script targets them:

```
[data-filmstrip]         → portfolio horizontal scroll
[data-filmstrip-track]   → the translating track
[data-filmstrip-card]    → individual card panels
[data-services-scene]    → services pin root
[data-services-dim]      → the dim overlay
[data-services-intro]    → intro text block
[data-services-cards]    → cards wrapper
[data-svc-card]          → individual service cards
[data-about-sticky]      → about section pin root
[data-about-word-progress] → individual animated words
```

No new attributes added. No existing attributes removed.

---

## What does NOT change

- All `.astro` component structure (HTML)
- All CSS — every class, every media query, every custom property definition
- All content collections
- `TestimonialCarousel` — already React-based, no scroll animation involved
- `FrontPageHero`, `Marquee`, `BaseLayout` — untouched
- Mobile and reduced-motion CSS fallbacks — unchanged, GSAP respects them
- The `PortfolioSection.astro` and `ServicesScene.astro` prop APIs — same props, same usage

---

## Migration steps (in order)

1. **Install GSAP** — `npm install gsap`
2. **Create `src/scripts/scroll-animations.ts`** — empty shell with GSAP import
3. **Import it in `BaseLayout.astro`** — `<script src="@/scripts/scroll-animations.ts"></script>`
4. **Rewrite `AboutSection.astro` script** — replace `__aboutStickyController` with GSAP word stagger. Test: words still reveal on scroll.
5. **Rewrite `FilmstripVariant.astro` script** — remove `__curtainOverlay` contract, add GSAP horizontal scrub. Test: filmstrip still scrolls horizontally with card rise effect.
6. **Rewrite `ServicesScene.astro` script** — remove `__curtainUnderlay` contract + standalone rAF, add GSAP phase timeline. Test: all three phases still animate correctly.
7. **Update `index.astro`** — remove `<CurtainReveal>` wrapper, flatten to `<PortfolioSection />` + `<ServicesScene />` side by side.
8. **Delete `CurtainReveal.astro`**
9. **Smoke test** — desktop visual parity, mobile flatten, reduced motion, page navigation (astro:page-load)

---

## Adding animations after the migration

Any new section, any new element:

```ts
// In scroll-animations.ts — just add lines

// Entrance fade on any new section
gsap.from("[data-new-section]", {
  opacity: 0, y: 60,
  scrollTrigger: { trigger: "[data-new-section]", start: "top 80%" }
});

// Another full-bleed pinned 3D section
ScrollTrigger.create({
  trigger: "[data-another-scene]",
  pin: true,
  scrub: true,
  start: "top top",
  end: "+=300%",
  onUpdate: (self) => { /* drive whatever */ }
});
```

No contracts. No singletons. No coordination with other sections. Just add lines.
![alt text](<Screenshot 2026-06-12 at 3.32.38 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.32.51 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.33.02 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.33.10 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.33.38 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.33.49 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.02 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.11 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.24 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.32 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.43 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.34.52 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.35.01 AM.png>)
![alt text](<Screenshot 2026-06-12 at 3.35.11 AM.png>)