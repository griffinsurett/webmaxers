// Click Directive
import type { ClientDirective } from 'astro';
import type { EventName } from './shared/eventHandlers';
import { eventMatchesSelector } from './shared/eventHandlers';
import { waitForHydrationReady } from './shared/hydrationHelpers';
import {
  enqueuePendingClientClickInvocation,
  getRegisteredClientClickHandler,
} from './shared/clientClickBridge';

type DirectiveConfig =
  | boolean
  | string
  | {
      selector?: string;
      events?: EventName | EventName[];
      once?: boolean;
      replay?: boolean;
      handlerKey?: string;
    };

type NormalizedOptions = {
  selector?: string;
  events: EventName[];
  once: boolean;
  replay: boolean;
  handlerKey?: string;
};

const DEFAULT_EVENTS: EventName[] = ['click'];
const DEFAULTS: NormalizedOptions = {
  events: DEFAULT_EVENTS,
  once: true,
  replay: true,
};

function normalizeOptions(value: DirectiveConfig | undefined): NormalizedOptions {
  if (typeof value === 'object' && value !== null) {
    const events = value.events;
    const resolvedEvents = Array.isArray(events)
      ? events
      : typeof events === 'string'
        ? events
            .split(/[,\s]+/)
            .map((event) => event.trim())
            .filter(Boolean)
        : DEFAULT_EVENTS;

    return {
      selector: value.selector?.trim() || undefined,
      events: resolvedEvents.length > 0 ? resolvedEvents : DEFAULT_EVENTS,
      once: typeof value.once === 'boolean' ? value.once : DEFAULTS.once,
      replay: typeof value.replay === 'boolean' ? value.replay : DEFAULTS.replay,
      handlerKey: value.handlerKey?.trim() || undefined,
    };
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return {
      ...DEFAULTS,
      selector: value.trim(),
    };
  }

  return DEFAULTS;
}

const clickDirective: ClientDirective = (load, options, el) => {
  const { selector, events, once, replay, handlerKey } = normalizeOptions(options.value as DirectiveConfig);
  const controller = new AbortController();
  let hydrated = false;

  console.log('[client:click] Directive initialized', { selector, handlerKey, once, replay });

  const doc = el.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  const eventTarget: EventTarget = selector && doc ? doc : el;

  const shouldHydrate = (event: Event) => eventMatchesSelector(event, selector);

  const replayEvent = (event: Event) => {
    if (!replay) return;
    const target = event.target;
    if (!(target instanceof EventTarget)) {
      return;
    }

    const baseInit: EventInit = {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
    };

    let cloned: Event;

    if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
      cloned = new PointerEvent(event.type, {
        ...baseInit,
        pointerId: event.pointerId,
        width: event.width,
        height: event.height,
        pressure: event.pressure,
        tangentialPressure: event.tangentialPressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        twist: event.twist,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        detail: event.detail,
      });
    } else if (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) {
      cloned = new MouseEvent(event.type, {
        ...baseInit,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        detail: event.detail,
      });
    } else if (typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent) {
      cloned = new KeyboardEvent(event.type, {
        ...baseInit,
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
    } else {
      cloned = new Event(event.type, baseInit);
    }

    setTimeout(() => {
      try {
        target.dispatchEvent(cloned);
      } catch {
        // ignore
      }
    }, 0);
  };

  const hydrateOnDemand = async (event: Event) => {
    console.log('[client:click] hydrateOnDemand called', { hydrated, shouldHydrate: shouldHydrate(event) });
    if (hydrated || !shouldHydrate(event)) {
      console.log('[client:click] Skipping hydration (already hydrated or wrong target)');
      return;
    }

    hydrated = true;
    console.log('[client:click] Starting hydration...');
    const hydrate = await load();
    console.log('[client:click] Aborting pre-hydration listener');
    controller.abort();
    await hydrate();
    await waitForHydrationReady();
    console.log('[client:click] Hydration complete');

    if (handlerKey) {
      const context = {
        event,
        target: event.target instanceof EventTarget ? event.target : null,
        replay: () => replayEvent(event),
      };

      const invokeHandler = (handler: ReturnType<typeof getRegisteredClientClickHandler>) => {
        if (!handler) {
          return false;
        }

        try {
          const result = handler(context);
          if (result === false) {
            return false;
          }
          return true;
        } catch {
          return false;
        }
      };

      const immediateHandler = getRegisteredClientClickHandler(handlerKey);
      if (immediateHandler && invokeHandler(immediateHandler)) {
        return;
      }

      let cancelled = false;
      const cancelPending = enqueuePendingClientClickInvocation(
        handlerKey,
        (readyHandler) => {
          if (cancelled) return;
          cancelled = true;
          if (typeof fallbackTimer !== 'undefined') {
            window.clearTimeout(fallbackTimer);
          }

          const handlerToUse = readyHandler ?? getRegisteredClientClickHandler(handlerKey);
          if (invokeHandler(handlerToUse)) {
            return;
          }
          replayEvent(event);
        }
      );

      const fallbackTimer =
        typeof window !== 'undefined'
          ? window.setTimeout(() => {
              if (!cancelled) {
                cancelled = true;
                const removed = cancelPending();
                if (removed) {
                  replayEvent(event);
                }
              }
            }, 2000)
          : undefined;

      return;
    }

    replayEvent(event);
  };

  // Pre-hydration listener (removed after hydration via controller.abort())
  for (const eventName of events) {
    eventTarget.addEventListener(
      eventName,
      hydrateOnDemand,
      {
        once,
        passive: true,
        signal: controller.signal,
      } as AddEventListenerOptions
    );
  }
};

export default clickDirective;
