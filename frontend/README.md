# Greastro

**Griffin's Web Services + React + Astro = Greastro**  
A type-safe, enterprise-ready static site generator built on Astro with advanced content management, relational queries, and automatic page generation.

[![Built with Astro](https://astro.badg.es/v2/built-with-astro/tiny.svg)](https://astro.build)

## Overview

Greastro extends Astro's content collections with a powerful, database-like query system, automatic page generation, hierarchical content relationships, and a flexible component architecture. It's designed for developers who want the performance of static sites with the flexibility of dynamic content management systems.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Advanced Features](#advanced-features)
- [User Preferences System](#user-preferences-system)
- [Performance Optimizations](#performance-optimizations)
- [API Reference](#api-reference)
- [Scripts](#scripts)
- [Contributing](#contributing)

## Key Features

### 🎯 Advanced Content Management
- **Type-safe content collections** with Zod validation
- **Automatic page generation** with configurable routing (`/collection/item` or `/item`)
- **Meta-driven configuration** via `_meta.mdx` files
- **Override pattern** for flexible content control (item → collection → system defaults)
- **MDX support** with frontmatter validation

### 🔍 Database-Like Query System
- **Relational queries** with graph-based relationship tracking
- **Hierarchical content** with parent-child relationships
- **Advanced filtering** with composable filter functions
- **Multi-level sorting** and pagination
- **Reference resolution** with lazy loading
- **Indirect relations** via multi-hop graph traversal
```typescript
// Query like a database
const posts = await query('blog')
  .where(whereEquals('author', 'jane-doe'))
  .orderBy(sortByDate('publishDate', 'desc'))
  .limit(10)
  .withRelations(true)
  .get();
```

### 🎨 Flexible Component System
- **ContentRenderer** component with multiple variants (Grid, List, Blog, Masonry, Accordion, etc.)
- **Dynamic layout system** with custom layouts per collection/item
- **Polymorphic button components** (renders as `<button>` or `<a>` based on props)
- **Type-safe icon system** supporting Lucide, Font Awesome, Simple Icons, and more
- **Reusable loop templates** for consistent content display

### 🗺️ Intelligent Menu System
- **Automatic menu generation** from content with `addToMenu` frontmatter
- **Hierarchical menus** with unlimited nesting
- **Semantic ID generation** preventing collisions
- **Desktop and mobile variants** with responsive behavior
- **Active state detection** with exact path matching

### 🔗 Link Tree Page
- **Mobile-first link aggregation** page at `/links` similar to Linktree
- **Filtered menu system** showing only `links-menu` items
- **Full-width card design** with external link indicators
- **Icon support** for visual identification
- **Responsive layout** optimized for mobile sharing

### 🔗 Smart Redirect Management
- **Automatic redirects** from `redirectFrom` frontmatter
- **Path alias redirects** (automatically redirect `/collection/item` ↔ `/item`)
- **Validation system** preventing circular redirects and conflicts
- **Security checks** against XSS and open redirects

### 🔍 SEO & Analytics
- **Comprehensive SEO** with Open Graph, Twitter Cards, and JSON-LD
- **Automatic metadata** from content frontmatter
- **Image optimization** with Astro's image service
- **Structured data** for rich search results
- **Cookie consent** with GDPR/CCPA compliance

### 🛠️ Developer Experience
- **Full TypeScript** with strict type safety
- **Hot module replacement** during development
- **Comprehensive error handling** with helpful messages
- **Automatic ID generation** for sections and components
- **Extensive utilities** for strings, paths, images, and more

## Architecture

### Content Collections
Collections are defined in `src/content/config.ts` and configured via `_meta.mdx` files:
```yaml
---
# src/content/blog/_meta.mdx
title: "Blog"
description: "Latest articles"
hasPage: true              # Generate /blog index page
itemsHasPage: true         # Generate individual post pages
itemsLayout: "BlogLayout"  # Custom layout for posts
itemsAddToMenu:
  - menu: "main-menu"      # Auto-add all posts to menu
---
```

### Query System
The query system builds a relationship graph at build time, enabling:
- Direct references (A → B)
- Reverse references (B ← A)
- Parent-child hierarchies
- Sibling relationships
- Ancestor/descendant chains
- Indirect relations (A → B → C)

### Page Generation
Pages are generated automatically based on configuration:
- **Collection index pages**: `/[collection]/index.astro`
- **Collection-level items**: `/[collection]/[slug].astro`
- **Root-level items**: `/[slug].astro`

Control via frontmatter:
```yaml
---
title: "About Us"
rootPath: true    # Generate at /about instead of /pages/about
hasPage: true     # Generate a page for this item
---
```

### Component Variants
The `ContentRenderer` component accepts a `variant` prop to render content in different layouts:
```astro
<!-- Grid layout -->
<ContentRenderer 
  query={query('services')} 
  variant="CardVariant" 
  columns={3} 
/>

<!-- Blog layout with metadata -->
<ContentRenderer 
  query={query('blog').limit(5)} 
  variant="BlogVariant" 
/>

<!-- Accordion for FAQs -->
<ContentRenderer 
  query={query('faq')} 
  variant="AccordionVariant" 
/>
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm/pnpm/yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/griffinswebservices/greastro.git
cd greastro

# Install dependencies
npm install

# Start development server
npm run dev
```

### Create Your First Collection

1. **Create a collection directory:**
```bash
mkdir src/content/products
```

2. **Add collection metadata:**
```yaml
# src/content/products/_meta.mdx
---
title: "Products"
description: "Our product catalog"
hasPage: true
itemsHasPage: true
---
```

3. **Add some content:**
```yaml
# src/content/products/widget-pro.mdx
---
title: "Widget Pro"
description: "Professional widget for serious users"
price: "$99"
---

The Widget Pro is our flagship product...
```

4. **Query and display:**
```astro
<ContentRenderer 
  query={query('products')} 
  variant="CardVariant"
  columns={3}
/>
```

## Project Structure
```
src/
├── components/
│   ├── ContentRenderer/      # Universal section renderer
│   │   ├── variants/         # Layout variants (Grid, Blog, List, etc.)
│   │   └── ContentRenderer.types.ts
│   ├── preferences/          # User preference components
│   │   ├── consent/          # Cookie consent system
│   │   ├── language/         # Multi-language support
│   │   ├── accessibility/    # Accessibility features
│   │   └── theme/            # Dark mode toggle
│   ├── Button.astro          # Polymorphic button
│   ├── Icon.tsx              # Icon system
│   └── Modal.tsx             # Lazy-loaded modal
├── content/
│   ├── config.ts             # Collection definitions
│   ├── schema.ts             # Shared schemas
│   ├── [collection]/         # Content collections
│   │   ├── _meta.mdx         # Collection config
│   │   └── *.mdx             # Collection items
│   ├── menus/                # Menu configuration
│   └── siteData.ts           # Global site config
├── hooks/
│   ├── useLocalStorage.ts    # localStorage state management
│   ├── useTheme.ts           # Dark mode hook
│   ├── useCookieStorage.ts   # Cookie utilities hook
│   └── useAccessibility.ts   # Accessibility preferences
├── layouts/
│   ├── BaseLayout.astro      # Main layout
│   ├── PreferencesLayout.astro # User preferences wrapper
│   └── collections/          # Custom collection layouts
├── utils/
│   ├── content/              # Content utilities
│   │   ├── query.ts          # Query builder
│   │   ├── graph.ts          # Relation resolution
│   │   └── hierarchy.ts      # Parent-child queries
│   ├── storage.ts            # localStorage utilities
│   ├── cookies.ts            # Cookie utilities
│   ├── collections/          # Collection utilities
│   ├── redirects/            # Redirect system
│   ├── loaders/              # Custom Astro loaders
│   └── pageGeneration/       # Static page helpers
└── styles/
    ├── global.css            # Base styles
    ├── preferences.css       # Preference button styles
    ├── accessibility.css     # A11y feature styles
    └── language-switcher.css # Language UI styles
```

## Configuration

### Content Collections
Define collections in `src/content/config.ts`:
```typescript
export const collections = {
  'products': defineCollection({
    schema: ({ image }) => baseSchema({ image }).extend({
      price: z.string(),
      features: z.array(z.string()).default([]),
    }),
  }),
};
```

### Redirects
Configure automatic redirects in `astro.config.mjs`:
```javascript
import { buildRedirectConfig } from './src/utils/redirects';

export default defineConfig({
  redirects: buildRedirectConfig(),
});
```

### SEO
Configure site-wide SEO in `src/content/siteData.ts`:
```typescript
export const siteData = {
  title: "Your Site Name",
  description: "Your site description",
  domain: "yoursite.com",
};
```

### Environment Variables
```env
PUBLIC_SITE_DOMAIN=yoursite.com
```

## Advanced Features

### Custom Layouts
Create custom layouts for collections:
```astro
// src/layouts/collections/ProductLayout.astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';

const { entry, Content } = Astro.props;
---

<BaseLayout>
  <h1>{entry.data.title}</h1>
  <p class="price">{entry.data.price}</p>
  <Content />
</BaseLayout>
```

Specify in `_meta.mdx`:
```yaml
---
itemsLayout: "ProductLayout"
---
```

### Hierarchical Content
Create parent-child relationships:
```yaml
# src/content/services/web-development.mdx
---
title: "Web Development"
order: 1
---

# src/content/services/frontend.mdx
---
title: "Frontend Development"
parent: "web-development"
order: 1
---
```

Query hierarchy:
```typescript
const children = await getChildren('services', 'web-development');
const tree = await getTree('services', 'web-development', 3);
```

### Relational Content
Reference other collections:
```yaml
---
title: "My Blog Post"
author: "jane-doe"  # References authors collection
tags: ["astro", "web-dev"]
---
```

Query with relations:
```typescript
const result = await query('blog')
  .withRelations(true, 2)
  .get();

// Access related author
const author = result.relations?.get('blog:my-post')?.references;
```

### Creating Custom Variants

Create a new variant in `src/components/ContentRenderer/variants/`:
```astro
---
// CustomVariant.astro
import type { BaseVariantProps } from "../ContentRenderer.types";

interface Props extends BaseVariantProps {
  customProp?: string;
}

const { entries, title, description, customProp } = Astro.props;
---

<section>
  {title && <h2>{title}</h2>}
  {description && <p>{description}</p>}
  
  <div class="custom-layout">
    {entries.map(entry => (
      <article>
        <h3>{entry.data.title}</h3>
        <p>{entry.data.description}</p>
      </article>
    ))}
  </div>
</section>
```

### Available Variants

- **CardVariant**: Responsive grid layout (1-6 columns)
- **ListVariant**: Vertical stack of horizontal cards
- **BlogVariant**: Article layout with metadata (1-3 columns)
- **CardVariant**: Feature showcase cards (1-4 columns)
- **CardVariant**: Pinterest-style layout
- **AccordionVariant**: Collapsible Q&A
- **HeroVariant**: Full-width hero section
- **ContactVariant**: Contact information cards
- **SocialMediaVariant**: Social media icons
- **MenuVariant**: Navigation menu

## User Preferences System

Greastro includes a comprehensive, unified user preferences system with **zero-performance-impact** for users who never interact with preference features. All preference systems follow the same architectural pattern:

### Core Principles

1. **Zero Load by Default**: Features load 0KB JavaScript until explicitly used
2. **localStorage First**: All preferences stored client-side, no server required
3. **Cross-Tab Sync**: Preferences synchronized across browser tabs automatically
4. **Inline Detection**: Ultra-fast inline scripts detect preferences before page render
5. **Lazy Loading**: Components load only when user interacts with them

### Cookie Consent System

**Performance**: 0KB for returning users, ~8KB for first-time users

GDPR/CCPA-compliant cookie consent with localStorage-based preference storage:
```astro
---
// src/layouts/PreferencesLayout.astro
import CookiePreferencesButton from "@/components/preferences/consent/CookiePreferencesButton";
import CookieConsentBanner from "@/components/preferences/consent/CookieConsentBanner";
---

<CookiePreferencesButton client:visible />
<CookieConsentBanner client:idle />
```

**Features**:
- **Zero-load optimization**: Banner never loads for users who already consented
- **Granular controls**: Necessary, Functional, Performance, Targeting categories
- **Lazy modal**: Settings modal loads only when user clicks "Cookie Settings"
- **Inline detection**: Quick `document.cookie` check prevents unnecessary React hydration

**Usage in React**:
```typescript
import { useCookieStorage } from '@/hooks/useCookieStorage';

const { getCookie, setCookie } = useCookieStorage();

// Check consent
const consent = getCookie('cookie-consent');
const parsed = consent ? JSON.parse(consent) : null;

if (parsed?.performance) {
  // Load analytics
}
```

### Multi-Language Support (Google Translate)

**Performance**: 0KB API load when using cached translations

Cookie-based Google Translate integration with localStorage caching:
```astro
---
import LanguageSwitcher from "@/components/preferences/language/LanguageSwitcher";
import GoogleTranslateScript from "@/components/preferences/language/GoogleTranslateScript.astro";
import LanguageDetectionScript from "@/components/preferences/language/LanguageDetectionScript.astro";
---

<!-- Inline script runs before page render -->
<LanguageDetectionScript />

<!-- Google Translate API loads conditionally -->
<GoogleTranslateScript />

<!-- Language switcher UI -->
<LanguageSwitcher client:visible />
```

**Features**:
- **Automatic browser language detection**: Detects user's browser language on first visit
- **Translation caching**: Caches translated page content in localStorage
- **Zero flicker**: Inline script applies cached translation before DOM render
- **Smart API loading**: Skips Google Translate API entirely when cache exists
- **Cookie-based control**: Uses `googtrans` cookie instead of widget manipulation

**Supported Languages**:
Configure in `src/utils/languageTranslation/languages.ts`:
```typescript
export const supportedLanguages = [
  { name: 'English', code: 'en', flag: '🇺🇸' },
  { name: 'Español', code: 'es', flag: '🇪🇸' },
  { name: 'Français', code: 'fr', flag: '🇫🇷' },
  // Add more languages...
];
```

**How Translation Caching Works**:
1. User selects language → Cookie set → Page reloads
2. Google Translate API translates page → Clean HTML cached in localStorage
3. Next page load → Inline script injects cached translation instantly
4. Result: Instant translations with zero Google API calls on subsequent visits

### Dark Mode System

**Performance**: ~2KB, 0ms blocking time

Fully-featured dark mode with OS preference detection:
```typescript
import { useTheme } from '@/hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
```

**Features**:
- **Inline detection script**: Sets theme before page render (prevents flash)
- **OS preference detection**: Auto-detects `prefers-color-scheme` when no preference set
- **Dynamic meta tag**: Updates `<meta name="theme-color">` from CSS variables
- **Cross-tab sync**: Theme changes synchronized across all open tabs
- **CSS-first approach**: Uses `data-theme` attribute and `--color-*` variables

**Implementation**:
```astro
---
// src/layouts/BaseLayout.astro
---

<html data-theme="light">
  <head>
    <!-- Inline script prevents flash -->
    <script is:inline>
      (function() {
        const stored = localStorage.getItem('theme');
        const theme = stored || 
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
      })();
    </script>
  </head>
</html>
```

**CSS Configuration**:
```css
/* src/styles/global.css */
:root {
  --color-bg: #ffffff;
  --color-text: #000000;
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
}
```

### Accessibility Features

**Performance**: 0KB until activated, ~12KB when loaded

Comprehensive accessibility preferences with visual and interaction customization:
```astro
---
import AccessibilityButton from "@/components/preferences/accessibility/AccessibilityButton";
import "@/styles/accessibility.css";
---

<AccessibilityButton client:idle />
```

**Available Features**:

**Text Adjustments**:
- Font size (80% - 140%)
- Line height (1.3 - 2.0)
- Letter spacing (0 - 0.3em)
- Word spacing (0 - 0.5em)
- Text alignment
- Font weight

**Visual Enhancements**:
- Link highlighting
- Title highlighting  
- High contrast mode
- Saturation adjustment
- Big cursor
- Focus indicators
- Reading guide
- Reading mask

**Content Control**:
- Hide images
- Mute sounds
- Reduced motion

**Usage in React**:
```typescript
import { useAccessibility } from '@/hooks/useAccessibility';

function AccessibilityPanel() {
  const { preferences, setPreferences, resetPreferences } = useAccessibility();
  
  return (
    <div>
      <input
        type="range"
        min="80"
        max="140"
        value={preferences.text.fontSize}
        onChange={(e) => setPreferences({
          ...preferences,
          text: { ...preferences.text, fontSize: Number(e.target.value) }
        })}
      />
      <button onClick={resetPreferences}>Reset All</button>
    </div>
  );
}
```

**Persistence**: All preferences stored in `user-a11y-prefs` localStorage key and automatically applied on every page load.

## Performance Optimizations

Greastro is architected for **maximum performance** with minimal JavaScript:

### Inline Detection Scripts

Critical user preferences detected before DOM render using inline `<script is:inline>`:
```astro
<script is:inline>
  // Runs before DOM parsing - zero delay
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  })();
</script>
```

**Why This Matters**:
- **Prevents visual flicker**: Theme/language applied before user sees content
- **Zero blocking time**: Inline scripts don't require network requests
- **Progressive enhancement**: Page renders correctly even if JavaScript disabled

### Lazy Loading Strategy

All interactive features use Astro's hydration directives:
```astro
<!-- Load when visible -->
<Component client:visible />

<!-- Load when browser idle -->
<Component client:idle />

<!-- Load only in browser (skip SSR) -->
<Component client:only="react" />
```

**Component Loading Priorities**:
- **Critical UI**: `client:load` (navigation, essential interactions)
- **Above fold**: `client:visible` (hero components, language switcher)
- **Below fold**: `client:idle` (cookie banner, accessibility features)
- **Modals**: Lazy imports with `React.lazy()` + `Suspense`

### Zero-Load Pattern

Features that 99% of users never use should load 0KB:
```typescript
// Cookie consent example
useEffect(() => {
  // Inline check - no React needed
  if (document.cookie.includes('cookie-consent=')) return;
  
  // Only if no cookie, load banner
  setTimeout(() => setShowBanner(true), 1000);
}, []);
```

**Benefits**:
- Cookie consent: 0KB for returning users
- Google Translate: 0KB when using cached translations  
- Accessibility: 0KB until user opens settings

### Storage Utilities

Shared localStorage utilities with built-in cross-tab synchronization:
```typescript
// src/utils/storage.ts
import { getStorageItem, setStorageItem, clearStorageByPrefix } from '@/utils/storage';

// Get item (with SSR safety)
const theme = getStorageItem('theme');

// Set item
setStorageItem('theme', 'dark');

// Clear by prefix
clearStorageByPrefix('translated_body_');

// In React hooks
const [value, setValue] = useLocalStorage('key', defaultValue, {
  raw: false,        // JSON encode/decode
  syncTabs: true,    // Sync across tabs
  validate: (v) => isValid(v) // Validate before saving
});
```

**Cross-Tab Synchronization**:
```typescript
// Automatically syncs across tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    // Update UI in all tabs
  }
});
```

### Production Build Optimizations
```bash
# Build with maximum optimization
npm run build

# Result (typical):
# - HTML pages: 100-500KB (includes content)
# - JavaScript bundles: 50-150KB total (code split)
# - CSS: 20-40KB (Tailwind purged)
# - Images: Optimized by Astro
```

**Build Features**:
- **Automatic code splitting**: Each page gets minimal JavaScript
- **CSS purging**: Tailwind removes unused classes
- **Image optimization**: WebP/AVIF with responsive sizes
- **Prerendering**: All pages generated at build time
- **Asset hashing**: Cache-busting for deployments

## Scripts
```bash
# Development
npm run dev                    # Start dev server
npx astro dev --host          # Start dev server (accessible on network)

# Production
npm run build                  # Build for production
npm run preview                # Preview production build

# Maintenance  
# Clear all caches
rm -rf .astro node_modules/.astro dist 
git rm -r --cached .
npx astro sync                
# Regenerate TypeScript types

# Utilities
npm run log-redirects          # Show all configured redirects

# git specific
rm -rf .git
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ support required
- No IE11 support

## Performance

Greastro sites are highly optimized:
- **Static generation**: All pages built at compile time
- **Minimal JavaScript**: Only interactive components ship JS
- **Image optimization**: Automatic image optimization with Astro
- **Code splitting**: Automatic per-page code splitting
- **CSS scoping**: Scoped styles prevent bloat
- **Zero-load features**: Cookie consent, translations, a11y load 0KB until used

Typical Lighthouse scores:
- Performance: 95-100
- Accessibility: 90-100
- Best Practices: 95-100
- SEO: 90-100

## Troubleshooting

### Types are out of sync
```bash
npx astro sync
```

### Build cache issues
```bash
rm -rf .astro node_modules/.astro dist
npm install

npm run build
```

### Query returns no results
- Check collection name spelling
- Verify `hasPage` settings in `_meta.mdx`
- Ensure items have frontmatter
- Clear cache and rebuild

### Menu items not appearing
- Check `addToMenu` configuration
- Verify menu reference: `menu: "main-menu"`
- Ensure parent items exist
- Check console for loader warnings

### Dark mode flashing
- Verify inline script is in `<head>` before any content
- Check that script uses `is:inline` directive
- Ensure no SSR/CSR mismatches with hydration

### Translation not working
- Clear localStorage: `localStorage.clear()`
- Check browser console for Google Translate errors
- Verify language is in `supportedLanguages` array
- Ensure `googtrans` cookie is being set

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Built with:
- [Astro](https://astro.build) - Static site framework
- [React](https://react.dev) - Component interactivity
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Zod](https://zod.dev) - Schema validation
- [React Icons](https://react-icons.github.io/react-icons/) - Icon system

## Support

- 📧 Email: [support@griffinswebservices.com](mailto:support@griffinswebservices.com)
- 🐛 Issues: [GitHub Issues](https://github.com/griffinswebservices/greastro/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/griffinswebservices/greastro/discussions)

---

## What is Astro?

Astro is a web framework for building **content-driven websites** like blogs, marketing, and e-commerce. Greastro extends Astro with enterprise features for complex content management needs.

### Learn More About Astro

- 📚 [Documentation](https://docs.astro.build)
- 💬 [Discord Community](https://astro.build/chat)
- 🎓 [Tutorial](https://docs.astro.build/en/tutorial/0-introduction/)
- 🚀 [Integrations](https://astro.build/integrations/)

---

**Made with ❤️ by [Griffin's Web Services](https://griffinswebservices.com)**
