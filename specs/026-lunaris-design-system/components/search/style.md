# Search — Style

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Authority precedence:** Carbon source SCSS > Carbon site mdx > v2 mockup CSS

---

## Canonical anatomy citations

Carbon's `<Search>` SCSS lives at `docs/carbon-design-system/packages/styles/scss/components/search/_search.scss` (separate from `_text-input.scss`).

Key shape differences from `<TextInput>`:

- **Same filled background + bottom-only border** as TextInput (visual continuity inside Carbon).
- **Magnifier icon** rendered as a positioned `<svg>` inside the input wrapper, default 16px, `currentColor` so it inherits text token.
- **Clear button** — Carbon `<IconButton>` rendering `<Close>` icon, positioned at the right edge.
- **Sizes** (axis differs from TextInput): `sm` (32px) / `lg` (40px) / `xl` (48px, default). No `xs` token.

## Lunaris token map

Inherits TextInput's surface, focus, and text tokens. Search-specific:

| Carbon token / class    | Lunaris value                                                   | Notes                                                                |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Magnifier icon stroke   | `currentColor` → `var(--ink-3)` baseline, `var(--ink)` on focus | Decorative + functional; matches Argos tools-flyout existing palette |
| Clear button icon       | `var(--ink-3)` default, `var(--mk2-red)` on hover               | Destructive affordance; warm accent on hover for affordance hint     |
| Clear button focus ring | 2px `var(--accent)` outline                                     | Independent focus target; must NOT be skipped in tab order           |

## Sizing per surface

| Argos surface         | Density | Carbon size | `--row-h` analog                               |
| --------------------- | ------- | ----------- | ---------------------------------------------- |
| Tools flyout filter   | compact | `sm` (32px) | matches the flyout chrome row rhythm (28-32px) |
| Drawer-tab filter     | compact | `sm` (32px) | reserved — same rhythm                         |
| Settings panel filter | normal  | `lg` (40px) | matches form fields                            |

ToolsFlyoutHeader currently has a custom 4px-vertical / 10px-horizontal padding wrapper — we drop that and use Carbon's `sm` directly. Visual delta: roughly identical height (~30-32px before vs 32px Carbon).

## What Argos does NOT inherit from Carbon

- **Default placeholder "Search..."** — Argos uses surface-specific copy ("Search tools…", "Filter logs…"). Always set `placeholder` explicitly.
- **Default `autocomplete="off"`** — Carbon's default matches Argos requirement (no browser autofill on operational filters); no override needed.
- **Carbon's clear button label** ("Clear search input") — keep default unless Argos accessibility audit mandates surface-specific copy.

## ToolsFlyoutHeader migration: chrome to keep, chrome to drop

| Element                                | Disposition                                          |
| -------------------------------------- | ---------------------------------------------------- |
| Lucide `<Search>` prefix               | DROP — Carbon ships its own                          |
| `bind:this={searchInput}` + open-focus | REPLACE with `autofocus={open}` + Carbon's `ref`     |
| `:focus-within` border-color flip      | DROP — Carbon focus-outline handles it               |
| `.search` flexbox wrapper              | DROP — Carbon's `<Search>` is a self-contained block |
| ESC kbd-chip                           | KEEP — render adjacent to Carbon `<Search>`          |
| Close button (`<X>` after the chip)    | KEEP — separate close concern, not part of search    |

## Authority citations

- Carbon Search SCSS: `docs/carbon-design-system/packages/styles/scss/components/search/_search.scss`
- Carbon Search component: `node_modules/carbon-components-svelte/src/Search/Search.svelte`
- Lunaris token mapping: `specs/026-lunaris-design-system/tokens.md`
- ToolsFlyoutHeader (current bespoke): `src/lib/components/chassis/ToolsFlyoutHeader.svelte`
