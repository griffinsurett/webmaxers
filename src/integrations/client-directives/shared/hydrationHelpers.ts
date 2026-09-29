/**
 * Shared hydration utilities for client directives
 */

/**
 * Wait for hydration to be ready (ensures DOM is settled)
 */
export const waitForHydrationReady = (): Promise<void> => {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }

  return new Promise<void>((resolve) =>
    setTimeout(() => setTimeout(resolve, 0), 0)
  );
};

/**
 * Create a hydration trigger function with built-in guard
 */
export const createHydrationTrigger = (
  load: () => Promise<() => void | Promise<void>>,
  controller: AbortController
) => {
  let hydrated = false;

  return async () => {
    if (hydrated) {
      return;
    }
    hydrated = true;
    const hydrate = await load();
    controller.abort();
    await hydrate();
    await waitForHydrationReady();
  };
};

/**
 * Create a conditional hydration trigger
 */
export const createConditionalHydrationTrigger = (
  load: () => Promise<() => void | Promise<void>>,
  controller: AbortController,
  condition: (event: Event) => boolean
) => {
  let hydrated = false;

  return async (event: Event) => {
    if (hydrated || !condition(event)) {
      return;
    }
    hydrated = true;
    const hydrate = await load();
    controller.abort();
    await hydrate();
    await waitForHydrationReady();
  };
};
