# Custom Client Directives

This directory contains custom Astro client directives for fine-grained hydration control.

## Available Directives

### `client:superIdle`

For the heaviest, least urgent islands. Hydrates on whichever comes first:
the browser going idle **plus** a further delay (default 4s), or the visitor's
first interaction.

```astro
<Heavy client:superIdle />
<Heavy client:superIdle={{ delay: 6000 }} />
<Heavy client:superIdle={{ interruptible: false }} />
```

`client:idle` alone fires as soon as the main thread frees up, which is still
during the page's first moments — too early for something costing hundreds of
KB. The extra delay pushes it into genuinely dead time, while an early
interaction short-circuits the wait so an engaged visitor never waits out a
timer they have already outrun.

Versus `client:firstInteraction`: that one **never** loads for a visitor who
does not interact. Use `superIdle` when the island should be ready in advance
and the bytes are affordable on an idle connection.

### `client:firstInteraction`

Loads a component on the **first user interaction** of any kind. This is more aggressive than `client:idle` and less specific than individual interaction directives.

**Listens for:**
- Scroll events (wheel, touchmove, keyboard scroll)
- Click/pointer events
- Touch events
- Keyboard navigation

**Usage:**

```astro
<!-- Basic usage - loads on any interaction -->
<MyComponent client:firstInteraction />

<!-- With scroll threshold -->
<MyComponent client:firstInteraction={{ threshold: 100 }} />

<!-- Only listen for clicks -->
<MyComponent client:firstInteraction={{
  includeScroll: false,
  includeTouch: false,
  includeKeys: false,
  includeClick: true
}} />
```

**Options:**
- `threshold` (number): Scroll position threshold in pixels (default: 0)
- `includeScroll` (boolean): Listen for scroll events (default: true)
- `includeClick` (boolean): Listen for click/pointer events (default: true)
- `includeTouch` (boolean): Listen for touch events (default: true)
- `includeKeys` (boolean): Listen for keyboard scroll keys (default: true)

**Best for:**
- Below-the-fold components that should load quickly when user shows intent
- Interactive widgets that benefit from eager loading
- Components that don't need to be visible on initial render

---

### `client:scroll`

Loads a component when the user scrolls.

**Usage:**

```astro
<!-- Basic usage -->
<MyComponent client:scroll />

<!-- With threshold -->
<MyComponent client:scroll={100} />
<!-- or -->
<MyComponent client:scroll={{ threshold: 100 }} />
```

**Options:**
- `threshold` (number): Scroll position threshold in pixels

---

### `client:hover`

Loads a component when the user hovers over a target element.

**Usage:**

```astro
<!-- Hover on the component itself -->
<MyComponent client:hover />

<!-- Hover on a specific selector -->
<MyComponent client:hover=".my-selector" />

<!-- Custom events and options -->
<MyComponent client:hover={{
  selector: ".trigger",
  events: ["pointerover", "focus"],
  once: true,
  includeFocus: true
}} />
```

**Options:**
- `selector` (string): CSS selector to listen on (default: component element)
- `events` (string | string[]): Events to listen for (default: `["pointerover", "mouseover"]`)
- `once` (boolean): Remove listener after first trigger (default: true)
- `includeFocus` (boolean): Also listen for focus events (default: true)

---

### `client:click`

Loads a component when clicked, with event replay capabilities.

**Usage:**

```astro
<!-- Basic click -->
<MyComponent client:click />

<!-- Click on specific selector -->
<MyComponent client:click=".my-button" />

<!-- With custom events and replay -->
<MyComponent client:click={{
  selector: ".trigger",
  events: ["click", "pointerdown"],
  once: true,
  replay: true,
  handlerKey: "myHandler"
}} />
```

**Options:**
- `selector` (string): CSS selector to listen on
- `events` (string | string[]): Events to listen for (default: `["click"]`)
- `once` (boolean): Remove listener after first trigger (default: true)
- `replay` (boolean): Replay the event after hydration (default: true)
- `handlerKey` (string): Key for custom click handler registration

---

## Performance Benefits

These directives allow you to:

1. **Reduce initial bundle size** - Components load only when needed
2. **Improve Time to Interactive (TTI)** - Less JavaScript to parse upfront
3. **Optimize Core Web Vitals** - Better FCP, LCP, and TBT scores
4. **Progressive enhancement** - Server-rendered HTML works without JS

## Example: Portfolio Showcase

```astro
---
import PortfolioCarousel from '@/components/PortfolioCarousel';
---

<!-- Option 1: Load on first interaction (recommended for below-fold) -->
<PortfolioCarousel
  client:firstInteraction
  items={portfolioItems}
/>

<!-- Option 2: Load when visible -->
<PortfolioCarousel
  client:visible
  items={portfolioItems}
/>

<!-- Option 3: Load when user scrolls past hero -->
<PortfolioCarousel
  client:scroll={{ threshold: 500 }}
  items={portfolioItems}
/>
```

## Architecture

All directives use shared utilities from `./shared/`:

- **`eventHandlers.ts`** - Reusable event handler creators
- **`hydrationHelpers.ts`** - Hydration trigger utilities
- **`clientClickBridge.ts`** - Click handler registration/replay system

This DRY architecture ensures consistency and maintainability across all directives.
