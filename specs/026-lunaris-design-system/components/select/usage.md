# Select — Usage

**Status:** Phase 3f PR-A — wrapper + canary live
**Last updated:** 2026-04-29 (post-triage)
**Implementation file:** `src/lib/components/chassis/forms/Select.svelte`
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

## Argos surface inventory (post-triage 2026-04-29)

Triage classified 11 files / 18 native `<select>` sites into two cohorts. **Select cohort (9 files / 11 sites)** wraps in this `<Select>`. **Dropdown cohort (2 files / 7 sites)** wraps in `<Dropdown>` (PR-C, separate spec).

### Select cohort (this spec)

| File | Site count | Options shape | Migration PR |
|------|------------|---------------|--------------|
| `src/lib/components/dashboard/panels/FilterBar.svelte:85` | 1 | 6 static primitives (any/kismet/bluedragon/gsm-evil/hackrf/rtl-sdr) | **PR-A canary** |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte:224` | 1 | 3 static, `disabled` gated | PR-B |
| `src/lib/components/dashboard/panels/rf-propagation/RFPropagationControls.svelte:36` | 1 | 2 static (polarization) | PR-B |
| `src/lib/components/dashboard/views/ReportsView.svelte:302,576` | 2 | 3+2 static, first `disabled` gated | PR-B |
| `src/lib/components/dashboard/panels/SessionSelector.svelte:66` | 1 | dynamic ≤20 (session names) | PR-B |
| `src/routes/recon/cellular/trunk-recorder/PresetForm.svelte:160` | 1 | 2 static | PR-B |
| `src/lib/components/dashboard/map/DeviceOverlay.svelte:65` | 1 | 3 static | PR-B |
| `src/lib/components/chassis/MissionStrip.svelte:133` | 1 | dynamic ≤20 (mission names) | PR-B |
| `src/routes/recon/cellular/trunk-recorder/+page.svelte:167` | 1 | dynamic ≤20 (presets), `disabled` gated | PR-B |

**Total Select cohort: 9 files / 11 sites.**

### Dropdown cohort (separate `dropdown/` spec, PR-C)

| File | Sites | Why Dropdown not Select |
|------|-------|-------------------------|
| `src/lib/components/screens/parts/SpectrumControls.svelte` | 4 | Object-keyed `BIN_PRESETS` with `.hz/.label`; LNA_STEPS / VGA_STEPS dynamic gain grids |
| `src/lib/components/dashboard/panels/rf-propagation/RFAdvancedControls.svelte` | 3 | Object-keyed `CLUTTER_PROFILES` / `RELIABILITY_OPTIONS` / `PROPAGATION_MODELS` with `.id/.label`; user-search benefit (filterable) |

**Total Dropdown cohort: 2 files / 7 sites.**

### Decision rule applied

- ≤7 static + primitive → `<Select>` (preserves native a11y for free, lower risk).
- Object-keyed OR >20 dynamic OR user-search hint → `<Dropdown>` (combobox, accept the re-implemented focus management).

### Theme accent + density picker

`src/lib/components/mk2/Tweaks.svelte` was scoped out of triage — the accent + density pickers there were already replaced with bespoke radio-group + segmented-button controls in earlier Mk II work. No `<select>` to migrate.

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
