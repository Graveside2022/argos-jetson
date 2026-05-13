# Checkbox — Accessibility

**Status:** Phase 3 PR3c — implementation in flight
**Last updated:** 2026-04-29
**Carbon mirror:** `docs/carbon-website/src/pages/components/Checkbox/accessibility.mdx`

---

## What Carbon provides for free

Per Carbon Checkbox accessibility patterns (Checkbox.svelte source confirms):

### Semantic structure

- Renders a real `<input type="checkbox" id={id}>` paired with `<label for={id}>`. Native checkbox semantics are preserved — assistive tech announces "checkbox, [labelText], [checked|not checked|mixed]".
- The visual checkmark / indeterminate dash is CSS-only (`::before` + `::after` pseudo-elements). The native input is visually hidden via `position: absolute; opacity: 0` but remains in the tab order.
- `id` defaults to `ccs-${random}` so consumers cannot accidentally produce duplicate `id`s.

### ARIA wiring (verified in Carbon source)

- **`aria-checked`** is **not explicitly set** on the `<input>` — native checkbox state is authoritative. When `indeterminate=true`, Carbon sets the DOM property `input.indeterminate = true` and AT announces "mixed" without a separate `aria-checked` attribute.
- **`aria-invalid`** is NOT set on individual `<Checkbox>` — Carbon's per-checkbox component does not expose invalid state (only `<CheckboxGroup>` does, at the legend level). For single-checkbox validation surfaces, render an external error region with `aria-describedby` linkage at the form level.
- **`aria-describedby`** points to `helper-${id}` / `error-${id}` depending on state — same pattern as TextInput. AT announces the linked message after the field name + state.
- **`required`** sets the HTML attribute; AT auto-announces "required".
- **`disabled`** — HTML attribute; AT auto-announces "disabled" + browser removes from tab order.
- **`readonly`** — Carbon exposes the prop but the underlying `<input type="checkbox">` does not natively support `readonly` (browser ignores it on checkboxes). Carbon emulates with `pointer-events: none` + `aria-readonly="true"` and adds the `bx--checkbox-wrapper--readonly` class. None of the PR3c sites use read-only.

### Keyboard interaction

- **Tab / Shift+Tab** — standard browser tab order. No custom trap.
- **Space** — toggles the checkbox (native behavior).
- **Enter** — does NOT toggle (native checkbox behavior); submits enclosing form if any.
- **Focus visible** — Carbon's `focus-outline('outline')` mixin renders 2 px outline outside the 16 px square. Lunaris maps `$focus` → `var(--accent)` (theme overlay).

### Color contrast (Carbon's audit floor)

Carbon's stock theme passes WCAG 2.1 AA. Lunaris token overrides MUST preserve those ratios.

| Pair                                          | Min contrast (AA) | Lunaris target                                          | Status                                                               |
| --------------------------------------------- | ----------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Border (`$icon-primary`) on `--bg-2`          | 3:1 (graphical)   | `var(--ink-2)` (oklch 88%) on `var(--bg-2)` (oklch 17%) | ≈ 11.4:1 ✓                                                           |
| Checked fill (`$icon-primary`) on `--bg-2`    | 3:1 (graphical)   | `var(--ink)` on `var(--bg-2)`                           | ≈ 14.6:1 ✓                                                           |
| Checkmark (`$icon-on-color`) on filled square | 3:1 (graphical)   | `var(--bg)` on `var(--ink)`                             | ≈ 14.6:1 ✓ (subtractive — same as inverse)                           |
| Label text on page background                 | 4.5:1             | `var(--ink-2)` on `var(--bg)` / `var(--bg-2)`           | ≈ 13.0:1 ✓                                                           |
| Disabled border / fill                        | 3:1 (graphical)   | `var(--ink-5)` (oklch 32%) on `var(--bg-2)`             | ≈ 1.7:1 ⚠ — **expected for disabled, AT auto-announces "disabled"** |
| Focus outline (`$focus`) on any background    | 3:1 (graphical)   | `var(--accent)` ≈ 7.4:1 vs `--bg` and `--bg-2`          | ✓                                                                    |

**No amber flags.** Disabled contrast is intentionally low per WCAG-conformant pattern (disabled is non-interactive; AT announces state, contrast is not load-bearing). All PR3c sites pass.

---

## Argos-specific a11y considerations

### Tap target compliance (WCAG 2.2 SC 2.5.8)

The 16 × 16 px Carbon checkbox alone is **below** the 24 × 24 px AA threshold. Compliance is achieved by the surrounding `<label>` element which Carbon renders as part of the checkbox component:

| Surface                    | Square | Label height       | Effective tap target         | WCAG 2.5.8 (24 px) |
| -------------------------- | ------ | ------------------ | ---------------------------- | ------------------ |
| ReportsView mission modal  | 16 px  | ≈ 20 px            | full label row, ~250 × 24 px | ✓ pass             |
| BluetoothPanel `.opt` chip | 16 px  | ≈ 24 px (chip pad) | full chip, ~80 × 28 px       | ✓ pass             |

Click anywhere in the rendered `<label>` toggles the checkbox — Carbon's label is correctly associated via `for={id}` so the entire label area is clickable. The `.opt` chip skin extends this further to the chip's full bordered area.

WCAG 2.1 SC 2.5.5 (44 × 44 px AAA) is **not** satisfied at any density. Documented as an Argos-wide deviation from AAA in Phase 7 audit.

### Label requirement enforcement

Bespoke Argos checkboxes used the wrap-input-in-label pattern (`<label><input ...> TEXT</label>`). Carbon's `<Checkbox>` requires `labelText` and renders its own `<label>`. Wrapping a Carbon `<Checkbox>` inside another `<label>` causes nested-label semantics — screen readers announce "checkbox" twice or report a parse error.

**Migration rule (PR3c)**: REMOVE the parent `<label class="...">` wrapper. Pass the visible text via Carbon's `labelText`. Pass the tooltip via Carbon's `title`. The wrapping element becomes the parent flex/grid container or is dropped entirely.

For the `.opt` chip on BluetoothPanel, the migration drops the parent `<label class="opt">` and passes `class="opt"` through Carbon's wrapper div. The chip styling needs to be re-rooted on `.bx--checkbox-wrapper.opt` rather than on a `<label>`.

### `aria-label` deprecation in PR3c migrations

Pre-migration BluetoothPanel sites used both:

- `aria-label="All BLE channels (96 ch wideband)"` (richer description for AT)
- visible text "ALL CH" (compact tactical UPPER label)

Carbon's `<Checkbox>` exposes only `labelText` for the visible label. The richer description has two paths:

1. **`title` prop** — surfaces as native HTML tooltip. AT may or may not announce per browser. Acceptable for non-load-bearing extra context.
2. **`labelText` change + visible-label override** — set `labelText="All BLE channels (96 ch wideband)"`, `hideLabel=true`, render the visible "ALL CH" text via the `.opt` chip's pseudo-elements. More work, more correct.

PR3c chooses path 1 for simplicity; Phase 7 audit re-evaluates whether the richer description is load-bearing for AT users.

### Indeterminate state announcement

When `indeterminate=true`, Carbon sets `input.indeterminate = true` (DOM property, not attribute). AT announces "mixed". On user click, the browser clears `indeterminate` and toggles `checked`. None of the PR3c sites use indeterminate; pattern documented for future.

The future "Select-all / deselect-all" pattern (e.g. on a DataTable's row-selection column) requires a parent checkbox that goes indeterminate when 0 < selected_count < total — this is the canonical use case. Phase 3d / e if first such surface lands.

---

## Verification checklist (PR3c)

| Check                                 | Tool                                  | Pass criterion                                                                        |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| WCAG 2.1 AA on canary route           | `@axe-core/playwright` (`AxeBuilder`) | `violations: []` with `wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice` tags        |
| Label association                     | Playwright `<input>` aria audit       | All checkboxes have linked `<label for>` (Carbon's default)                           |
| Tab order                             | Playwright keyboard nav               | Tab moves focus through ReportsView form fields including SET ACTIVE in correct order |
| Space toggles state                   | Playwright keyboard test              | `await page.keyboard.press('Space')` toggles `checked`                                |
| Focus ring visible                    | manual + Playwright `:focus` check    | 2 px outline visible at all densities + accents                                       |
| Color contrast (border, focus, error) | chrome-devtools MCP + axe             | Border ≥ 3:1, Focus ≥ 3:1, Error border ≥ 3:1                                         |
| BluetoothPanel `.opt` chip pixel diff | chrome-devtools MCP screenshot diff   | Pre/post migration pixel-identical or within font-rendering ε                         |
| Click anywhere on label toggles       | Playwright click on label-text        | Toggling label area changes `checked` (label `for` association working)               |

Phase 7 includes the full WCAG 2.1 AA audit for all migrated form fields including all 5 PR3c checkboxes.

---

## Authority citations

- Carbon Checkbox a11y mdx: `docs/carbon-website/src/pages/components/Checkbox/accessibility.mdx`
- Carbon Checkbox SCSS: `docs/carbon-design-system/packages/styles/scss/components/checkbox/_checkbox.scss`
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/Checkbox/Checkbox.svelte`
- WCAG 2.1: <https://www.w3.org/TR/WCAG21/>
- WCAG 2.2 SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- ARIA Authoring Practices for checkbox: <https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/>
- axe-core rule reference: <https://dequeuniversity.com/rules/axe/4.9/>
- WHATWG checkbox `indeterminate` IDL property: <https://html.spec.whatwg.org/multipage/input.html#dom-input-indeterminate>
