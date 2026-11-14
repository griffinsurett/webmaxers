# GWS Style Guide

This document defines the visual rules for Griffin Web Services sites in this repo.

It is intentionally opinionated. The goal is a site that feels clear, premium, restrained, and durable, not loud, over-decorated, or dependent on constant accent color.

## Core Principles

1. Use restraint before emphasis.
2. Build hierarchy with spacing, scale, contrast, and layout first.
3. Use color to support meaning, not to compensate for weak structure.
4. Keep the interface mostly neutral and let a few moments carry the brand signal.
5. Prefer consistency over one-off visual decisions.

## Visual Character

- The site should feel dark, grounded, and sharp.
- Most surfaces should read as neutral, not tinted blue.
- Borders should be subtle and supportive, not attention-seeking.
- Accent color should feel intentional because it is limited.
- If everything is highlighted, nothing is highlighted.

## Color System

### Accent

`--color-accent` is the true accent color.

Use it sparingly for:

- key emphasis words or short highlighted phrases
- important interactive states
- select icons or badges
- animated border moments
- focused calls to action
- data points or status moments that genuinely need emphasis

Do not use accent color:

- as the default border color across the site
- on large numbers of cards at once
- as the background for too many surfaces
- as decoration with no semantic or visual purpose
- to solve contrast or hierarchy problems that should be solved structurally

### Primary

`--color-primary` is a theme-driven working color, not permission to flood the UI with accent.

Current behavior:

- in dark theme, `primary` tracks the accent color
- in light theme, `primary` becomes a neutral dark tone

Because of that:

- treat `accent` as the brand highlight
- treat `primary` as the system-facing implementation token
- never assume `primary` means "make this bright"

## Border System

Static borders should be neutral by default.

Use these shared border tokens:

- `--color-border`
- `--color-border-strong`

Use these shared utilities:

- `faded-border`
- `border-soft`
- `border-soft-strong`
- `card-bg`
- `card-bg-2`
- `form-field`
- `rounded-border`

Rules:

- static borders should use the neutral border system
- do not use accent/primary borders for standard card shells
- do not introduce one-off `border-accent/*` or `border-primary/*` classes for normal surfaces
- stronger neutral borders are allowed when a component needs a bit more definition
- animated borders are a separate treatment and can remain branded when intentionally used

## Surface Styling

Default surfaces should rely on:

- neutral backgrounds
- low-contrast borders
- subtle depth
- restrained overlays

Preferred approach:

- use `card-bg` for standard card surfaces
- use `card-bg-2` for alternate neutral surfaces
- use `faded-bg` for soft circular/icon wrappers and low-emphasis UI treatment

Avoid:

- stacking bright accent fills and accent borders together
- turning every badge, icon, chip, and card into a brand-color moment
- using tinted surfaces where a neutral surface would work

## Typography And Hierarchy

Hierarchy should come from:

- type scale
- weight
- spacing
- grouping
- alignment
- contrast

Accent color is not the main hierarchy tool.

Before adding color emphasis, ask:

1. Would this already read correctly in grayscale?
2. Does spacing and size already communicate importance?
3. Is the accent adding clarity or only decoration?

If the answer to the third question is decoration, remove it.

## Buttons And Interactive Elements

Primary CTA usage should be selective.

- one primary action per section is usually enough
- secondary actions should remain quieter
- hover/focus states can use accent more than resting states
- interaction can carry more color than static layout

This means:

- resting UI should stay calm
- emphasis should increase on hover, focus, active, or animated moments
- strong accent treatments should cluster around actual actions, not passive content

## Icons, Badges, And Pills

Use accent on small elements carefully.

Good uses:

- one icon inside a neutral card
- one small pill introducing a section
- a controlled stat badge
- a single highlighted proof point

Bad uses:

- a row of equally bright icons
- accent borders plus accent text plus accent background on the same small element unless it is a deliberate CTA
- repeating accent pills throughout a section with no clear priority

## Animation And Decorative Treatment

Motion can carry emphasis that static color should not.

Rules:

- animated border treatments may use brand color when they are intentionally calling attention
- static resting state should stay more neutral
- do not convert every decorative effect into a permanent accent-colored object

In practice:

- keep `progress-b-f` and other animated border moments intentional
- keep the resting shells neutral

## When To Use Stronger Color

Use stronger brand color only when one of these is true:

- it is the main CTA
- it communicates state change or interaction
- it marks a critical highlighted phrase
- it is a deliberate hero moment
- it supports a small number of high-priority visual anchors on the page

If a section already has one or two of those anchors, add no more unless there is a clear reason.

## Anti-Patterns

Avoid these:

- blue borders on every card
- accent-colored outlines on passive containers
- multiple competing accent areas in the same viewport
- large blocks of accent background without strong purpose
- using accent to make a weak layout feel more designed
- one-off color values that bypass the shared token system

## Implementation Rules

When styling or refactoring:

1. Start with shared tokens and shared utilities.
2. Reuse existing utilities before inventing new ones.
3. If a visual rule should apply in many places, define it once.
4. If you need a new border or surface treatment, add it at the utility/token level.
5. Avoid inline arbitrary color values when a system token should own the decision.

## Current Source Of Truth

The main styling source of truth for these rules lives in:

- `src/styles/global.css`
- `src/integrations/preferences/shared/styles/preferences.css`

The border system specifically should continue to flow from the shared border tokens and border utilities there.

## Simple Rule Of Thumb

If you are unsure:

- choose the more neutral border
- choose the quieter surface
- reduce accent usage by half
- keep one strong highlight instead of several medium ones

That bias will usually move the design in the right direction.
