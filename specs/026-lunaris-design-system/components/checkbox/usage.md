# Checkbox — Usage

**Status:** Phase 3 prep (drafted during Phase 2 PR review)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/Checkbox.svelte`
**Carbon component:** `<Checkbox>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Binary on/off state per option, where multiple options may be selected at once. Examples in Argos: tactical filter toggles ("show only secured APs", "include hidden SSIDs"), TAK SA broadcaster opt-in flags, hardware capability gates ("enable HackRF wide-sweep mode"), report generation options ("include full sweep data", "include redacted entries").

## When NOT to use

- **Single binary that auto-applies on toggle without confirm** → use Carbon's `<Toggle>` (separate spec, deferred to Phase 4 if needed).
- **Mutually exclusive choices among 2+ options** → use `<RadioButton>` (separate spec).
- **Action that triggers a transient effect** (e.g., "send test packet") → use `<Button>` (Phase 1, already shipped).

## Carbon vs bespoke distinction

Per Carbon `checkbox/usage.mdx`:

- **Default checkbox** — independent binary state.
- **Indeterminate checkbox** — used for "select all" parents that have mixed children selection state. Carbon ships this as `indeterminate={true}` prop; not currently used in any Argos surface (no batch-select tables yet).
- **Disabled checkbox** — visually-distinct, non-interactive. Used when an option is gated by hardware/license state.

## Argos surface inventory (provisional)

Bespoke checkbox sites that Phase 3 retires by migrating to `<Checkbox>`:

| Surface                            | File                                                                           | Current pattern                                          |
| ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| TAK config flags                   | `src/lib/components/dashboard/tak/TakDataPackage.svelte`                       | bespoke `<input type="checkbox">` with hand-rolled label |
| Filter bar (signal type filters)   | `src/lib/components/dashboard/panels/FilterBar.svelte`                         | multiple bespoke checkboxes                              |
| Reports view (per-section toggles) | `src/lib/components/dashboard/views/ReportsView.svelte`                        | bespoke checkbox per report section                      |
| RF propagation modes               | `src/lib/components/dashboard/panels/rf-propagation/RFAdvancedControls.svelte` | bespoke checkbox for terrain/refraction modes            |
| Settings (Tweaks) toggles          | `src/lib/components/mk2/Tweaks.svelte`                                         | bespoke checkbox per dev-mode flag                       |

Total bespoke checkbox call sites: ~10-15. Migration order: low-traffic Tweaks first → reports → filter bar → TAK forms.

## Anatomy (per Carbon source)

From `_checkbox.scss`:

1. **Hidden native `<input type="checkbox">`** (visually-hidden but kept for a11y + form data + native validation).
2. **`.bx--checkbox-label`** — clickable styled label that renders the custom box via `::before` pseudo-element.
3. **`.bx--checkbox-label-text`** — the actual label string, inline-start padding of 10px.
4. **Min tap target** — `min-block-size: 20px`.
5. **Form-item wrapper** with 6px spacing between consecutive checkboxes; first-of-type has zero top margin; label-followed-by-checkbox shifts up by `$spacing-01` (2px).

## States to handle

- **Empty (unchecked)**: default render, no fill.
- **Checked**: `var(--accent)` fill + white check glyph.
- **Indeterminate**: `var(--accent)` fill + dash glyph (not currently consumed in Argos).
- **Disabled**: `var(--ink-5)` muted fill, no hover.
- **Disabled + checked**: `var(--ink-4)` muted fill + check.
- **Focus**: 2px `var(--accent)` outline outside the box.
- **Invalid (form validation)**: 2px `var(--mk2-red)` border + red label text + error icon adjacent.
- **Read-only**: rare; use `<Tag>` to surface state instead.

## Spacing rhythm

Carbon's 6px between siblings + 2px shift after a label is denser than typical Bootstrap-style forms. Lunaris adopts unchanged because it matches the tactical-density aesthetic.

## Out of scope for Phase 3

- Indeterminate "select all" pattern in `<DataTable batchSelection>` — deferred until a screen actually needs it.
- Carbon's `<CheckboxSkeleton>` loading state — wrap with Argos's Dot status pattern instead.

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-checkbox--default>
- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/checkbox/_checkbox.scss` (last modified 2023+)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/checkbox/usage.mdx`
- Argos bespoke surfaces: see "Surface inventory" table above (~10-15 call sites)
