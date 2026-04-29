# Radio Button — Usage

**Status:** Phase 3 prep (drafted post-PR #66 ahead of Phase 3 implementation)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/RadioButton.svelte` + `RadioButtonGroup.svelte`
**Carbon component:** `<RadioButton>` + `<RadioButtonGroup>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Mutually exclusive choices among a small set (2-5 options) where the user picks ONE. Examples in Argos: scan profile (passive / active / hybrid), report frequency (continuous / on-demand / scheduled), TAK transport priority (TLS / SSL / Plain), GPS source override (auto / GPSD / USB / manual coords), agent-mode preset (recon / tracker / silent).

## When NOT to use

- **Single binary** (yes/no, on/off) → use `<Toggle>` or `<Checkbox>`.
- **Multi-select** (one or more) → use `<Checkbox>` group.
- **Single choice from many (>5) options** → use `<Select>` or `<Dropdown>`.
- **Independent boolean flags** (each toggle separate) → use multiple `<Checkbox>` instances.

## Carbon vs bespoke distinction

Per Carbon `radio-button/usage.mdx`:

- **`<RadioButton>`** — single radio control with label, `value` prop.
- **`<RadioButtonGroup>`** — wrapper that groups radios, owns the selected `value`, dispatches `change` event. ALWAYS use the group, never bare `<RadioButton>` instances — group provides the keyboard nav semantics (arrows cycle, Tab moves out).
- **Layout**: horizontal (default) or `orientation="vertical"` for tighter stacks.
- **Label position**: right of dot (default) or `labelPosition="left"` for right-aligned label patterns.

## Argos surface inventory (provisional)

Bespoke radio sites that Phase 3 retires:

| Surface             | File                                                          | Current pattern                    |
| ------------------- | ------------------------------------------------------------- | ---------------------------------- |
| Scan profile picker | `src/lib/components/dashboard/panels/FilterBar.svelte`        | bespoke `<input type="radio">` × 3 |
| Report frequency    | `src/lib/components/dashboard/views/ReportsView.svelte`       | bespoke radios for cadence         |
| TAK transport       | `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte` | bespoke radios per protocol        |
| GPS source          | `src/lib/components/dashboard/panels/SessionSelector.svelte`  | bespoke radios for source override |

Total bespoke radio call sites: ~5-8. Migration order: GPS source first (lowest blast radius) → TAK → reports → filter bar.

## Anatomy (per Carbon source)

From `_radio-button.scss`:

1. **`<RadioButtonGroup>`** wraps a flex/grid of `<RadioButton>` instances + a label above.
2. **Hidden native `<input type="radio">`** (visually-hidden, kept for a11y + form data + native validation).
3. **`.bx--radio-button__label`** — clickable styled label rendering the custom dot.
4. **`.bx--radio-button__appearance`** — the styled circle (1px border, hollow when unselected, filled with smaller solid circle when selected).
5. **Group container** with `.bx--radio-button-group--vertical` modifier for stacked layout.

## States to handle

- **Empty (none selected)**: rare for radios — typical pattern is to default-select one. If truly no default, render with all unchecked; group has `value=""`.
- **Default (one selected)**: standard.
- **Disabled (whole group)**: pass `disabled={true}` to `<RadioButtonGroup>`; greys out all options.
- **Disabled (single option)**: pass `disabled={true}` to specific `<RadioButton>`.
- **Invalid**: pass `invalid={true}` + `invalidText="..."` to group; red border on dots + error text.
- **Read-only**: render as `<Tag>` showing the current value instead.

## Spacing

Carbon defaults: 24px horizontal between radios in a row, 8px vertical in a column. Lunaris keeps these — matches the tactical-density rhythm.

## Out of scope for Phase 3

- Radio in a complex form layout (e.g., conditional sub-fields per option) — use `{#if}` blocks externally.
- Radios within a `<DataTable>` row for row selection — use `<DataTable radio>` (Phase 2 reserved feature, not implemented).

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-radiobutton--default>
- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss` (last modified 2023+)
- Carbon usage mdx: `docs/carbon-website/src/pages/components/radio-button/usage.mdx`
- Argos bespoke surfaces: see "Surface inventory" table above (~5-8 call sites)
