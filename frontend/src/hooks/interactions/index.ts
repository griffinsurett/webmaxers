// src/hooks/interactions/index.ts
// Barrel export for interaction hooks - import only what you need for better tree-shaking

export {
  useScrollInteraction,
  type ScrollInteractionOptions,
  type ScrollDirection,
  type ScrollSource,
} from "./useScrollInteraction";

export {
  useHoverInteraction,
  type HoverInteractionOptions,
  type HoverIntentOptions,
} from "./useHoverInteraction";

export {
  usePointerInteraction,
  type PointerInteractionOptions,
} from "./usePointerInteraction";

export {
  useTouchInteraction,
  type TouchInteractionOptions,
} from "./useTouchInteraction";

export {
  useClickInteraction,
  type ClickInteractionOptions,
} from "./useClickInteraction";

export {
  useSideDragNavigation,
  type SideDragNavigationOptions,
} from "./useSideDragNavigation";

export {
  useKeyboardInteraction,
  type KeyboardInteractionOptions,
} from "./useKeyboardInteraction";

// Re-export utils for consumers that need them
export { resolveHost, getPositionForHost, type HostElement } from "./utils";
