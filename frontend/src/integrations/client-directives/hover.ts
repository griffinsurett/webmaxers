import type { ClientDirective } from 'astro';
import type { EventName } from './shared/eventHandlers';
import { eventMatchesSelector } from './shared/eventHandlers';
import { waitForHydrationReady } from './shared/hydrationHelpers';

type DirectiveConfig =
  | boolean
  | string
  | {
      selector?: string;
      events?: EventName | EventName[];
      once?: boolean;
      includeFocus?: boolean;
    };

interface NormalizedOptions {
  selector?: string;
  events: EventName[];
  once: boolean;
  includeFocus: boolean;
}

const DEFAULT_EVENTS: EventName[] = ['pointerover', 'mouseover', 'touchstart'];

const DEFAULTS: NormalizedOptions = {
  events: DEFAULT_EVENTS,
  once: true,
  includeFocus: true,
};

function normalizeOptions(value: DirectiveConfig | undefined): NormalizedOptions {
  if (typeof value === 'object' && value !== null) {
    const { events, includeFocus } = value;
    const normalizedEvents = Array.isArray(events)
      ? events
      : typeof events === 'string'
        ? events
            .split(/[,\s]+/)
            .map((event) => event.trim())
            .filter(Boolean)
        : DEFAULT_EVENTS;

    return {
      selector: value.selector?.trim() || undefined,
      events: normalizedEvents.length ? normalizedEvents : DEFAULT_EVENTS,
      once: typeof value.once === 'boolean' ? value.once : DEFAULTS.once,
      includeFocus: typeof includeFocus === 'boolean' ? includeFocus : DEFAULTS.includeFocus,
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

const hoverDirective: ClientDirective = (load, options, el) => {
  const { selector, events, once, includeFocus } = normalizeOptions(options.value as DirectiveConfig);
  const controller = new AbortController();

  const doc = el.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  const eventTarget: EventTarget = selector && doc ? doc : el;

  let hydrated = false;
  let hydrating = false;
  let pendingClick: MouseEvent | null = null;

  // Capture clicks during hydration so we can replay them after
  const captureClick = (event: Event) => {
    if (hydrating && event instanceof MouseEvent && eventMatchesSelector(event, selector)) {
      pendingClick = event;
    }
  };

  // Replay a captured click event
  const replayClick = (target: EventTarget) => {
    if (!pendingClick) return;
    const cloned = new MouseEvent('click', {
      bubbles: pendingClick.bubbles,
      cancelable: pendingClick.cancelable,
      composed: pendingClick.composed,
      clientX: pendingClick.clientX,
      clientY: pendingClick.clientY,
      button: pendingClick.button,
      buttons: pendingClick.buttons,
    });
    pendingClick = null;
    setTimeout(() => target.dispatchEvent(cloned), 0);
  };

  const hydrateOnDemand = async (event: Event) => {
    if (hydrated || hydrating || !eventMatchesSelector(event, selector)) return;

    hydrating = true;

    // If triggered by touch, capture any clicks that happen during hydration
    const isTouchTrigger = event.type === 'touchstart';
    if (isTouchTrigger) {
      eventTarget.addEventListener('click', captureClick, { capture: true, signal: controller.signal });
    }

    const hydrate = await load();
    controller.abort();
    await hydrate();
    await waitForHydrationReady();

    hydrated = true;
    hydrating = false;

    // Replay captured click if we have one
    if (pendingClick && event.target instanceof EventTarget) {
      replayClick(event.target);
    }
  };

  for (const eventName of events) {
    eventTarget.addEventListener(
      eventName,
      hydrateOnDemand,
      {
        once,
        passive: true,
        signal: controller.signal,
      } as AddEventListenerOptions,
    );
  }

  if (includeFocus) {
    eventTarget.addEventListener(
      'focusin',
      hydrateOnDemand,
      {
        once,
        signal: controller.signal,
      } as AddEventListenerOptions,
    );
  }
};

export default hoverDirective;
