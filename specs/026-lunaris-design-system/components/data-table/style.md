# Data Table — Style

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Authority precedence:** Carbon source SCSS > Carbon site mdx > v2 mockup CSS

---

## Canonical alignment matrix

Verbatim citations from Carbon source + v2 mockup. **Both authorities agree.**

| Element                   | Carbon source rule                                                                      | v2 mockup rule                                             | Lunaris adoption                   |
| ------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| `<th>` text-align         | (no explicit rule) → falls through to `.cds--table-header-label { text-align: start; }` | `.tbl th { text-align: left; }`                            | **Left** (matches both)            |
| `<td>` default text-align | `.cds--data-table td { text-align: start; vertical-align: middle; }`                    | `.tbl td { /* no text-align override = inherits left */ }` | **Left**                           |
| `<td>` numeric modifier   | `.cds--data-table td[align=right] { text-align: end; }`                                 | `.tbl td.num { text-align: right; }`                       | **Right** via `data-kind='num'`    |
| `<td>` action modifier    | (uses overflow-menu pattern, right-aligned)                                             | `<td>` containing `<IconBtn>`, no explicit rule            | **Right** via `data-kind='action'` |
| `<td>` center modifier    | `.cds--data-table td[align=center] { text-align: center; }`                             | (not used in v2)                                           | Reserved; not currently consumed   |
| `<td>` muted text         | `$text-secondary` token                                                                 | `.tbl td.dim { color: var(--ink-3); }`                     | `.dim` class modifier mirrors v2   |

**Citations:**

- Carbon: `docs/carbon-design-system/packages/styles/scss/components/data-table/_data-table.scss` (last modified 2025-12-13)
- v2 mockup: `docs/argos-v2-mockup/styles.css` lines 565-594

---

## Sizing

Carbon ships 5 row sizes: `xs` (24px), `sm` (32px), `md` (40px, default), `lg` (48px), `xl` (64px). Per Carbon `usage.mdx` (2025-04-30): "Extra large row heights are only recommended if your data is expected to have 2 lines of content in a single row."

**Lunaris uses Carbon `xs` row size (24px)** for drawer tabs to match v2 mockup density (`--row-h: 26px`, `docs/argos-v2-mockup/styles.css` line 50). Maps to Carbon `$spacing-06` (24px). User-switchable via `data-density` attribute on app root:

| Density   | Argos `--row-h` | Carbon row size          |
| --------- | --------------- | ------------------------ |
| `compact` | 22px            | xs (24px, closest match) |
| _default_ | 26px            | xs (24px)                |
| `comfy`   | 30px            | sm (32px, closest match) |

---

## Header style

Carbon: `.cds--data-table thead { @include type-style('heading-compact-01'); background-color: $layer-accent; }` — small font, accent-tinted background.

v2 mockup: `.tbl th { font: 500 10px/1 var(--f-mono); text-transform: uppercase; letter-spacing: 0.08em; }` — 10px monospace, UPPERCASE with letter-spacing.

**Lunaris adoption** (overrides Carbon header type-style for tactical aesthetic): retain v2 mockup's UPPERCASE + 0.08em letter-spacing + Geist Mono font for the heading layer. Background uses Lunaris `var(--bg-2)` mapped to Carbon `$layer-accent-01`.

---

## Color tokens

| Carbon token                                 | Lunaris value                                                      | Used by                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `$layer-accent-01` (header background)       | `var(--bg-2)`                                                      | `<th>` background                                                                                   |
| `$text-primary` (header text)                | `var(--ink-4)`                                                     | `<th>` color (note: ink-4 is muted, not full-strength ink, per Lunaris UPPERCASE-header convention) |
| `$text-secondary` (muted body)               | `var(--ink-3)`                                                     | `<td>.dim` color                                                                                    |
| `$border-subtle-01` (row divider)            | `var(--line)`                                                      | `<tr>` border-bottom                                                                                |
| `$layer-hover-01` (row hover)                | `var(--bg-2)`                                                      | `<tr>:hover td` background                                                                          |
| `$focus` (sort indicator + selection accent) | `var(--accent)` (default amber, user-switchable via `data-accent`) | sort indicator, selected row background mix                                                         |

---

## Hover, sort, selection states

Per Carbon `usage.mdx` (2025-04-30):

- **Hover**: "The data table's row hover state should always be enabled as it can help the user visually scan the columns of data in a row even if the row is not interactive." → Lunaris keeps row hover always on.
- **Sort**: three-state indicator (unsorted `arrows`, sorted-up `arrow--up`, sorted-down `arrow--down`). "Only the sorted column displays an icon, and unsorted icons are only visible on hover." Argos current bespoke uses ↑/↓ Unicode glyphs in `var(--accent)`; align with Carbon's sort-indicator behavior (hover-only for unsorted) in Phase 1 implementation.
- **Selection**: not currently used in Argos drawer tabs; reserved for future inventory screens. Carbon's `selected` row background uses `color-mix(in oklch, var(--accent) 10%, transparent)` per v2 mockup (`docs/argos-v2-mockup/styles.css` line 591).

---

## What Argos does NOT inherit from Carbon

These v11+ Carbon defaults are intentionally overridden:

- **Heading typography** — Carbon's `heading-compact-01` is replaced with Lunaris UPPERCASE-letter-spaced Geist Mono per tactical aesthetic.
- **Row size token name** — Argos uses CSS custom property `--row-h` driven by `data-density` attribute, not Carbon's `--cds-table-row-height-sm` directly. Theme overlay file maps `--cds-table-row-height-*` to `var(--row-h)`.
- **Zebra stripes** — Carbon's "Alternating row color" modifier is NOT used in Argos. Hover-only is sufficient for the dense tactical UI; zebra adds visual noise.

---

## Authority citations

- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/data-table/_data-table.scss` (last modified 2025-12-13)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/data-table/usage.mdx` (last modified 2025-04-30)
- Carbon style mdx: `docs/carbon-website/src/pages/components/data-table/style.mdx`
- v2 mockup CSS: `docs/argos-v2-mockup/styles.css` lines 565-594
- v2 mockup tables: `docs/argos-v2-mockup/src/drawer.jsx` (drawer-tab tables)
- v2 mockup screenshots: `docs/argos-v2-mockup/screenshots/04-dashboard-fullpage.png`
