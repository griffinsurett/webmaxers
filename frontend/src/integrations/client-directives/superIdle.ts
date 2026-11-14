import type { ClientDirective } from 'astro';
import {
  createScrollHandler,
  createWheelHandler,
  createKeydownHandler,
  createImmediateHandler,
} from './shared/eventHandlers';
import { createHydrationTrigger } from './shared/hydrationHelpers';

type DirectiveConfig =
  | boolean
  | {
      /** Milliseconds to wait AFTER the browser reports idle. Default 4000. */
      delay?: number;
      /** Let an early interaction short-circuit the wait. Default true. */
      interruptible?: boolean;
    };

interface NormalizedOptions {
  delay: number;
  interruptible: boolean;
}

const DEFAULTS: NormalizedOptions = {
  delay: 4000,
  interruptible: true,
};

function normalizeOptions(value: DirectiveConfig | undefined): NormalizedOptions {
  if (typeof value === 'object' && value !== null) {
    return {
      delay:
        typeof value.delay === 'number' && Number.isFinite(value.delay)
          ? Math.max(0, value.delay)
          : DEFAULTS.delay,
      interruptible:
        typeof value.interruptible === 'boolean' ? value.interruptible : DEFAULTS.interruptible,
    };
  }

  return DEFAULTS;
}

/**
 * client:superIdle — for the heaviest, least urgent islands on a page.
 *
 * Hydrates on whichever comes first:
 *   • the browser going idle, PLUS a further delay (default 4s), or
 *   • the visitor's first interaction (scroll, wheel, pointer, touch, key).
 *
 * ── Why both ───────────────────────────────────────────────────────────────
 * `client:idle` alone fires as soon as the main thread is free, which on a fast
 * connection is still during the page's first moments — too early for something
 * that costs hundreds of KB. Adding a delay past idle pushes it clear of first
 * paint and of any late layout work, so the island lands in genuinely dead time.
 *
 * But a pure timer makes an engaged visitor wait: someone who scrolls at 0.5s
 * would sit on a placeholder until the timer expired. So an interaction
 * short-circuits the wait and hydrates immediately (`interruptible`, default on).
 *
 * The result: idle visitors get the island preloaded before they need it, and
 * interacting visitors never wait for a timer they have already outrun.
 *
 * ── vs client:firstInteraction ─────────────────────────────────────────────
 * `firstInteraction` NEVER loads for a visitor who does not interact — best for
 * anything that is worthless without interaction. `superIdle` always loads
 * eventually, so use it when the island should be ready in advance and the
 * bytes are affordable on an idle connection.
 *
 * Usage:
 *   <Heavy client:superIdle />
 *   <Heavy client:superIdle={{ delay: 6000 }} />
 *   <Heavy client:superIdle={{ interruptible: false }} />
 */
const superIdleDirective: ClientDirective = (load, options) => {
  if (typeof window === 'undefined') {
    return;
  }

  const { delay, interruptible } = normalizeOptions(options.value as DirectiveConfig);
  const controller = new AbortController();
  const triggerHydration = createHydrationTrigger(load, controller);

  let timerId: number | undefined;

  // `createHydrationTrigger` aborts the controller once it fires, which removes
  // every listener below — but the timer is not an event listener, so it has to
  // be cleared by hand or it would fire again after an interaction hydrated us.
  // (Harmless, since the trigger is idempotent, but it keeps a stray task off
  // the main thread.)
  controller.signal.addEventListener('abort', () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  });

  const startDelayTimer = () => {
    if (controller.signal.aborted) return;
    timerId = window.setTimeout(triggerHydration, delay);
  };

  // Wait for idle, THEN start the delay. requestIdleCallback is not in every
  // browser (notably older Safari), so fall back to a plain timeout — the delay
  // below is the substantive part of the wait either way.
  if (typeof window.requestIdleCallback === 'function') {
    // The timeout guarantees we still start on a permanently busy page.
    window.requestIdleCallback(startDelayTimer, { timeout: 2000 });
  } else {
    window.setTimeout(startDelayTimer, 200);
  }

  if (!interruptible) {
    return;
  }

  // Any sign of intent beats the timer. All passive so none of these can delay
  // scrolling; the AbortController removes them the moment hydration starts.
  const immediate = createImmediateHandler(triggerHydration);

  window.addEventListener('scroll', createScrollHandler(triggerHydration), {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener('wheel', createWheelHandler(triggerHydration), {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener('touchstart', immediate, {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener('pointerdown', immediate, {
    passive: true,
    signal: controller.signal,
  });
  window.addEventListener('keydown', createKeydownHandler(triggerHydration), {
    signal: controller.signal,
  });
};

export default superIdleDirective;
