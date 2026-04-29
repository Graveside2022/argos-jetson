# Select — Usage

**Status:** Phase 3 prep (drafted during Phase 2 PR review)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/Select.svelte`
**Carbon component:** `<Select>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Single-choice from a small-to-medium list (3-15 options) where the user's choice persists after selection. Examples in Argos: tactical theme accent picker (13-color MIL-STD palette), HackRF gain mode (LNA / VGA preset), TAK protocol (TLS/SSL/Plain), report format (PDF/JSON/CoT), GPS source selector (GPSD/USB/manual override), mission template picker.

## When NOT to use

- **Single binary toggle** → use `<Toggle>` or `<Checkbox>`.
- **2-3 mutually exclusive options** with comparison value → use `<RadioButtonGroup>` (sibling visibility wins).
- **Long lists (>15 options)** with search → use `<Dropdown filterable>` or `<ComboBox>`.
- **Multi-select** → use `<MultiSelect>`.
- **Numeric step picker** → use `<NumberInput>`.

## Argos surface inventory (provisional)

Bespoke `<select>` sites that Phase 3 retires:

| Surface             | File                                                                              | Current pattern                                  |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Theme accent picker | `src/lib/components/mk2/Tweaks.svelte`                                            | bespoke `<select>` over 13 oklch palette options |
| HackRF gain mode    | `src/lib/components/dashboard/panels/rf-propagation/RFPropagationControls.svelte` | bespoke `<select>` (preset / manual)             |
| TAK protocol        | `src/lib/components/dashboard/tak/*`                                              | bespoke `<select>` (TLS/SSL/Plain)               |
| Report format       | `src/lib/components/dashboard/views/ReportsView.svelte`                           | bespoke `<select>` (PDF/JSON/CoT)                |
| Density picker      | `src/lib/components/mk2/Tweaks.svelte`                                            | bespoke `<select>` (compact/default/comfy)       |
| GPS source          | `src/lib/components/dashboard/panels/SessionSelector.svelte`                      | bespoke `<select>`                               |

Total bespoke select call sites: ~8-12. Migration order: Tweaks (Phase 2 pattern, theme/density already there) → RF controls → TAK → reports.

## Anatomy (per Carbon source)

From `_select.scss`:

1. **`<label>`** above the field — short, sentence case.
2. **`.bx--select-input__wrapper`** — flex container that holds the `<select>` + chevron icon.
3. **`<select>` (`.bx--select-input`)** — native element styled with `appearance: none`; Carbon paints the chevron via `::after` pseudo-element on the wrapper.
4. **Helper text / invalid text** below — same pattern as `<TextInput>`.
5. **Sizes** match text-input: xs (24px) / sm (32px) / **md (40px default)** / lg (48px).

The native `<select>` is preserved for keyboard a11y (arrow keys cycle options, type-ahead works for free) and form-data submission.

## States to handle

- **Empty (no selection)**: render with the prompt option (e.g. `<option value="">Choose…</option>`) preselected and disabled.
- **Default (selected option)**: standard editable state.
- **Open** (popped): browser-native dropdown panel; Carbon doesn't override.
- **Disabled**: `disabled={true}` — Carbon greys field + chevron.
- **Invalid**: `invalid={true}` + `invalidText="..."` — red bottom border + icon.
- **Focus**: 2px `var(--accent)` outline.
- **Read-only**: rare; use `<Tag>` to surface single-value state inline.

## Inline variant

Carbon ships `<Select inline={true}>` which renders the label inline with the field instead of stacked. Use for tightly-packed control bars (e.g., the Tweaks settings flyout) where vertical space is scarce.

## Out of scope for Phase 3

- `aiLabel` — not used in current Argos surfaces.
- Native `<optgroup>` styling — Carbon doesn't customize, browser default is acceptable.
- Custom option rendering — would require `<Dropdown>` (different API, deferred).

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-select--default>
- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/select/_select.scss` (last modified 2023+)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/select/usage.mdx`
- Argos bespoke surfaces: see "Surface inventory" table above (~8-12 call sites)
