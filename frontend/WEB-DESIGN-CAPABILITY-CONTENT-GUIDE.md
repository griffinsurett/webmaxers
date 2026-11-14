# Web Design Capability Content Guide

This guide is based on the current `griffinswebservices` implementation for the `web-design` capability page.

## How the page is built

The page has a 3-level content hierarchy inside the `capabilities` collection:

1. `web-design`
2. Children of `web-design`
3. Children of those children

In the current project:

- `web-design` is the parent capability page.
- Direct children of `web-design` become the large editorial topic sections.
- Children of those topic sections become the supporting cards shown underneath each topic section.

The renderer in `src/components/starter/ContentRenderer/variants/CapabilityTopicSectionsVariant.astro` is wired with `cardColumns={4}`, so each topic section is designed to support up to 4 child cards cleanly.

## Content structure to follow

### Level 1: Parent page

File example:

- `src/content/capabilities/web-design.mdx`

This file controls:

- page title
- hero heading
- hero description
- overall positioning of the capability
- the query that pulls in its child topics

This is the page-level message. It should explain the overall value of your web design capability, not the detailed subtopics.

### Level 2: Topic sections

Current examples:

- `src/content/capabilities/ux-design.mdx`
- `src/content/capabilities/ui-design.mdx`

Each direct child of `web-design` becomes:

- one large split layout section
- one heading/description block
- one featured image
- one supporting card grid below it

These should be your main subtopics for the page.

Good topic examples:

- user journeys
- interface systems
- brand-led visual language
- conversion-focused layouts

Each topic should answer:

- What part of web design are we handling?
- Why does it matter for the client?
- What outcome does it create?

### Level 3: Supporting cards under each topic

Current examples under `ui-design`:

- `visual-design`
- `design-systems`
- `brand-alignment`
- `interaction-patterns`

Current examples under `ux-design`:

- `ui-structure`
- `responsive-layouts`

These entries become the small cards under each topic section.

Each card should cover one focused supporting point, such as:

- hierarchy
- layouts
- design tokens
- reusable components
- interaction consistency
- positioning clarity

Important constraint:

- Each topic section can have up to 4 child cards.
- The current project already uses 4 under `ui-design`.
- Staying at 4 or fewer matches the existing layout and prevents the section from getting overcrowded.

## What to write at each level

### Parent `web-design` page

Write this page like a capability overview.

Focus on:

- your design philosophy
- how your design work helps businesses
- how branding gets translated into a stronger website system
- why your design work is custom, strategic, and reusable

Do not overload this page with too many tactical details. Those belong in the child topic sections and cards.

### Topic section entries

Write each topic like a major pillar of the web design service.

Each topic should have:

- a clear title
- a strong heading
- a short paragraph that explains the business value
- a featured image that visually supports the topic

Use these as the main buckets for the page.

### Supporting card entries

Write each card as one tight supporting idea.

Each card should:

- have a short title
- have a 1-2 sentence description
- stay specific
- support the parent topic without repeating it

These cards should feel like proof points or building blocks of the larger topic.

## Recommended writing framework

Use this order when planning the page:

1. Write the overall `web-design` positioning.
2. Choose 2-4 main topic sections under `web-design`.
3. For each topic section, add up to 4 supporting child cards.
4. Make sure every card sharpens the topic instead of overlapping with another card.

## Suggested structure for your web design page

### Parent page

- `web-design`

Possible message:

- We turn the branding and visual cues your business already has into a sharper, more consistent website system that looks modern, feels intentional, and supports conversions.

### Topic section ideas

- `ux-design`
- `ui-design`
- `messaging-positioning` if you want messaging to be part of the design story

You could also rename or expand the topics, but keep them broad enough to deserve a full section.

### Example supporting card breakdown

For `ux-design`, you could use up to 4 children:

- information hierarchy
- page goals
- responsive layouts
- calls to action

For `ui-design`, you could use up to 4 children:

- visual language
- reusable components
- design tokens
- interaction patterns

## Frontmatter pattern to follow

### Parent capability

```mdx
---
title: "Design"
description: "High-level description of the web design capability."
heading:
  before: "Modern"
  text: "Design"
  after: "driven by clear systems and intentional user experience."
order: 1
icon: "fa6-solid:wand-magic-sparkles"
---
```

### Topic section child

```mdx
---
title: "Interface Systems"
description: "Short paragraph explaining the topic."
heading: "Build a UI system that looks sharp and stays usable."
featuredImage:
  src: "../../assets/your-image.jpg"
  alt: "Describe the image clearly."
icon: "fa6-solid:palette"
parent: web-design
order: 2
---
```

### Supporting card child

```mdx
---
title: "Reusable Components"
description: "Shared sections, patterns, and component rules make the site easier to expand."
icon: "fa6-solid:layer-group"
parent: ui-design
order: 2
---
```

## Practical rules

- Keep `web-design` as the parent of the main topic sections.
- Keep the main topic sections broad and strategic.
- Keep the supporting cards narrow and specific.
- Give every topic section a `featuredImage`.
- Keep each topic’s supporting child list at 4 or fewer items.
- Use `order` to control display order.
- Use `parent` to place entries in the correct hierarchy.

## Simple checklist

- Does the parent page explain the overall design capability clearly?
- Does each child under `web-design` feel like a major service pillar?
- Does each topic have a strong image, heading, and business-focused description?
- Does each topic have no more than 4 supporting child cards?
- Does each supporting card add a distinct point instead of repeating another one?

## Relevant project files

- `src/content/capabilities/web-design.mdx`
- `src/content/capabilities/ux-design.mdx`
- `src/content/capabilities/ui-design.mdx`
- `src/content/capabilities/visual-design.mdx`
- `src/content/capabilities/design-systems.mdx`
- `src/content/capabilities/brand-alignment.mdx`
- `src/content/capabilities/interaction-patterns.mdx`
- `src/content/capabilities/ui-structure.mdx`
- `src/content/capabilities/responsive-layouts.mdx`
- `src/components/starter/ContentRenderer/variants/CapabilityTopicSectionsVariant.astro`
