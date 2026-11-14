import type { ClientDirective } from 'astro';
import {
  createScrollHandler,
  createWheelHandler,
  createKeydownHandler,
  createImmediateHandler,
  meetsScrollThreshold,
} from './shared/eventHandlers';
import { createHydrationTrigger } from './shared/hydrationHelpers';

type DirectiveConfig =
  | boolean
  | {
      threshold?: number;
      includeScroll?: boolean;
      includeClick?: boolean;
      includeTouch?: boolean;
      includeKeys?: boolean;
    };

interface NormalizedOptions {
  threshold: number;
  includeScroll: boolean;
  includeClick: boolean;
  includeTouch: boolean;
  includeKeys: boolean;
}

const DEFAULTS: NormalizedOptions = {
  threshold: 0,
  includeScroll: true,
  includeClick: true,
  includeTouch: true,
  includeKeys: true,
};

function normalizeOptions(value: DirectiveConfig | undefined): NormalizedOptions {
  if (typeof value === 'object' && value !== null) {
    return {
      threshold:
        typeof value.threshold === 'number' && Number.isFinite(value.threshold)
          ? Math.max(0, value.threshold)
          : DEFAULTS.threshold,
      includeScroll: typeof value.includeScroll === 'boolean' ? value.includeScroll : DEFAULTS.includeScroll,
      includeClick: typeof value.includeClick === 'boolean' ? value.includeClick : DEFAULTS.includeClick,
      includeTouch: typeof value.includeTouch === 'boolean' ? value.includeTouch : DEFAULTS.includeTouch,
      includeKeys: typeof value.includeKeys === 'boolean' ? value.includeKeys : DEFAULTS.includeKeys,
    };
  }

  return DEFAULTS;
}

/**
 * Client directive that loads components on the first user interaction
 * Listens for: scroll, click, touch, and keyboard events
 * More aggressive than client:idle - loads immediately when user shows intent
 */
const firstInteractionDirective: ClientDirective = (load, options) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { threshold, includeScroll, includeClick, includeTouch, includeKeys } =
    normalizeOptions(options.value as DirectiveConfig);
  const controller = new AbortController();
  const triggerHydration = createHydrationTrigger(load, controller);

  // Register scroll events
  if (includeScroll) {
    window.addEventListener('scroll', createScrollHandler(triggerHydration, threshold), {
      passive: true,
      signal: controller.signal,
    });

    window.addEventListener('wheel', createWheelHandler(triggerHydration, threshold), {
      passive: true,
      signal: controller.signal,
    });

    // Check if already scrolled on mount
    if (meetsScrollThreshold(threshold)) {
      triggerHydration();
      return; // Early exit if already meets threshold
    }
  }

  // Register touch events
  if (includeTouch) {
    const touchHandler = createImmediateHandler(triggerHydration);

    window.addEventListener('touchstart', touchHandler, {
      passive: true,
      signal: controller.signal,
    });

    window.addEventListener('touchmove', touchHandler, {
      passive: true,
      signal: controller.signal,
    });
  }

  // Register click/pointer events
  if (includeClick) {
    const clickHandler = createImmediateHandler(triggerHydration);

    window.addEventListener('pointerdown', clickHandler, {
      passive: true,
      signal: controller.signal,
    });

    window.addEventListener('click', clickHandler, {
      passive: true,
      signal: controller.signal,
    });
  }

  // Register keyboard events
  if (includeKeys) {
    window.addEventListener('keydown', createKeydownHandler(triggerHydration), {
      signal: controller.signal,
    });
  }
};

export default firstInteractionDirective;
