# Spec 026 — Authorities & Canonical-Pattern Matrix

This document is the **citation reference** for component conventions. When a Lunaris component spec (`components/<name>/style.md`) cites a rule, it links here. Every claim about "Carbon does X" or "the v2 mockup uses Y" lives here with verbatim source quotes + URLs + last-modified dates.

---

## Authorities (in order of precedence)

### 1. IBM Carbon Design System SOURCE CODE — primary authority

**Path on disk:** `/home/jetson2/code/Argos/docs/carbon-design-system/` (sparse-checkout)

**Sparse paths populated:**

- `packages/styles/scss/components/` — SCSS source-of-truth per component
- `packages/react/src/components/` — React component behavior (port reference)
- `packages/themes/` — color theme tokens (g10/g90/g100/white)
- `packages/web-components/src/components/` — Lit-based fallback components
- `docs/` — design tokens + tutorials

**Rule:** When source disagrees with site docs, **source wins**. Cite the file path + last-modified date as the authority.

**External GitHub URL:** <https://github.com/carbon-design-system/carbon>

### 2. IBM Carbon WEBSITE — usage / accessibility reference

**Path on disk:** `/home/jetson2/code/Argos/docs/carbon-website/` (full clone)

**Key paths:**

- `src/pages/components/<name>/usage.mdx` — when to use / variants / common patterns
- `src/pages/components/<name>/style.mdx` — visual specs
- `src/pages/components/<name>/code.mdx` — API
- `src/pages/components/<name>/accessibility.mdx` — WCAG patterns

**Rule:** Use mdx for context; never as a contradiction of source SCSS.

**External URL:** <https://carbondesignsystem.com>

### 3. Argos v2 mockup — visual layout reference

**Path on disk:** `/home/jetson2/code/Argos/docs/argos-v2-mockup/`

**Key paths:**

- `Argos.html` + `src/*.jsx` — component vocabulary (`Panel`, `Dot`, `Metric`, `Sparkline`, `KV`, `IconBtn`)
- `styles.css` — design token CSS (Lunaris's actual implementation)
- `screenshots/*.png` — visual ground-truth for what "Argos v2 looks like"

**Rule:** Visual identity comes from here. Where the v2 mockup diverges from Carbon visual conventions, the mockup wins on look-and-feel; Carbon wins on methodology/anatomy.

---

## Canonical-pattern matrix

### Data Table

| Rule                        | Carbon source                                                                                                                                                                        | v2 mockup                                                                                     | Lunaris adoption                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Header text-align (default) | `.cds--data-table th { /* no rule */ }` + `.cds--table-header-label { text-align: start; }` (`packages/styles/scss/components/data-table/_data-table.scss` last modified 2025-12-13) | `.tbl th { text-align: left; }` (`styles.css` line 570)                                       | **Left** (matches both)                              |
| Body td default             | `.cds--data-table td { text-align: start; vertical-align: middle; }`                                                                                                                 | `.tbl td { padding: 0 10px; height: var(--row-h); }` (no text-align override = inherits left) | **Left**                                             |
| Numeric body modifier       | `.cds--data-table td[align=right] { text-align: end; }`                                                                                                                              | `.tbl td.num { text-align: right; }` (line 592)                                               | **Right** via `data-kind='num'` attribute selector   |
| Center body modifier        | `.cds--data-table td[align=center] { text-align: center; }`                                                                                                                          | (not used in v2)                                                                              | Reserved for future tag/time kinds if user requests  |
| Action icon column          | follows Carbon overflow-menu pattern                                                                                                                                                 | `<td>` with `<IconBtn name="download"/>`                                                      | Right-aligned + fixed-width via `data-kind='action'` |
| Muted text                  | uses `$text-secondary` token                                                                                                                                                         | `.tbl td.dim { color: var(--ink-3); }` (line 593)                                             | Add `.dim` class modifier                            |
| Hover state                 | `.cds--data-table tr:hover td { ... }`                                                                                                                                               | `.tbl tr:hover td { background: var(--bg-2); }` (line 590)                                    | **Yes** — match Carbon                               |
| Sort indicator              | three-state icon (unsorted/up/down), only shown on hover or when active                                                                                                              | not specified; current Argos implementation has it                                            | Keep current; mirror Carbon's three-state semantics  |

**Lunaris-specific extensions** (no Carbon equivalent — preserved from `64fbb2af`):

- `Column<Row>.kind: 'id' | 'text' | 'num' | 'time' | 'tag' | 'action'` — semantic discriminant on the TS side. Maps to Carbon's column config when wrapping `<DataTable>`. Useful for future sort/filter/aggregate features.
- localStorage column-order persistence per tab
- Drag-to-reorder column headers (Carbon's `<DataTable>` doesn't ship this; resolve in Phase 1 spec)

### Other components

To be filled in as each component spec is authored. Each new `components/<name>/style.md` extends this matrix with its own row.

---

## Carbon → Lunaris token map

The actual mapping lives in `tokens.md` and grows per-component. Categories:

- **Color**: Carbon `$layer-*`, `$text-*`, `$border-*`, `$focus`, `$support-*` → Lunaris `var(--bg-*)`, `var(--ink-*)`, `var(--line-*)`, `var(--accent)`, `var(--green)`/`var(--amber)`/`var(--red)`
- **Typography**: Carbon `$body-font-family`, `$heading-font-family`, `$font-family-mono` → `"Geist"`, `"Geist"`, `"Geist Mono"`
- **Spacing**: Carbon `$spacing-01`...`$spacing-13` → Lunaris `--u: 4px` multiples
- **Layer/elevation**: Carbon's layer model (background/layer-01/layer-02/layer-03) → Lunaris's `--bg`/`--bg-2`/`--bg-3`/`--panel`/`--panel-hi`

---

## How to add a new authority claim

1. Find the rule in Carbon source (or v2 mockup). Cite file path + line number + last-modified date if available.
2. Add a row to the relevant component's matrix above (or create a new component matrix).
3. Reference the matrix from the component's `style.md`. Don't duplicate the citation.
4. If Carbon source and Carbon site docs disagree, note the divergence + the date you discovered it. Source wins. File a GitHub issue upstream if it's a documentation bug worth reporting.
