/**
 * Scroll Animation Plugin Registry
 *
 * Components can register plugins to react when animated elements
 * enter or leave the viewport. Keeps the observer free of component
 * specific logic.
 */

export type PluginMatcher = string | ((el: HTMLElement) => boolean);

export interface ScrollAnimationPlugin {
  name?: string;
  matches: PluginMatcher;
  onObserve?: (el: HTMLElement) => void;
  onEnter?: (el: HTMLElement) => void;
  onExit?: (el: HTMLElement) => void;
}

const plugins: ScrollAnimationPlugin[] = [];
const pluginNames = new Set<string>();
const listeners = new Set<(plugin: ScrollAnimationPlugin) => void>();

export function registerScrollAnimationPlugin(plugin: ScrollAnimationPlugin) {
  if (plugin.name && pluginNames.has(plugin.name)) {
    return plugin;
  }

  plugins.push(plugin);
  if (plugin.name) {
    pluginNames.add(plugin.name);
  }

  listeners.forEach((listener) => listener(plugin));
  return plugin;
}

export function getScrollAnimationPlugins() {
  return plugins;
}

export function onScrollAnimationPluginRegistered(
  listener: (plugin: ScrollAnimationPlugin) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
