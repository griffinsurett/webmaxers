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
  | number
  | {
      threshold?: number;
    };

interface NormalizedOptions {
  threshold: number;
}

const DEFAULTS: NormalizedOptions = {
  threshold: 0,
};

function normalizeOptions(value: DirectiveConfig | undefined): NormalizedOptions {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { threshold: Math.max(0, value) };
  }

  if (typeof value === 'object' && value !== null) {
    const threshold =
      typeof value.threshold === 'number' && Number.isFinite(value.threshold)
        ? Math.max(0, value.threshold)
        : DEFAULTS.threshold;
    return { threshold };
  }

  return DEFAULTS;
}

const scrollDirective: ClientDirective = (load, options) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { threshold } = normalizeOptions(options.value as DirectiveConfig);
  const controller = new AbortController();
  const triggerHydration = createHydrationTrigger(load, controller);

  window.addEventListener('scroll', createScrollHandler(triggerHydration, threshold), {
    passive: true,
    signal: controller.signal,
  });

  window.addEventListener('wheel', createWheelHandler(triggerHydration, threshold), {
    passive: true,
    signal: controller.signal,
  });

  window.addEventListener('touchmove', createImmediateHandler(triggerHydration), {
    passive: true,
    signal: controller.signal,
  });

  window.addEventListener('keydown', createKeydownHandler(triggerHydration), {
    signal: controller.signal,
  });

  if (meetsScrollThreshold(threshold)) {
    triggerHydration();
  }
};

export default scrollDirective;
