# Number Input — Usage

**Status:** Phase 3 prep (drafted post-PR #66 ahead of Phase 3 implementation)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/NumberInput.svelte`
**Carbon component:** `<NumberInput>` from `carbon-components-svelte` v0.107.0+

---

## When to use

Numeric capture with up/down stepper UI: frequency (MHz), gain (dB), threshold (dBm), poll interval (s), timeout (s), batch size, sweep step (Hz), packet count limit. The stepper buttons make incremental adjustments fast and constrain to a numeric type.

## When NOT to use

- **Free-form numeric strings** (e.g. callsigns that contain digits, IP addresses, MAC) → use `<TextInput>` with regex validation.
- **Continuous numeric range with visual** (e.g. volume, opacity 0-100%) → use `<Slider>` (deferred Phase).
- **Currency, scientific notation, or unit-aware** → use `<TextInput>` + custom render; Carbon's `<NumberInput>` handles plain integers/floats.
- **Required precision >2 decimal places** → fine with NumberInput but verify Carbon's float handling matches (test before relying on auto-step at 0.01 precision).

## Carbon vs bespoke distinction

Per Carbon `number-input/usage.mdx`:

- **Default** — full-width with label, helper, stepper buttons + native input.
- **`hideSteppers={true}`** — hides up/down buttons; useful when stepper would crowd a tight layout.
- **`size`** — xs / sm / md (default) / lg matches text-input sizing.
- **`min` / `max`** — clamps the value; stepper disables at limits.
- **`step`** — increment per stepper click (default 1; use 0.1 for sub-Hz tuning, 1000 for kHz, etc.).

## Argos surface inventory (provisional)

Bespoke numeric inputs Phase 3 retires:

| Surface             | File                                                                              | Current pattern                                  |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Frequency tuner     | `src/lib/components/screens/parts/FrequencyTuner.svelte`                          | bespoke `<input type="number">` + custom stepper |
| RF propagation step | `src/lib/components/dashboard/panels/rf-propagation/RFPropagationControls.svelte` | bespoke numeric inputs for step / freq / power   |
| Sweep params        | `src/lib/components/screens/parts/SpectrumControls.svelte`                        | bespoke numeric inputs for start/stop/bin Hz     |
| HackRF gain         | `src/lib/components/dashboard/panels/rf-propagation/RFAdvancedControls.svelte`    | bespoke gain input (dB)                          |
| Tweaks dev settings | `src/lib/components/mk2/Tweaks.svelte`                                            | bespoke poll-interval input                      |

Total bespoke number-input call sites: ~10-15. Migration order: Tweaks (low-traffic) → spectrum controls → RF controls → frequency tuner (highest visibility, defer until pattern proven).

## Anatomy (per Carbon source)

From `_number-input.scss`:

1. **`<label>`** above the field.
2. **`.bx--number__input-wrapper`** — relative-positioned container holding the native `<input type="number">` + stepper buttons.
3. **`.bx--number__controls`** — flex container with up/down `<button>` elements + chevron icons.
4. **Stepper buttons** — Carbon's icon-only buttons; clicking dispatches `change` with new value.
5. **Helper text / invalid text** below — same pattern as `<TextInput>`.
6. **Sizes match text-input**: xs (24px) / sm (32px) / **md (40px default)** / lg (48px).

The native `<input type="number">` is preserved for a11y + form data + native arrow-key handling.

## States to handle

- **Empty**: render with placeholder; consider `value={undefined}` vs `0` (Carbon defaults to `""` → `null`).
- **Default**: standard editable state with stepper buttons live.
- **Min reached**: down-stepper disabled.
- **Max reached**: up-stepper disabled.
- **Disabled**: whole field + steppers locked.
- **Invalid**: `invalid={true}` + `invalidText="..."` — common when value out of range or non-numeric.
- **Focus**: 2px `var(--accent)` outline.
- **Read-only**: render as plain `<Tag>` with the value + unit.

## Out of scope for Phase 3

- **`hideSteppers`** for inline numeric chips — common in dense control bars; use case-by-case.
- **Custom step semantics** (e.g. logarithmic frequency steps for sweep tuning) — Carbon's linear step won't fit; might need a custom numeric input wrapper that sits beside Carbon (or use `<TextInput>` with regex + custom buttons).
- **Unit-aware step** (auto-pick step based on magnitude — 1 Hz at < 1 kHz, 1 kHz at < 1 MHz, etc.) — defer; for now consumers pass explicit `step`.

## Authority citations

- Carbon Svelte component: <https://svelte.carbondesignsystem.com/?path=/docs/components-numberinput--default>
- Carbon source SCSS: `docs/carbon-design-system/packages/styles/scss/components/number-input/_number-input.scss`
- Carbon usage mdx: `docs/carbon-website/src/pages/components/number-input/usage.mdx`
- Argos bespoke surfaces: see "Surface inventory" table above (~10-15 call sites)
