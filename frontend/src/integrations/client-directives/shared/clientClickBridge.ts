export const CLIENT_CLICK_HANDLER_STORE_KEY = "__GREASTRO_CLIENT_CLICK_HANDLERS__";
export const CLIENT_CLICK_HANDLER_EVENT = "greastro-custom-hydrations";

type HandlerEntry = {
  handler: ClientClickHandler;
};

type HandlerStoreTarget = typeof globalThis & {
  [CLIENT_CLICK_HANDLER_STORE_KEY]?: Map<string, HandlerEntry>;
  __GREASTRO_CLIENT_CLICK_PENDING__?: Map<
    string,
    Array<(handler: ClientClickHandler | null) => void>
  >;
};

export type ClientClickHandlerContext = {
  event: Event;
  target: EventTarget | null;
  replay: () => void;
};

export type ClientClickHandler = (
  context: ClientClickHandlerContext
) => void | boolean;

const getHandlerStore = (): Map<string, HandlerEntry> => {
  const target = globalThis as HandlerStoreTarget;
  if (!target[CLIENT_CLICK_HANDLER_STORE_KEY]) {
    target[CLIENT_CLICK_HANDLER_STORE_KEY] = new Map();
  }

  return target[CLIENT_CLICK_HANDLER_STORE_KEY]!;
};

const getPendingStore = (): Map<
  string,
  Array<(handler: ClientClickHandler | null) => void>
> => {
  const target = globalThis as HandlerStoreTarget;
  if (!target.__GREASTRO_CLIENT_CLICK_PENDING__) {
    target.__GREASTRO_CLIENT_CLICK_PENDING__ = new Map();
  }
  return target.__GREASTRO_CLIENT_CLICK_PENDING__!;
};

const flushPendingInvocations = (
  key: string,
  handler: ClientClickHandler | null
) => {
  const pendingStore = getPendingStore();
  const queue = pendingStore.get(key);
  if (!queue?.length) {
    return;
  }

  pendingStore.delete(key);
  for (const invoke of queue) {
    try {
      invoke(handler);
    } catch {
      // ignore
    }
  }
};

const dispatchHandlerReady = (key: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CLIENT_CLICK_HANDLER_EVENT, {
      detail: { key },
    })
  );
};

const scheduleHandlerReady = (key: string, entry: HandlerEntry) => {
  const runReady = () => {
    const store = getHandlerStore();
    const current = store.get(key);
    if (!current || current !== entry) {
      return;
    }

    flushPendingInvocations(key, entry.handler);
    dispatchHandlerReady(key);
  };

  const win =
    typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? window
      : null;

  if (win) {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => {
        runReady();
      });
    });
    return;
  }

  if (typeof setTimeout === "function") {
    setTimeout(runReady, 0);
    return;
  }

  runReady();
};

export const enqueuePendingClientClickInvocation = (
  key: string | undefined | null,
  invocation: (handler: ClientClickHandler | null) => void
) => {
  if (!key) {
    return () => false;
  }

  const pendingStore = getPendingStore();
  const queue = pendingStore.get(key);
  if (queue) {
    queue.push(invocation);
  } else {
    pendingStore.set(key, [invocation]);
  }

  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    const pending = pendingStore.get(key);
    if (!pending) return false;
    const index = pending.indexOf(invocation);
    if (index !== -1) {
      pending.splice(index, 1);
      if (pending.length === 0) {
        pendingStore.delete(key);
      }
      return true;
    }
    return false;
  };
};

export const registerClientClickHandler = (
  key: string | undefined | null,
  handler: ClientClickHandler
) => {
  if (!key) return;

  const store = getHandlerStore();
  const entry: HandlerEntry = { handler };
  store.set(key, entry);
  scheduleHandlerReady(key, entry);
};

export const unregisterClientClickHandler = (
  key: string | undefined | null,
  handler: ClientClickHandler
) => {
  if (!key) return;

  const store = getHandlerStore();
  const existing = store.get(key);
  if (!existing || existing.handler !== handler) {
    return;
  }

  store.delete(key);
};

export const getRegisteredClientClickHandler = (
  key: string | undefined | null
): ClientClickHandler | null => {
  if (!key) return null;
  return getHandlerStore().get(key)?.handler ?? null;
};

export const waitForClientClickHandler = (
  key: string | undefined | null,
  timeout = 1500
): Promise<ClientClickHandler | null> => {
  if (!key) return Promise.resolve(null);

  const store = getHandlerStore();
  const existing = store.get(key);
  if (existing) {
    return Promise.resolve(existing.handler);
  }

  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let timer: number | undefined;

    const cleanup = () => {
      if (typeof timer !== "undefined") {
        window.clearTimeout(timer);
      }
      window.removeEventListener(
        CLIENT_CLICK_HANDLER_EVENT,
        handleReady as EventListener
      );
    };

    const handleReady = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.key !== key) return;
      cleanup();
      resolve(store.get(key)?.handler ?? null);
    };

    window.addEventListener(
      CLIENT_CLICK_HANDLER_EVENT,
      handleReady as EventListener
    );

    timer = window.setTimeout(() => {
      cleanup();
      resolve(store.get(key)?.handler ?? null);
    }, timeout);
  });
};
