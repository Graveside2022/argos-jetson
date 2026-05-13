# Data Table — Accessibility

**Status:** Phase 1 in progress
**Last updated:** 2026-04-28
**Carbon mirror:** `docs/carbon-website/src/pages/components/data-table/accessibility.mdx`

---

## What Carbon provides for free

Per Carbon `accessibility.mdx`: "Carbon bakes keyboard operation into its components, improving the experience of blind users and others who operate via the keyboard. Carbon incorporates many other accessibility considerations, some of which are described below."

Adopting `carbon-components-svelte`'s `<DataTable>` inherits all of these without per-screen implementation:

### Keyboard interaction

- **Tab order** — column headers reachable by `Tab`. Sort triggered by `Space` or `Enter`.
- **Interactive controls inside cells** — links, buttons, overflow menus stay in tab order; behave per their own component conventions.
- **Expandable rows** — operate "in the same manner as accordions" (Carbon citation, `accessibility.mdx`).
- **Sort indicator** — `aria-sort="ascending|descending|none"` on `<th>`.

### Screen-reader announcements

- **Sort state changes** — Carbon dispatches `aria-sort` updates which screen readers (NVDA, VoiceOver) announce as "ascending sort applied" / "descending sort applied".
- **Selected rows** — `aria-selected="true|false"` on `<tr>`.
- **Expanded rows** — `aria-expanded` on the row trigger.
- **Empty state** — semantic `<caption>` or visually-hidden text describes empty conditions.

### Color contrast

Carbon themes (g100 dark base + Lunaris overrides) maintain WCAG 2.1 AA contrast ratios for all text/background combinations. Lunaris token overrides MUST preserve this — verified during Phase 7 a11y audit. Specifically:

| Pair                                | Min contrast (AA) | Lunaris target                                                                                                                             |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Body text on row background         | 4.5:1             | `var(--ink)` on `var(--panel)` ≈ 11.2:1                                                                                                    |
| Muted body text on row background   | 4.5:1             | `var(--ink-3)` on `var(--panel)` ≈ 5.0:1                                                                                                   |
| Header text on header background    | 4.5:1             | `var(--ink-4)` on `var(--bg-2)` — verify in Phase 1 (ink-4 is intentionally muted; may not pass at full strength — flag for design review) |
| Sort indicator on header background | 3:1 (graphical)   | `var(--accent)` on `var(--bg-2)` ≈ 7.4:1 (amber default)                                                                                   |

### Focus indicators

Carbon `<DataTable>` uses a 2px focus ring in `$focus` token color. Lunaris maps `$focus` to `var(--accent)`. Focus visible on:

- Sortable column headers when keyboard-focused
- Row checkboxes (when selectable)
- Row expand-toggle (when expandable)
- Per-row overflow menu trigger (when present)

---

## Argos-specific a11y considerations

### Drag-reorder columns (Argos extension)

Carbon `<DataTable>` does NOT ship column-drag-reorder. Argos preserves this from bespoke `DrawerTable.svelte`. Required a11y additions:

- **Keyboard alternative**: column-reorder must be accessible via keyboard (e.g., `Alt+ArrowLeft / Alt+ArrowRight` while a header has focus). To be implemented in Phase 1.
- **Screen-reader announcement**: when a column is reordered, dispatch a polite live-region message ("Column [LABEL] moved to position [N]"). To be implemented.
- **Drag handle visibility**: drag affordance (e.g., grip icon or border) on header hover/focus to signal drag is possible.

### Custom cell renderers

The optional `cell` snippet allows consumers to inject custom content (colored RSSI, status dots, icon buttons). Each consumer is responsible for ensuring custom content meets a11y requirements:

- Color must NOT be the sole status indicator (always pair with text label or icon).
- Custom icon buttons MUST have `aria-label`.
- Hidden status text (e.g., colored MAC for "HIDDEN" SSID) MUST also include screen-reader text.

### High-information-density tradeoff

Argos tactical UI uses Carbon `xs` row height (24-26px) for max information density. This is at the lower bound of Carbon's recommended row sizes. Tradeoffs:

- **Tap target**: 24px is below the 44×44px minimum recommended by Apple HIG / WCAG 2.5.5. Justified for desktop-mouse + keyboard primary-input UI; not deployed on touch devices.
- **Visual scanning**: dense rows are harder for low-vision users. The dashboard's user-switchable density (`comfy` = 30px) provides accommodation; future a11y mode may force `comfy` density.

---

## Design recommendations from Carbon

Per Carbon `accessibility.mdx`:

1. **Don't use color alone** to convey status. Pair with text labels or icons.
2. **Provide table caption** — semantic `<caption>` element or visually-hidden description for screen readers.
3. **Logical column order** — tab/scan order should match data hierarchy (most-important first).
4. **Sortable headers ergonomics** — use `<button>` inside `<th>` for sort triggers (not `<th onclick>`) so screen readers + keyboard users get expected button semantics.

Argos current bespoke uses `<th onclick>` — Phase 1 implementation should swap to Carbon's `<DataTable sortable>` which handles this correctly.

---

## Verification (Phase 1 + Phase 7)

| Check                             | Tool                   | Pass criterion                                        |
| --------------------------------- | ---------------------- | ----------------------------------------------------- |
| Keyboard tab order                | manual + Playwright    | Tab through each column header, sort with Enter/Space |
| Screen-reader announcements       | NVDA + VoiceOver       | Sort state changes announced                          |
| Color contrast                    | `axe-core` integration | Zero WCAG 2.1 AA violations                           |
| Focus visible                     | manual + Playwright    | 2px ring visible on all interactive elements          |
| Drag-reorder keyboard alternative | manual                 | Alt+ArrowLeft/Right reorders columns                  |
| Live-region announcements         | NVDA + VoiceOver       | Column-reorder announced politely                     |

Phase 7 includes a full WCAG 2.1 AA audit using Carbon's `axe-core` integration.

---

## Authority citations

- Carbon a11y mdx: `docs/carbon-website/src/pages/components/data-table/accessibility.mdx`
- WCAG 2.1 AA spec: <https://www.w3.org/TR/WCAG21/>
- Carbon Accessibility Status (per-component WCAG conformance): <https://www.carbondesignsystem.com/components/data-table/accessibility/>
- Apple HIG tap target minimum: <https://developer.apple.com/design/human-interface-guidelines/buttons>
