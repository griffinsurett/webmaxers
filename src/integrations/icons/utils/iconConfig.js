// src/integrations/icons/utils/iconConfig.js
// Shared icon library configuration used by both the generator script and runtime loader.
// Kept in plain ESM so Node (scripts) and TS/JS code can both import it without tooling.

/**
 * Canonical icon library definitions.
 * - `package`: import path for react-icons
 * - `componentPrefix`: prefix used by react-icons exports
 * - `aliases`: accepted prefixes that should resolve to the canonical key
 */
export const ICON_LIBRARIES = {
  lu: {
    package: 'react-icons/lu',
    componentPrefix: 'Lu',
    aliases: ['lucide'],
  },
  fi: {
    package: 'react-icons/fi',
    componentPrefix: 'Fi',
    aliases: ['feather'],
  },
  fa: {
    package: 'react-icons/fa',
    componentPrefix: 'Fa',
    aliases: ['font-awesome', 'fas'],
  },
  fa6: {
    package: 'react-icons/fa6',
    componentPrefix: 'Fa',
    aliases: ['fa6-brands', 'fa6-solid'],
  },
  ai: {
    package: 'react-icons/ai',
    componentPrefix: 'Ai',
    aliases: [],
  },
  bi: {
    package: 'react-icons/bi',
    componentPrefix: 'Bi',
    aliases: [],
  },
  si: {
    package: 'react-icons/si',
    componentPrefix: 'Si',
    aliases: ['simple-icons'],
  },
  md: {
    package: 'react-icons/md',
    componentPrefix: 'Md',
    aliases: [],
  },
  pi: {
    package: 'react-icons/pi',
    componentPrefix: 'Pi',
    aliases: ['phosphor'],
  },
};

/**
 * Prefixes the generator will scan for in source/content files.
 * Note: `md` is intentionally excluded to avoid matching Tailwind breakpoints (md:hidden, etc.).
 */
export const SCANNABLE_PREFIXES = [
  'lu',
  'lucide',
  'fi',
  'feather',
  'fa',
  'fa6',
  'fas',
  'fa6-brands',
  'fa6-solid',
  'ai',
  'bi',
  'si',
  'simple-icons',
  'pi',
  'phosphor',
];

// Build and export alias map and normalizer so both generator and loader can share it
export const ICON_ALIAS_MAP = Object.entries(ICON_LIBRARIES).reduce((acc, [canonical, meta]) => {
  acc[canonical] = canonical;
  (meta.aliases || []).forEach((alias) => {
    acc[alias] = canonical;
  });
  return acc;
}, {});

export function normalizeLibraryPrefix(prefix) {
  return ICON_ALIAS_MAP[prefix] || prefix;
}
