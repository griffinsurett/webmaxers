# Dark / Light Theme System

Complete reference for how the dark/light toggle and accent color system works in this project — from the first byte of HTML to a user clicking the toggle.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The FOUC Problem — and How It's Solved](#2-the-fouc-problem--and-how-its-solved)
3. [CSS Token Layer](#3-css-token-layer)
4. [Tailwind Variants: `light:` and `dark:`](#4-tailwind-variants-light-and-dark)
5. [State Management: `UseMode` Hook](#5-state-management-usemode-hook)
6. [Accent Color System](#6-accent-color-system)
7. [localStorage Schema](#7-localstorage-schema)
8. [UI Components](#8-ui-components)
9. [Cross-Tab Sync](#9-cross-tab-sync)
10. [Full Data-Flow Walkthrough](#10-full-data-flow-walkthrough)
11. [File Map](#11-file-map)
12. [Key Gotchas](#12-key-gotchas)

---

## 1. Architecture Overview

The system is split into four distinct layers that run in a strict sequence:

```
[1] Inline blocking script (Theme.astro)
       ↓  sets data-theme before first paint
[2] CSS token layer (global.css)
       ↓  [data-theme="X"] selectors resolve all color vars
[3] React state layer (UseMode.ts, useAccentColor.ts)
       ↓  manages state, persists to localStorage, patches DOM on change
[4] UI layer (ThemeControls/)
       ↓  toggle + accent picker components
```

No layer can replace the one above it. React cannot prevent FOUC because it loads after the first paint. The inline script is the only thing that can.

---

## 2. The FOUC Problem — and How It's Solved

**File:** `src/layouts/Theme.astro`

A Flash of Unstyled Content (FOUC) happens when the browser paints before it knows which theme to use. The fix is an `is:inline` script — Astro's `is:inline` means the script tag is emitted verbatim into the HTML with no bundling, no defer, no module wrapping. It runs synchronously, blocking all rendering until it finishes.

```js
// src/layouts/Theme.astro (lines 27–50)
<script is:inline>
  (function() {
    var d = document.documentElement;
    var storedTheme = null;
    try {
      storedTheme = localStorage.getItem('theme');
    } catch (_) {}
    var prefersLight =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    var t =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : (prefersLight ? 'light' : 'dark');
    d.setAttribute('data-theme', t);
    d.style.colorScheme = t;
    var a = null;
    try {
      a = localStorage.getItem('accent');
    } catch (_) {}
    if (a) d.style.setProperty('--color-accent', a);
  })();
</script>
```

**Decision tree:**

```
localStorage['theme'] === 'light' or 'dark'?
  YES → use stored value
  NO  → check window.matchMedia('(prefers-color-scheme: light)')
          matches → 'light'
          no match → 'dark'   ← default (site is dark-first)
```

**What it sets on `<html>`:**

| Property | Value | Purpose |
|---|---|---|
| `data-theme` attribute | `"light"` or `"dark"` | Gates all `[data-theme="X"]` CSS rules |
| `style.colorScheme` | `"light"` or `"dark"` | Tells browser to use native dark/light form controls, scrollbars |
| `style.setProperty('--color-accent', …)` | Stored accent (if any) | Restores accent color before first paint |

**Why the script is so short:**  
Every extra byte in a blocking script is render latency. No comments, no classes, no abstraction — just the bare minimum to stamp `data-theme` before CSS evaluates.

**Deferred theme-color meta update** (non-blocking, same file):

```js
<script>
  (function() {
    function updateThemeColor() {
      var computed = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-bg3').trim();
      if (computed) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', computed);
      }
    }
    if ('requestIdleCallback' in window) {
      requestIdleCallback(updateThemeColor);
    } else {
      setTimeout(updateThemeColor, 0);
    }
  })();
</script>
```

This updates the browser chrome bar color (Android, iOS Safari) to match `--color-bg3`. It runs after paint so it doesn't block anything.

---

## 3. CSS Token Layer

**File:** `src/styles/global.css`

### Default tokens (`@theme` block)

The `@theme` block defines all color tokens as CSS custom properties. These are the dark-mode defaults (the site defaults to dark).

```css
@theme {
  /* ── Palette extremes ── */
  --color-primary-dark: #080808;       /* near-black bg */
  --color-secondary-dark: #030303;     /* deeper near-black */
  --color-tertiary-dark: var(--color-zinc-900);
  --color-primary-light: var(--color-zinc-50);
  --color-secondary-light: var(--color-zinc-100);
  --color-tertiary-light: var(--color-zinc-200);

  /* ── Accent (the brand color) ── */
  --main-accent: #5e76f6;              /* frozen reference — never changes */
  --color-accent: #5e76f6;            /* live value — overridden by accent picker */

  /* ── Primary = accent in dark mode ── */
  --color-primary: var(--color-accent);

  /* ── Semantic tokens (resolved at component level) ── */
  --color-heading: var(--color-tertiary-dark);
  --color-text: var(--color-zinc-200);
  --color-muted: color-mix(in srgb, var(--color-text) 55%, transparent);
  --color-bg: var(--color-primary-dark);
  --color-bg2: var(--color-secondary-dark);
  --color-bg3: var(--color-tertiary-dark);
}
```

### OKLCH-derived shade scales

Both `--color-primary` and `--color-accent` automatically generate a full 50–950 scale using CSS `oklch()` relative color syntax. No pre-computed palette needed — it recalculates live when the base token changes.

```css
--color-primary-50:  oklch(from var(--color-primary) calc(l + 0.40) c h);
--color-primary-100: oklch(from var(--color-primary) calc(l + 0.35) c h);
/* ... */
--color-primary-500: var(--color-primary);           /* midpoint = the token itself */
/* ... */
--color-primary-950: oklch(from var(--color-primary) calc(l - 0.45) c h);

/* Same pattern for --color-accent-50 through --color-accent-950 */
```

This is why changing the accent color at runtime (via the picker) instantly updates every shade across the whole site — the browser recomputes the scale from the single base token.

### Per-theme overrides (`[data-theme]` selectors)

These live in `@layer base` and override the `@theme` defaults when `data-theme` is present on `<html>`.

```css
[data-theme="light"] {
  --color-primary: var(--color-zinc-900);      /* ← neutral, not accent */
  --color-heading: var(--color-tertiary-dark);
  --color-text: var(--color-zinc-600);
  --color-muted: var(--text-gray-500);
  --color-bg: var(--color-primary-light);
  --color-bg2: var(--color-secondary-light);
  --color-bg3: var(--color-tertiary-light);
  --color-border: color-mix(in srgb, var(--color-heading) 10%, transparent);
  --color-border-strong: color-mix(in srgb, var(--color-heading) 16%, transparent);
  /* ... */
}

[data-theme="dark"] {
  --color-primary: var(--color-accent);        /* ← accent IS primary in dark */
  --color-heading: var(--color-primary-light);
  --color-text: var(--color-zinc-200);
  --color-muted: color-mix(in srgb, var(--color-text) 55%, transparent);
  --color-bg: var(--color-primary-dark);
  --color-bg2: var(--color-secondary-dark);
  --color-bg3: var(--color-tertiary-dark);
}
```

**Critical design decision:** `--color-primary` means different things in each mode:
- **Dark mode:** `--color-primary` = `--color-accent` (the brand indigo). Primary actions use brand color.
- **Light mode:** `--color-primary` = `zinc-900` (near-black). Primary actions use neutral dark.

In both modes `--color-accent` is unchanged — it's the interactive/highlight color. This means accent-colored elements (borders, focus rings, gradient lines) look the same in both themes.

### Border tokens

Borders are derived from `--color-heading` using `color-mix` so they automatically adapt:

```css
--color-border:        color-mix(in srgb, var(--color-heading) 10%, transparent);
--color-border-strong: color-mix(in srgb, var(--color-heading) 16%, transparent);
```

Light mode heading is dark (zinc-900) → borders are dark-tinted. Dark mode heading is light (zinc-50) → borders are light-tinted. One formula, both themes.

---

## 4. Tailwind Variants: `light:` and `dark:`

**File:** `src/styles/global.css` (lines 17–18)

```css
@custom-variant light (&:where([data-theme="light"], [data-theme="light"] *));
@custom-variant dark  (&:where([data-theme="dark"],  [data-theme="dark"]  *));
```

These register `light:` and `dark:` as first-class Tailwind v4 variants. Usage everywhere in the codebase:

```html
<div class="dark:text-zinc-200 light:text-zinc-600">...</div>
<div class="dark:bg-white/5 light:bg-black/5">...</div>
```

**Why not use the built-in Tailwind `dark:` variant?**  
The built-in `dark:` variant targets `prefers-color-scheme` media query or the `.dark` class. This project uses `data-theme` on `<html>` to allow explicit user override regardless of OS preference. The `@custom-variant` approach makes the data attribute the single source of truth.

---

## 5. State Management: `UseMode` Hook

**File:** `src/hooks/theme/UseMode.ts`

React's role is everything that happens *after* initial paint: responding to toggle clicks, syncing across tabs, watching OS preference changes. The inline script already handled paint prevention — React just maintains the live state.

### Shape

```ts
const [isLight, setIsLight] = UseMode();
// isLight: boolean
// setIsLight: (value: boolean) => void
```

### Internal state

```ts
const [storedTheme, setStoredTheme] = useState<ThemeMode | null>(() => resolveStoredTheme());
const [systemTheme, setSystemTheme]  = useState<ThemeMode>(() => resolveSystemTheme());

const theme = storedTheme ?? systemTheme;  // explicit preference beats system
const isLight = theme === "light";
```

Two separate pieces of state because they have different semantics:
- `storedTheme` — the user's explicit, persisted preference (`null` if they've never touched it)
- `systemTheme` — the current OS preference, always tracking
- `theme` — computed: stored wins if present, otherwise system

### `setIsLight` — the toggle function

```ts
const setIsLight = (value: boolean) => {
  const nextTheme = value ? "light" : "dark";
  setStoredTheme(nextTheme);
  try {
    window.localStorage.setItem("theme", nextTheme);
  } catch { /* ignore quota/private browsing errors */ }
};
```

Only writes `storedTheme` — never touches `systemTheme`. Once a user toggles manually, their stored pref wins forever until cleared.

### DOM synchronization (`useEffect`)

```ts
useEffect(() => {
  const root = document.documentElement;
  root.setAttribute("data-theme", isLight ? "light" : "dark");
  root.style.colorScheme = isLight ? "light" : "dark";

  // Update PWA/browser chrome color
  const computed = getComputedStyle(root).getPropertyValue("--color-bg3").trim();
  if (computed) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", computed);
  }
}, [isLight]);
```

Every time `isLight` changes, this effect:
1. Updates `data-theme` → CSS `[data-theme="X"]` rules re-evaluate instantly
2. Updates `colorScheme` → browser native controls (scrollbars, date pickers) re-render
3. Reads the post-switch computed `--color-bg3` and stamps the `theme-color` meta

### OS preference watcher

```ts
useEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const handleChange = (event: MediaQueryListEvent) => {
    if (resolveStoredTheme() !== null) return;  // user has explicit pref — ignore OS changes
    setSystemTheme(event.matches ? "light" : "dark");
  };
  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventValue("change", handleChange);
}, []);
```

If the OS switches from dark to light mode at 6am, this updates `systemTheme`. But if the user has ever explicitly toggled the site, `storedTheme` is set, so `theme = storedTheme ?? systemTheme` returns the stored pref and the OS change has no effect.

---

## 6. Accent Color System

**Files:** `src/hooks/useAccentColor.ts`, `src/utils/theme.ts`

The accent system is completely independent of dark/light mode — it works the same in both.

### Available colors

```ts
// src/utils/theme.ts
export const ACCENT_COLORS = [
  "var(--main-accent)",        // #5e76f6 — default brand indigo
  "var(--color-purple-700)",
  "var(--color-teal-500)",
  "var(--color-emerald-500)",
  "var(--color-lime-500)",
  "var(--color-red-500)",
  "var(--color-pink-500)",
  "var(--color-orange-500)",
  "#722F37",                   // custom burgundy
] as const;
```

`var(--main-accent)` is a frozen reference to `#5e76f6` in the `@theme` block. Using a CSS var (not the hex) means if the brand color ever changes, you update one line in global.css.

### `useAccentColor` hook

```ts
export function useAccentColor() {
  const [accent, setAccent] = useLocalStorageState<AccentColor>("accent", ACCENT_COLORS[0], {
    raw: true,
    validate: (value): value is AccentColor => ACCENT_COLORS.includes(value),
    syncTabs: true,
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--color-accent", accent);
  }, [accent]);

  return { accent, setAccent, accents: ACCENT_COLORS };
}
```

`validate` rejects any stored value that isn't in `ACCENT_COLORS`. If someone manually edited localStorage to an invalid value, it falls back to the default rather than applying a broken color.

**Why `style.setProperty` and not a class?**  
Setting the CSS custom property inline on `:root` (via `documentElement.style`) overrides the `@theme` definition. All 11 derived accent shade tokens (`--color-accent-50` through `--color-accent-950`) recompute instantly via the OKLCH relative color formula because they all chain off `var(--color-accent)`.

---

## 7. localStorage Schema

| Key | Type | Valid values | Default | Written by |
|---|---|---|---|---|
| `theme` | Raw string | `"light"`, `"dark"` | (not set → use OS) | `UseMode.setIsLight()` |
| `accent` | Raw string | Values in `ACCENT_COLORS` | `"var(--main-accent)"` | `useAccentColor.setAccent()` |
| `user-a11y-prefs` | JSON object | Complex a11y settings | (not set) | Accessibility integration |

Both theme and accent are stored as raw strings (not JSON). The `useLocalStorageState` hook's `raw: true` option keeps them as plain strings — no `JSON.parse` overhead on read.

---

## 8. UI Components

### `ThemeControls.tsx` — the orchestrator

**File:** `src/components/ThemeControls/ThemeControls.tsx`

Renders differently on mobile vs desktop:

**Desktop (≥ 640px):** Three inline controls in the header
```
[ LanguagePicker ] [ DarkLightToggle ] [ AccentPicker ]
```

**Mobile (< 640px):** A single settings icon (⚙) opens a floating panel with sub-panels:
```
Root panel:
  → Theme (tap to toggle immediately, shows current: Light/Dark)
  → Language (tap to open language sub-panel)
  → Accent (tap to open accent sub-panel)
```

Mobile close conditions: outside click, `Escape` key, window resize to ≥ 640px.

### `DarkLightToggle.tsx`

```tsx
export default function DarkLightToggle({ gradientId, onApplied }) {
  const [isLight, setIsLight] = UseMode();
  return (
    <CircleCheckbox
      checked={isLight}
      onChange={(e) => { setIsLight(e.target.checked); onApplied?.(); }}
      aria-label="Toggle light mode"
      className="faded-bg"
    >
      <div className="theme-toggle-icon theme-toggle-icon--moon">
        <Icon icon="fa6:moon" size="md" color={`url(#${gradientId})`} />
      </div>
      <div className="theme-toggle-icon theme-toggle-icon--sun">
        <Icon icon="fa6:sun" size="sm" color={`url(#${gradientId})`} />
      </div>
    </CircleCheckbox>
  );
}
```

The moon/sun icon swap is handled by CSS (not React conditional rendering) so it works without hydration jank:

```css
/* src/components/ThemeControls/DarkLightToggle.css */
.theme-toggle-icon--sun { display: none; }

[data-theme="light"] .theme-toggle-icon--sun  { display: block; }
[data-theme="light"] .theme-toggle-icon--moon { display: none; }

[data-theme="dark"] .theme-toggle-icon--sun   { display: none; }
[data-theme="dark"] .theme-toggle-icon--moon  { display: block; }
```

Since `data-theme` is set by the inline script before any JS loads, the correct icon shows even before React hydrates.

### Icon gradient

Both `DarkLightToggle` and `AccentPicker` receive a `gradientId` prop from `ThemeControls`. The gradient is defined once in a hidden `<svg>` in `ThemeControls.tsx`:

```tsx
<svg aria-hidden="true" width="0" height="0">
  <defs>
    <linearGradient id={iconGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stopColor="currentColor" className="text-primary-100" />
      <stop offset="55%"  stopColor="currentColor" className="text-primary" />
      <stop offset="100%" stopColor="currentColor" className="text-accent-800" />
    </linearGradient>
    <linearGradient id={accentGradientId} ...>...</linearGradient>
  </defs>
</svg>
```

Icons receive `color={`url(#${gradientId})`}` — SVG's `fill: url(#id)` references the gradient. The gradient uses `currentColor` at each stop, which in turn uses Tailwind color classes (`text-primary`, `text-primary-100`). This means the icon gradient automatically adapts when the theme or accent changes.

### `AccentPicker.tsx` / `AccentPickerContent.tsx`

Dropdown showing `SquareCheckbox` swatches for each color in `ACCENT_COLORS`. Lazy-initializes content on first open (`hasOpened` flag) to avoid rendering 9 color swatches on load.

---

## 9. Cross-Tab Sync

Both `UseMode` and `useLocalStorageState` (used by `useAccentColor`) listen for `StorageEvent` on `window`.

When a user toggles the theme in Tab A:
1. `localStorage.setItem('theme', 'light')` fires in Tab A
2. Browser dispatches a `storage` event to all other tabs (Tab B, Tab C, …)
3. `UseMode`'s `storage` listener in Tab B receives `event.key === 'theme'`, reads `event.newValue`
4. Calls `setStoredTheme(newValue)` → React re-renders → `useEffect` updates `data-theme` on `<html>`

Same mechanism for accent color via `useLocalStorageState`'s `syncTabs: true` option.

**Important:** The `storage` event only fires in *other* tabs, not the one that made the change. The tab that wrote to localStorage updates state directly via `setStoredTheme`.

---

## 10. Full Data-Flow Walkthrough

### First page load (no localStorage)

```
1. Browser parses HTML
2. Theme.astro's inline script runs (BLOCKING)
   - localStorage['theme'] → null
   - window.matchMedia('(prefers-color-scheme: light)').matches → e.g. false
   - Sets <html data-theme="dark">
   - Sets <html style="color-scheme: dark">
   - localStorage['accent'] → null → skip
3. CSS evaluates — [data-theme="dark"] overrides apply, all tokens resolve
4. First paint — correct dark theme, no flash
5. Deferred script runs (idle) — reads --color-bg3, updates <meta name="theme-color">
6. React hydrates
   - UseMode: storedTheme = null, systemTheme = "dark" → isLight = false
   - useAccentColor: accent = ACCENT_COLORS[0] = "var(--main-accent)"
   - DarkLightToggle renders with moon icon visible (CSS already handled this)
```

### User toggles to light

```
1. Clicks DarkLightToggle → CircleCheckbox onChange fires
2. setIsLight(true) called
   - setStoredTheme("light")
   - localStorage.setItem('theme', 'light')
3. isLight → true, UseMode's DOM effect runs
   - <html data-theme="light">
   - <html style="color-scheme: light">
   - Reads computed --color-bg3 → updates theme-color meta
4. CSS re-evaluates [data-theme="light"] — all tokens update instantly
   --color-primary → var(--color-zinc-900)
   --color-bg      → var(--color-primary-light)   (zinc-50)
   etc.
5. DarkLightToggle.css: [data-theme="light"] .theme-toggle-icon--sun → display: block
   Moon hidden, sun shows
6. storage event fires in other tabs → they sync
```

### User changes accent to teal

```
1. Clicks AccentPicker → selects "var(--color-teal-500)"
2. setAccent("var(--color-teal-500)") called in useAccentColor
   - useLocalStorageState writes localStorage['accent'] = "var(--color-teal-500)"
3. useEffect: document.documentElement.style.setProperty('--color-accent', 'var(--color-teal-500)')
4. CSS recomputes:
   --color-accent-50  = oklch(from teal-500 l+0.40 c h)
   --color-accent-100 = oklch(from teal-500 l+0.35 c h)
   ... all 11 shades update
   In dark mode: --color-primary = var(--color-accent) → also teal now
5. All text-primary, bg-primary, border-primary, gradients update
6. storage event fires in other tabs → they sync
```

### OS switches from dark to light (user has no stored pref)

```
1. matchMedia listener in UseMode fires
2. resolveStoredTheme() returns null → proceed
3. setSystemTheme("light")
4. theme = null ?? "light" = "light" → isLight = true
5. Same DOM update as toggling manually
```

### OS switches (user HAS a stored pref)

```
1. matchMedia listener fires
2. resolveStoredTheme() returns "dark" (not null) → early return
3. systemTheme updates internally but theme = "dark" (stored wins)
4. No DOM change
```

---

## 11. File Map

```
src/
├── layouts/
│   └── Theme.astro                     ← FOUC prevention + CSS imports
│
├── styles/
│   └── global.css                      ← @theme tokens, [data-theme] overrides,
│                                          @custom-variant light/dark, utility classes
│
├── hooks/
│   ├── theme/
│   │   └── UseMode.ts                  ← dark/light state, DOM sync, OS listener
│   ├── useAccentColor.ts               ← accent state, CSS var patching
│   ├── useLocalStorageState.ts         ← generic LS hook (used by accent)
│   └── useLocalStorage.ts              ← re-export shim for useLocalStorageState
│
├── utils/
│   └── theme.ts                        ← ACCENT_COLORS constant + AccentColor type
│
└── components/
    └── ThemeControls/
        ├── ThemeControls.tsx            ← orchestrator (desktop/mobile layout)
        ├── DarkLightToggle.tsx          ← toggle button component
        ├── DarkLightToggle.css          ← moon/sun icon visibility rules
        ├── AccentPicker.tsx             ← accent dropdown
        ├── AccentPickerContent.tsx      ← accent swatch grid
        ├── LanguagePicker.tsx           ← language selector (separate system)
        └── checkboxes/
            ├── CircleCheckbox.tsx       ← styled checkbox for theme toggle
            └── SquareCheckbox.tsx       ← styled checkbox for accent swatches
```

---

## 12. Key Gotchas

**1. `data-theme` is the single source of truth — not a class**  
Everything keys off `[data-theme="X"]` on `<html>`. CSS, the `DarkLightToggle.css` icon rules, the Tailwind `light:`/`dark:` variants — all of it. Never use `.dark` or `.light` classes; they won't work.

**2. The inline script must stay minimal**  
`is:inline` blocks rendering. Any extra logic there (fetches, complex parsing, imports) delays first paint. The script intentionally uses `var` declarations and an IIFE — no ES6, no module syntax — to ensure it runs in the oldest possible environments without transpilation.

**3. `--color-primary` diverges between themes**  
In dark mode `--color-primary = --color-accent` (the brand color). In light mode `--color-primary = zinc-900` (neutral). This means `text-primary`, `bg-primary`, and gradient classes that use `from-primary` look different across themes — by design. `--color-accent` stays consistent across both.

**4. Accent changes cascade through the OKLCH scale**  
When `--color-accent` changes, all 11 `--color-accent-X` shades recompute, *and* in dark mode all 11 `--color-primary-X` shades also recompute (because `--color-primary = var(--color-accent)`). A single `style.setProperty` call affects every tinted element on the page.

**5. The OKLCH scale can clip**  
Adding `0.40` to a high-lightness color's `l` value can exceed `1.0`. Modern browsers clamp this gracefully, but if you add a very light base color to `ACCENT_COLORS` the lightest shade variants may not look as expected.

**6. `UseMode` runs twice on initial hydration**  
React runs effects once on mount. The DOM was already correctly set by the inline script, so the first effect run writes the same value that's already there — a no-op visually. This is intentional and correct.

**7. `syncTabs: true` doesn't sync within the same tab**  
The Web Storage `storage` event only fires in other browsing contexts. In-tab updates go through React state directly. Don't rely on the storage listener to catch same-tab changes.

**8. Accent validation prevents injection**  
`useAccentColor`'s `validate` function checks that the stored value is strictly in the `ACCENT_COLORS` array. A manually edited localStorage entry like `"red; background: url(evil)"` would be rejected and fall back to the default.
