# AboutSection Scroll Animation - Deep Dive

## Overview

The AboutSection implements a sophisticated scroll-based text reveal animation where words progressively "light up" as the user scrolls. It's a multi-layered system combining CSS, DOM manipulation, and intelligent scroll tracking.

---

## 1. HTML Structure & Dual-Layer System

### Parent Container

```html
<aside
  class="about-reveal"
  data-about-sticky="true"
  style="--about-section-height: 250svh;"
>
  <div class="about-pin" data-about-sticky-inner>
    <!-- Content here -->
  </div>
</aside>
```

**Key attributes:**

- `data-about-sticky="true"` — Marker for JS to find this section
- `--about-section-height: 250svh` — CSS variable that makes the scrollable area 2.5x viewport height
- `data-about-sticky-inner` — Marks the sticky container that will be locked to viewport

### Word Rendering - Triple-Layer Structure

```html
<span class="about-word" data-about-word-progress>
  <span class="about-layer about-layer--base">webmaxxers</span>
  <span class="about-layer about-layer--overlay">webmaxxers</span>
</span>
```

**Each word is wrapped with TWO copies of itself:**

1. **Base layer** (`about-layer--base`) — Faded version (opacity 0.15), always visible
2. **Overlay layer** (`about-layer--overlay`) — White (opacity 1), appears on top as opacity increases

**How it reveals:**

- Overlay starts at `opacity: 0` (invisible)
- CSS variable `--word-progress` controls the overlay opacity
- As scroll progresses, `--word-progress` goes from 0 → 1
- Overlay fades in, revealing the bright white text over the faded base

---

## 2. CSS - The Visual Engine

### Container Sizing

```css
.about-reveal {
  position: relative;
  min-height: var(--about-section-height); /* 250svh = 2.5x screen height */
}
```

Creates a tall scrollable area (250% of viewport). Without this, there'd be nothing to scroll through.

### Sticky Positioning

```css
.about-pin {
  position: sticky;
  top: 0;
  height: 100svh;
  display: flex;
  align-items: center;
  width: 100%;
}
```

- `position: sticky; top: 0` — Locks content to viewport while parent scrolls
- `height: 100svh` — Takes full viewport height
- `flex; align-items: center` — Vertically centers the text

### Layer Blending

```css
.about-layer--base {
  color: rgba(255, 255, 255, 0.15); /* Very faint white */
}

.about-layer--overlay {
  position: absolute;
  inset: 0; /* Covers the base layer completely */
  color: rgb(255, 255, 255); /* Bright white */
  opacity: var(--word-progress); /* 0 → 1 as user scrolls */
  will-change: opacity; /* GPU optimization */
}
```

**The magic:**

- Both layers are rendered in the same space (overlay is absolutely positioned)
- Base layer is always visible but faded
- Overlay sits on top with opacity tied to `--word-progress`
- `will-change: opacity` tells browser to optimize for opacity changes (GPU acceleration)

---

## 3. Text Processing - Word Splitting

```typescript
export function splitTextIntoAnimatedWords(text: string): AnimatedWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalLetters = words.reduce(
    (sum, word) => sum + Array.from(word).length,
    0,
  );
  let currentIndex = 0;

  return words.map((word, wordIndex) => {
    const letters = Array.from(word).map((char) => {
      const letter: AnimatedLetter = {
        char,
        index: currentIndex,
        reverseIndex: totalLetters - currentIndex - 1,
      };
      currentIndex += 1;
      return letter;
    });
    return { word, letters, isLast: wordIndex === words.length - 1 };
  });
}
```

**What it does:**

- Splits statement into words using regex `/\s+/`
- Tracks metadata for each letter: position, reverse position (for potential right-to-left animations)
- Marks the last word (`isLast`) to control spacing
- Returns structured data for rendering

**Data structure example:**

```javascript
[
  { word: "webmaxxers", letters: [...], isLast: false },
  { word: "is", letters: [...], isLast: false },
  // ... more words
  { word: "technology.", letters: [...], isLast: true }
]
```

---

## 4. JavaScript Controller - The Scroll Engine

### Initialization Pattern (IIFE)

```javascript
(() => {
  const key = "__aboutController";
  if (window[key]) {
    window[key].register();
    return;
  }
  // ... controller setup
})();
```

**Design pattern:** Self-executing function with singleton check

- If controller already exists (e.g., after navigation), register new elements and exit
- Prevents duplicate listeners and multiple controllers

### Controller State Machine

```javascript
const ctrl = {
  ticking: false,      // RAF throttling flag
  started: false,      // Has scroll listener been attached?
  register() { this.update(); },
  start() { ... },
  schedule() { ... },
  update() { ... }
}
```

### Three-Tier Animation Loop

#### 1. **Event Throttling with RAF** (`schedule()`)

```javascript
schedule() {
  if (this.ticking) return;        // Ignore if already scheduled
  this.ticking = true;
  requestAnimationFrame(() => {
    this.ticking = false;           // Reset flag
    this.update();                  // Run animation frame
  });
}
```

**Why?** Scroll events fire 60+ times per second. RAF throttles updates to screen refresh rate (60fps), preventing jank.

#### 2. **Event Listeners** (`start()`)

```javascript
start() {
  if (this.started) { this.schedule(); return; }
  this.started = true;
  window.addEventListener("scroll", () => ctrl.schedule(), { passive: true });
  window.addEventListener("resize", () => ctrl.schedule());
  this.schedule();
}
```

- **Scroll listener:** Triggers animation frame when user scrolls (passive for performance)
- **Resize listener:** Re-calculates on window resize
- Initial `this.schedule()` to set baseline state

#### 3. **Progress Calculation** (`update()`)

```javascript
const sectionRect = section.getBoundingClientRect();
const scrollSpan = Math.max(section.offsetHeight - inner.offsetHeight, 1);
const progress = Math.max(0, Math.min(-sectionRect.top / scrollSpan, 1));
```

**The math:**

1. `sectionRect.top` — How far from viewport top is the section top?
2. `-sectionRect.top` — Negative value converts to scroll distance into the section
3. `scrollSpan` — Total scrollable distance through the section
   - `section.offsetHeight` (250svh) minus `inner.offsetHeight` (100svh) = 150svh
   - This is the distance you need to scroll to fully animate
4. `progress = -sectionRect.top / scrollSpan` — Normalized 0 to 1 value
5. `Math.max(0, Math.min(..., 1))` — Clamps to [0, 1] range

**Visual explanation:**

```
Before section enters:    progress = 0 (negative, clamped to 0)
Section visible:          progress = 0 → 1 (as you scroll through)
Section fully scrolled:   progress = 1 (beyond scrollSpan, clamped to 1)
```

### Word-by-Word Reveal Timing

```javascript
const wordNodes = section.querySelectorAll("[data-about-word-progress]");
const totalWords = wordNodes.length || 1;

wordNodes.forEach((node, i) => {
  const wp = Math.max(0, Math.min(progress * totalWords - i, 1));
  node.style.setProperty("--word-progress", wp.toFixed(4));
});
```

**The clever bit:**

- Multiply `progress` by `totalWords` to compress the animation across all words
- Subtract word index `i` to stagger the start of each word's animation
- Result: As overall progress increases, each word lights up sequentially

**Example with 3 words and progress = 0.5:**

```
progress = 0.5, totalWords = 3
Word 0: wp = max(0, min(1.5 - 0, 1)) = 1.0   ✓ fully revealed
Word 1: wp = max(0, min(1.5 - 1, 1)) = 0.5   ↗ halfway revealed
Word 2: wp = max(0, min(1.5 - 2, 1)) = 0     ✗ not started
```

---

## 5. Performance Optimization

### Intersection Observer (Lazy Activation)

```javascript
if (!("IntersectionObserver" in window)) {
  ctrl.start();
  return;
}

const obs = new IntersectionObserver(
  (entries, observer) => {
    if (entries.some((e) => e.isIntersecting)) {
      ctrl.start();
      observer.disconnect();
    }
  },
  { rootMargin: "300px 0px", threshold: 0 },
);

sections.forEach((s) => obs.observe(s));
```

**Strategy:**

- Don't start scroll listeners until section is near viewport
- 300px top/bottom margin ("300px 0px") — detects section 300px before it appears
- Once visible, disconnect observer and start listening to scroll
- **Benefit:** No scroll listeners until needed; memory efficient for pages with multiple sections

### Accessibility

```javascript
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) return; // Skip animation entirely

// CSS fallback
@media (prefers-reduced-motion: reduce) {
  .about-reveal { min-height: auto; }
  .about-pin { position: static; }
  .about-layer--overlay { opacity: 1 !important; }
}
```

- Respects user's motion preferences
- CSS provides fallback for safe defaults
- JS skips updates if motion is reduced

---

## 6. Animation Timeline

### User Scroll Journey

1. **Before section:** Progress = 0, all words at base opacity (faded)
2. **Enter section:** Progress starts increasing
3. **First word:** Overlay opacity starts fading in
4. **Mid-scroll:** Multiple words blend from faded to bright
5. **End of section:** Last word fully revealed (opacity = 1)
6. **After section:** Progress = 1, all words at bright opacity

### Pixel-Perfect Timing

- Total scroll distance: 250svh (section) - 100svh (sticky) = 150svh
- Word reveal spread: Distributed evenly across this 150svh range
- Each word gets fraction of total scroll distance proportional to word count

---

## 7. Key Design Insights

### Why Two Layers?

Instead of animating color or transform, this uses opacity on overlaid text:

- **Pro:** GPU-accelerated opacity changes are smooth and performant
- **Pro:** Looks like text is glowing/revealing, not changing color
- **Pro:** No need for gradient masks or complex transforms

### Why Sticky + Container Height?

- `min-height: 250svh` creates scroll distance
- `position: sticky` locks visual content to viewport
- Scroll distance and visual content are decoupled
- This is more performant than scroll-driven animations (no layout thrashing)

### Why RAF Throttling?

Scroll events can fire 100+ times/sec, but browsers refresh at 60fps max:

- RAF ensures we only update when browser can actually render
- Prevents CPU waste and keeps animation smooth
- Single RAF per scroll event (thanks to `ticking` flag)

### Why Sequential Word Reveal?

`progress * totalWords - i` creates staggered timing:

- Gives visual narrative: words "light up" in reading order
- Creates sense of movement and energy
- Feels intentional, not random

---

## 8. Code Reusability Pattern

**IIFE with singleton pattern allows:**

- Multiple AboutSection components on same page
- Controller re-registers without duplicating listeners
- Safe navigation between pages (old controller reused or destroyed)
- No conflicts between instances

---

## Summary

This animation is a masterclass in:
✅ **Performance:** RAF throttling, lazy intersection observer, GPU-accelerated opacity
✅ **Accessibility:** prefers-reduced-motion support
✅ **UX:** Sequential word reveal for narrative flow
✅ **Architecture:** Separation of concerns (HTML structure, CSS rendering, JS calculation)
✅ **Elegance:** Simple math (scroll ratio × word count - index) drives complex visual effect
