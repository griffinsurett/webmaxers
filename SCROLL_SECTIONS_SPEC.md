# Scroll Sections — Build Spec

This document describes two scroll-animated sections on the Webmaxers homepage. It covers what they look like, how they behave, and how they relate to each other. Build this however you see fit — the only constraint is the visual result and behavior described below.

---

## Environment

- Astro 6.4 (SSG), React 19, Tailwind v4
- GSAP 3 + ScrollTrigger already installed as `gsap`
- Path alias `@/` maps to `src/`

---

## Section 1 — Filmstrip (Horizontal Portfolio Scroll)

### Visual description

On desktop, this is a full-viewport-height section with a dark gradient background. It acts as a curtain — it sits on top of whatever is behind it and completely covers it.

Inside the section is a horizontal row of panels. Each panel is half the viewport width. The row is much wider than the screen. Only what fits in the viewport is visible at any given time; the rest is hidden off to the right.

**Intro panel** (first, leftmost): Centered content. A small all-caps eyebrow label "WORK", a large light-weight heading split across two lines ("Selected work" / "& explorations", second line very slightly indented), and a small underline-style link "View all projects" below.

**Project panels** (one per project): Each panel holds a project card. The card has a media frame at the top (fixed aspect ratio, roughly 20:13) showing either a video preview or a scrollable full-site screenshot image. Below the media is the project title, a tag line of industry and technologies in small uppercase muted text, and a small "Visit ↗" link aligned to the right. An optional short description appears below. The card starts completely hidden — it sits below the visible floor of the panel on load.

**Outro panel** (last, rightmost, conditional): Centered content. A large light-weight paragraph of descriptive text and another "View all projects" link. Only shown when there are enough items to warrant it.

A hairline vertical rule runs down the right edge of every panel.

### Scroll behavior (desktop only)

The section is pinned to the top of the viewport. As the user scrolls down the page, two phases happen in sequence:

**Phase 1 — track scrub:** The horizontal row of panels translates left. Panels glide across the screen from right to left, one after another, as if on a conveyor belt. The scroll distance consumed equals the full overflow width of the track. The section stays pinned and stationary; only the inner row of panels moves.

**Phase 2 — curtain slide:** Once all panels have scrolled through, the entire section slides off the screen to the left as a single unit. This slide takes roughly one full viewport-height worth of scroll. As it slides away, whatever is behind it is revealed.

### Card animation (during phase 1)

Each project card animates independently as its panel crosses the viewport:

- **Entry:** As a panel sweeps in from the right and approaches center screen, its card rises up from below the panel floor into view. It goes from fully hidden below (translated down by the full panel height, opacity zero) to fully visible (in place, opacity one). The rise uses a fast ease-out curve. This is scrub-driven — tied directly to scroll position, not a timed transition.

- **Exit:** As the panel scrolls off to the left and its trailing edge clears the screen, the card exits upward — it continues in the same upward direction it entered and disappears above the panel floor, returning to hidden (translated up by the full panel height, opacity zero). The exit uses an ease-in curve.

The panel itself clips the card so nothing is visible outside the panel boundaries during the rise or fall.

### Mobile and reduced-motion

Below 768px and for users who prefer reduced motion: the horizontal layout becomes a vertical stack. All cards are fully visible with no animation. No pinning, no horizontal scroll, normal page flow.

### Data

Projects come from the `projects` content collection located at `src/content/projects/`. Only entries tagged `"featured"` appear in the filmstrip, sorted by their `order` field. Each project has: title, description, industry, technologies array, optional video URL, optional full-site screenshot image, optional banner image, optional featured image, optional external link. Images should be processed at build time into optimized WebP — a cropped placeholder for fast initial load, and a full-height version for the hover-scroll interaction.

---

## Section 2 — Services Reveal

### Visual description

This section lives directly behind the filmstrip. While the filmstrip is on screen it is completely invisible — hidden behind the filmstrip's solid background. The moment the filmstrip slides off left, this section is fully revealed.

What the user sees the instant it is revealed: a full-viewport image of a person standing in front of fire, dimmed by a dark overlay so the image is only subtly visible. Centered on screen is massive all-caps stacked text in three lines — "WEBSITES", "BRANDING", "AI AGENTS" — each line enormous, light-weight, letter-spacing tightened. A small eyebrow label "OUR SERVICES" sits above the stack.

### Scroll behavior (desktop only)

The section is pinned. It animates through three sequential phases as the user continues scrolling after the filmstrip has left:

**Phase 1 (first ~30% of budget):** The dark overlay over the fire image fades away, making the fire fully visible. Simultaneously the stacked intro text fades out and translates upward off screen.

**Phase 2 (~30%–55%):** Six service cards slide in from alternating sides. Even-indexed cards come from the left, odd-indexed from the right. They arrive with a slight stagger. Each card goes from off-screen to its resting position, fading from invisible to fully visible. Once cards are mostly in place the cards become interactive.

**Phase 3 (55%–100%):** The card list scrolls upward so the user can read all six cards. The grid is taller than the viewport so the inner content travels up to reveal cards that were below the fold.

### Card appearance

Each service card is a semi-transparent frosted-glass tile — subtle background tint, soft border, backdrop blur. It contains an icon, a large light-weight title, and a short description paragraph. Cards are arranged in a 2-column grid.

### Mobile and reduced-motion

Below 768px and for users who prefer reduced motion: everything is static. The dim overlay is hidden, all text is visible, all cards are visible and interactive, normal vertical flow layout.

### Data

Services come from the `services` content collection at `src/content/services/`, sorted by `order`. There are 6 services. Each has: title, description, icon (Font Awesome icon string), and order. The background image already exists at `src/assets/fire-pic.jpg`.

---

## How the Two Sections Relate

These two sections are visually stacked — the filmstrip sits in front, the services section sits behind it. While the filmstrip is present it acts as a solid curtain that completely hides services. Services only becomes visible as the filmstrip slides away.

From the user's perspective the entire sequence feels like one continuous scroll interaction: the filmstrip panels glide across, then the whole filmstrip peels off left, then services animates in — all without any gap or jump.

The scroll budget for both sections needs to be calculated dynamically because the filmstrip's width depends on how many projects there are and the viewport size. Any approach to synchronizing the two sections should account for this.

Both sections must work correctly after client-side navigation — any scroll state or animation setup should be re-initialized when the page reloads in-app.
