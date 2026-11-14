interface IntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  once?: boolean;
  onEnter?: (entry: IntersectionObserverEntry) => void;
  onExit?: (entry: IntersectionObserverEntry) => void;
}

export function createIntersectionObserver(
  element: Element,
  {
    threshold = 0.1,
    root = null,
    rootMargin = "0px",
    once = false,
    onEnter,
    onExit,
  }: IntersectionObserverOptions = {}
) {
  let isVisible = false;
  let hasBeenSeen = false;
  let observer: IntersectionObserver | null = null;

  if (!element || typeof IntersectionObserver === "undefined") {
    return {
      isVisible,
      hasBeenSeen,
      disconnect: () => undefined,
    };
  }

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      const inView = entry.isIntersecting;
      isVisible = inView;

      if (inView) {
        if (!hasBeenSeen) hasBeenSeen = true;
        onEnter?.(entry);
        if (once) observer?.disconnect();
      } else {
        onExit?.(entry);
      }
    },
    { threshold, root, rootMargin }
  );

  observer.observe(element);

  return {
    get isVisible() {
      return isVisible;
    },
    get hasBeenSeen() {
      return hasBeenSeen;
    },
    disconnect: () => observer?.disconnect(),
  };
}
