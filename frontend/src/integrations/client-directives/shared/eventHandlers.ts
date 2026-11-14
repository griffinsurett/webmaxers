/**
 * Shared event handling utilities for client directives
 */

export const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);
export const INTERACTIVE_KEY_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);

export type EventName = keyof HTMLElementEventMap | (string & {});

/**
 * Check if scroll position meets threshold
 */
export const meetsScrollThreshold = (threshold: number = 0): boolean => {
  if (typeof window === 'undefined') return false;
  const y = window.scrollY ?? window.pageYOffset ?? 0;
  return y > threshold;
};

/**
 * Create scroll event handler
 */
export const createScrollHandler = (onTrigger: () => void, threshold: number = 0) => {
  return () => {
    if (meetsScrollThreshold(threshold)) {
      onTrigger();
    }
  };
};

/**
 * Create wheel event handler
 */
export const createWheelHandler = (onTrigger: () => void, threshold: number = 0) => {
  return (event: WheelEvent) => {
    if (event.deltaY !== 0 || event.deltaX !== 0 || meetsScrollThreshold(threshold)) {
      onTrigger();
    }
  };
};

/**
 * Create keyboard event handler that filters scroll keys
 */
export const createKeydownHandler = (onTrigger: () => void) => {
  return (event: KeyboardEvent) => {
    if (!SCROLL_KEYS.has(event.key)) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) {
        return;
      }

      const tagName = target.tagName ? target.tagName.toUpperCase() : '';
      if (INTERACTIVE_KEY_TARGETS.has(tagName)) {
        return;
      }
    }

    onTrigger();
  };
};

/**
 * Check if event target matches selector
 */
export const eventMatchesSelector = (event: Event, selector?: string): boolean => {
  if (!selector) return true;
  if (!(event.target instanceof Element)) return false;
  return Boolean(event.target.closest(selector));
};

/**
 * Register multiple event listeners with same options
 */
export interface EventListenerConfig {
  target: EventTarget;
  events: EventName[];
  handler: EventListenerOrEventListenerObject;
  options?: AddEventListenerOptions;
}

export const registerEventListeners = (configs: EventListenerConfig | EventListenerConfig[]): void => {
  const configArray = Array.isArray(configs) ? configs : [configs];

  for (const { target, events, handler, options } of configArray) {
    for (const eventName of events) {
      target.addEventListener(eventName, handler, options);
    }
  }
};

/**
 * Create a simple event handler that immediately triggers
 */
export const createImmediateHandler = (onTrigger: () => void) => {
  return () => onTrigger();
};
