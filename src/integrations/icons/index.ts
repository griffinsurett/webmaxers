// src/integrations/icons/index.ts
// Central exports for the icon integration

export {
  renderIcon,
  renderStringIcon,
  renderObjectIcon,
  getIconData,
  getIconName,
  getLibraryName,
  parseIconString,
  isEmoji,
  isValidIconString,
  iconSizeMap,
  type IconSize,
  type IconRenderOptions,
} from "./utils/iconLoader.js";

export {
  iconMap,
  type IconKey,
  type IconData,
} from "./utils/iconMap.generated.js";

export {
  ICON_LIBRARIES,
  SCANNABLE_PREFIXES,
  ICON_ALIAS_MAP,
  normalizeLibraryPrefix,
} from "./utils/iconConfig.js";
