# Scroll Animation System

This project includes **two animation systems** you can choose from:

1. **CSS-Only Animations** (Recommended) - Zero JavaScript, SSR-friendly
2. **JavaScript-Observed Animations** - More browser support, uses IntersectionObserver

---

## 🎨 CSS-Only Animations (Zero JavaScript)

### Overview
Uses modern CSS scroll-driven animations with `animation-timeline: view()`. **No client-side JavaScript required** - animations are rendered server-side and work purely with CSS.

### Browser Support
- ✅ Chrome 115+ (Sept 2023)
- ✅ Edge 115+ (Sept 2023)
- ✅ Safari 17.5+ (May 2024)
- ✅ Firefox: Planned (behind flag in 114+)

**Fallback**: Elements appear immediately without animation in older browsers (graceful degradation).

### Usage

#### In Astro Components
```astro
---
import { cssAnimationProps } from "@/integrations/scroll-animations";
---

<!-- Basic fade-in -->
<div {...cssAnimationProps("fade-in")}>
  Content animates in as you scroll
</div>

<!-- With custom range -->
<div {...cssAnimationProps("fade-in-up", { range: "delayed" })}>
  Animates when 20% into viewport
</div>

<!-- With completely custom range -->
<div {...cssAnimationProps("fade-in-scale", {
  customRangeStart: "entry 10%",
  customRangeEnd: "entry 40%"
})}>
  Custom animation trigger points
</div>
```

#### In React/TSX Components
```tsx
import { cssAnimationProps } from "@/integrations/scroll-animations";

export default function MyComponent() {
  return (
    <div {...cssAnimationProps("fade-in-up")}>
      Content
    </div>
  );
}
```

#### Direct HTML (No Import)
```html
<!-- Just add the data attribute -->
<div data-animate-css="fade-in">
  Content
</div>

<!-- With custom range -->
<div data-animate-css="slide-up" data-animate-range="delayed">
  Content
</div>
```

### Available Animations

**Fade Animations:**
- `fade-in` - Simple fade in
- `fade-in-up` - Fade in from bottom
- `fade-in-down` - Fade in from top
- `fade-in-left` - Fade in from left
- `fade-in-right` - Fade in from right
- `fade-in-scale` - Fade in with slight scale

**Scale Animations:**
- `scale-in` - Scale up from small
- `pop-in` - Bouncy scale animation
- `zoom-in` - Smooth zoom effect

**Slide Animations:**
- `slide-up` - Slide up without fade
- `slide-down` - Slide down without fade
- `slide-left` - Slide from left without fade
- `slide-right` - Slide from right without fade

### Animation Ranges

Control when animations trigger:

- **`default`** - Triggers immediately on entry (0% to 30%)
- **`delayed`** - Triggers when 20% into viewport (20% to 50%)
- **`cover`** - Animates across entire viewport journey (0% to 100%)
- **`contain`** - Only animates when fully visible
- **`exit`** - Animates when leaving viewport

### Staggered Animations

```astro
---
import { staggeredCSSAnimationProps } from "@/integrations/scroll-animations";

const items = ["One", "Two", "Three"];
---

{items.map((item, index) => (
  <div {...staggeredCSSAnimationProps("fade-in-up", index, { staggerPercent: 5 })}>
    {item}
  </div>
))}
```

### Performance Impact
- ✅ **Zero JavaScript** - No bundle size increase
- ✅ **No IntersectionObserver overhead**
- ✅ **No event listeners**
- ✅ **No runtime performance cost**
- ✅ **Works with SSR** - Animations render server-side
- ✅ **No LCP impact** - Pure CSS, no blocking JS

---

## 🎯 JavaScript-Observed Animations (Legacy/Fallback)

### Overview
Uses IntersectionObserver to detect when elements enter/exit the viewport and toggles `data-visible` attribute. CSS transitions handle the visual animation.

### Browser Support
- ✅ All modern browsers (Chrome 51+, Safari 12.1+, Firefox 55+)
- ✅ Better compatibility than CSS-only approach

### Usage

#### In Astro Components
```astro
---
import { animationProps } from "@/integrations/scroll-animations";
---

<!-- Basic fade-in -->
<div {...animationProps("fade-in")}>
  Content
</div>

<!-- With options -->
<div {...animationProps("fade-in-up", { once: true, delay: 200 })}>
  Content
</div>
```

#### In React/TSX Components
```tsx
import { animationProps } from "@/integrations/scroll-animations";

export default function MyComponent() {
  return (
    <div {...animationProps("fade-in-up", { once: true })}>
      Content
    </div>
  );
}
```

#### Direct HTML
```html
<div data-animate="fade-in" data-animate-once="true">
  Content
</div>
```

### Available Options

```typescript
{
  once?: boolean;      // Only animate once (default: true)
  delay?: number;      // Delay in milliseconds
  duration?: number;   // Custom duration in milliseconds
}
```

### Staggered Animations

```astro
---
import { staggeredAnimationProps } from "@/integrations/scroll-animations";

const items = ["One", "Two", "Three"];
---

{items.map((item, index) => (
  <div {...staggeredAnimationProps("fade-in-up", index, { staggerDelay: 100 })}>
    {item}
  </div>
))}
```

### Performance Impact
- ⚠️ **Requires JavaScript** - ~3KB gzipped
- ⚠️ **IntersectionObserver overhead** - Minimal but present
- ⚠️ **Blocks on JS load** - Animation script must load first
- ⚠️ **Can impact LCP** if used on hero elements

---

## 📊 When to Use Which System

### Use CSS-Only Animations When:
- ✅ You want **zero JavaScript overhead**
- ✅ You need **optimal performance**
- ✅ You're animating **hero/LCP elements** (won't delay LCP)
- ✅ You can support **modern browsers only**
- ✅ You want **SSR-friendly animations**

### Use JavaScript Animations When:
- ✅ You need **broader browser support** (Safari < 17.5, Firefox)
- ✅ You need **complex animation logic** (start/pause/resume)
- ✅ You need **programmatic control** (trigger animations on events)
- ✅ You want **visibility-based interactions** (video play/pause, etc.)

---

## 🔄 Migration Guide

### Converting from JS to CSS-Only

**Before (JS):**
```astro
import { animationProps } from "@/integrations/scroll-animations";

<div {...animationProps("fade-in-up", { once: true })}>
  Content
</div>
```

**After (CSS-Only):**
```astro
import { cssAnimationProps } from "@/integrations/scroll-animations";

<div {...cssAnimationProps("fade-in-up")}>
  Content
</div>
```

Or just use the data attribute directly:
```html
<div data-animate-css="fade-in-up">
  Content
</div>
```

---

## 🎭 Example Use Cases

### Hero Section (Use CSS-Only)
```astro
---
import { cssAnimationProps } from "@/integrations/scroll-animations";
---

<section>
  <h1 {...cssAnimationProps("fade-in")}>
    Your Hero Title
  </h1>
  <p {...cssAnimationProps("fade-in-up", { range: "delayed" })}>
    Your description
  </p>
</section>
```

**Why CSS-Only?** No JavaScript means no LCP delay. Animation happens purely in CSS.

### Feature Cards (Use CSS-Only with Stagger)
```astro
---
import { staggeredCSSAnimationProps } from "@/integrations/scroll-animations";

const features = [...];
---

{features.map((feature, index) => (
  <div {...staggeredCSSAnimationProps("fade-in-up", index)}>
    {feature.title}
  </div>
))}
```

### Video Accordion (Use JS for Interactivity)
```tsx
import { animationProps } from "@/integrations/scroll-animations";
import { useVisibility } from "@/hooks/animations/useVisibility";

export default function VideoAccordion() {
  const ref = useRef(null);
  const inView = useVisibility(ref, { threshold: 0.3 });

  return (
    <div ref={ref} {...animationProps("fade-in")}>
      {/* Video autoplay logic based on inView */}
    </div>
  );
}
```

**Why JS?** Needs `useVisibility` hook for video autoplay control.

---

## 🚀 Performance Recommendations

### For Optimal LCP:
1. **Never animate LCP elements with JavaScript**
2. Use CSS-only animations on hero sections
3. Keep animation ranges tight (`entry 0%` to `entry 30%`)
4. Avoid animating large images or text blocks

### For Best UX:
1. Use `once: true` to prevent repeated animations on scroll
2. Keep animations subtle (20-30px movement max)
3. Use 600ms or less for animation duration
4. Respect `prefers-reduced-motion`

### For Maximum Compatibility:
1. Use JS animations as fallback for older browsers
2. Provide no-animation fallback styles
3. Test in Safari 17.4 and below

---

## 🐛 Troubleshooting

### CSS-Only animations not working?
1. Check browser support (Chrome 115+, Safari 17.5+)
2. Verify CSS file is imported in `Theme.astro`
3. Check for `@supports (animation-timeline: view())` in DevTools
4. Confirm data attribute: `data-animate-css` (not `data-animate`)

### JS animations not working?
1. Verify scroll-animations script is loaded
2. Check for `data-animate` attribute (not `data-animate-css`)
3. Look for `data-visible="true"` being added in DevTools
4. Check console for JavaScript errors

### Animations triggering too early/late?
- **CSS-Only**: Adjust `customRangeStart` and `customRangeEnd`
- **JS**: Adjust `threshold` and `rootMargin` in `useVisibility`

---

## 📁 File Reference

### Core Files
- **Combined Animations Stylesheet**: `src/integrations/scroll-animations/styles/animations.css`
  - Contains both CSS-only and JS-observed animation styles
  - Imported automatically in `Theme.astro`

### JavaScript/TypeScript
- **Main Export**: `src/integrations/scroll-animations/index.ts` (barrel export for all prop helpers)
- **Props Helpers**: `src/integrations/scroll-animations/props.ts` (consolidated CSS-only + JS props)
- **Observer System**: `src/integrations/scroll-animations/observer.ts` (IntersectionObserver implementation)
- **Visibility Hook**: `src/hooks/animations/useVisibility.ts`

### Integration
- **Theme Import**: `src/layouts/Theme.astro` (loads animations.css and initializes observer)

---

## Lazy Video Loading (JS System Only)

Videos with `data-video-src` will automatically load when scrolled into view:

```html
<video data-video-src="/path/to/video.mp4" data-video-autoplay="true">
  <source data-video-src="/path/to/video.mp4" type="video/mp4" />
</video>
```

---

## 🎓 Learn More

- [CSS Scroll-Driven Animations](https://developer.chrome.com/articles/scroll-driven-animations/)
- [View Timeline Ranges](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-range)
- [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
