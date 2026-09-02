// vite.chunks.js

export function manualChunks(id) {
  // Scroll observer - MUST come FIRST to prevent contamination with React
  // This is loaded by Theme.astro and must NOT pull in any React deps
  if (
    id.includes('integrations/scroll-animations/observer') ||
    id.includes('utils/IntersectionObserver')
  ) {
    return 'scroll-observer';
  }

  // Phaser — the space game engine, ~340 KB gzipped, which is larger than the
  // entire homepage's JS. It MUST stay in its own chunk so it can never be
  // merged into anything on the critical path: the /game route loads it via a
  // dynamic import on an explicit click, and this rule is what keeps that
  // promise honest. Placed before the React rule so nothing else can claim it.
  // See applications/space-game/PORTING.md §4.2.
  if (id.includes('node_modules/phaser')) {
    return 'phaser';
  }

  // NOTE: do NOT add a manualChunks rule for components/SpaceGame/.
  //
  // It was tried and it backfired. Forcing the game's modules into a named
  // chunk also pulled Vite's shared `__vitePreload` helper in with them, and
  // because that helper is imported by EVERY island on the site, every page
  // then loaded the game chunk — which statically imports phaser. Measured: the
  // homepage fetched all 1.2 MB of phaser, the exact regression PORTING.md
  // §4.2 exists to prevent, and it only showed in a production build.
  //
  // Left to itself, Rollup already splits the game correctly: the dynamic
  // import() in SpaceGameSurface is the code-split point, and the phaser rule
  // above keeps the engine isolated. Verify with the §4.2 check after touching
  // any of this.

  // Core React runtime (kept small and shared)
  if (
    id.includes('node_modules/react') ||
    id.includes('node_modules/react-dom') ||
    id.includes('node_modules/scheduler')
  ) {
    return 'react-core';
  }

  // Visibility/scroll hooks used by header LottieLogo - must be separate from
  // engagement-hooks to avoid pulling in carousels on initial load
  // IMPORTANT: This rule must come BEFORE engagement-hooks
  if (
    id.includes('hooks/interactions/useScrollInteraction') ||
    id.includes('hooks/animations/useVisibility') ||
    id.includes('hooks/interactions/utils')
  ) {
    return 'visibility-hooks';
  }

  // Theme controls - split into separate chunks for each island
  // Shared deps (CircleCheckbox, SquareCheckbox) go to theme-shared
  if (id.includes('ThemeControls/checkboxes/')) {
    return 'theme-shared';
  }
  if (id.includes('ThemeControls/DarkLightToggle')) {
    return 'theme-toggle';
  }
  if (id.includes('ThemeControls/AccentPicker')) {
    return 'theme-accent';
  }
  if (
    id.includes('ThemeControls/LanguageDropdown') ||
    id.includes('integrations/preferences/language/components/LanguageDropdown')
  ) {
    return 'theme-language';
  }

  // Bundle useLazyLoad and localStorage utils together with their consumers
  // This eliminates dependency chains for lazy-loaded components
  if (
    id.includes('hooks/useLazyLoad') ||
    id.includes('utils/storage') ||
    (id.includes('/Lazy') && id.includes('components'))
  ) {
    return 'lazy-utils';
  }

  // Shared UI primitives used by accordion and feature-cards
  // This MUST come BEFORE accordion and feature-cards rules
  // AnimatedBorder, IconListItem, and Icon are shared deps - put them in their own chunk
  // so they don't cause accordion to pull in feature-cards or vice versa
  if (
    id.includes('AnimatedBorder/') ||
    id.includes('LoopComponents/IconListItem') ||
    id.includes('/components/Icon.tsx') ||
    id.includes('/components/Icon/index')
  ) {
    return 'ui-primitives';
  }

  // Below-fold heavy components - keep these separate so they're only loaded
  // when scrolled into view (via client:visible)
  // These are NOT in the initial viewport and should be deferred
  if (id.includes('LoopComponents/FeatureCard')) {
    return 'feature-cards';
  }

  // Accordion component - below fold FAQ section
  // MUST come BEFORE carousels since VideoAccordion should be in accordion chunk
  // MUST be separate from theme controls and ui-primitives
  if (
    id.includes('LoopTemplates/Accordion') ||
    id.includes('LoopComponents/AccordionItem') ||
    id.includes('LoopComponents/EnhancedAccordionItem') ||
    id.includes('VideoAccordion')
  ) {
    return 'accordion';
  }

  // Carousels and heavy interactive sections - loaded on scroll
  if (
    id.includes('TestimonialCarousel') ||
    id.includes('PortfolioCarousel') ||
    id.includes('PortfolioScreenShowcase') ||
    id.includes('TechStackSection')
  ) {
    return 'carousels';
  }

  // Engagement hooks - carousel/autoplay/drag interactions (below-fold only)
  // Note: useScrollInteraction is excluded (handled by visibility-hooks above)
  if (
    id.includes('hooks/autoplay/') ||
    id.includes('hooks/autoscroll/') ||
    id.includes('hooks/interactions/useSideDragNavigation') ||
    id.includes('hooks/interactions/useEngagement')
  ) {
    return 'engagement-hooks';
  }
}

export function assetFileNames(assetInfo) {
  if (assetInfo.name?.endsWith('.css')) {
    if (assetInfo.name.includes('global') || assetInfo.name.includes('base')) {
      return 'assets/critical-[hash][extname]';
    }
    return 'assets/styles-[hash][extname]';
  }
  return 'assets/[name]-[hash][extname]';
}
