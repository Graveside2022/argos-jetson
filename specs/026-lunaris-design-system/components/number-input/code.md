# Number Input — Code

**Status:** Phase 3 canary in progress (PR3e)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/NumberInput.svelte`
**Carbon component:** `<NumberInput>` from `carbon-components-svelte` v0.107.0+

---

## Argos `NumberInput` adapter API

```ts
interface Props {
	value?: number | null; // bindable via $bindable() — null = "no value", parses fine
	labelText: string; // required — Carbon a11y mandate
	helperText?: string;
	placeholder?: string;
	min?: number;
	max?: number;
	step?: number;
	stepStartValue?: number; // value to start stepping from when input is empty
	allowEmpty?: boolean; // false → empty becomes invalid; true → empty is valid
	allowDecimal?: boolean; // true → type="text" + inputmode="decimal" (preserves trailing zeros)
	locale?: string; // BCP-47, enables Intl.NumberFormat display
	formatOptions?: Intl.NumberFormatOptions;
	hideSteppers?: boolean; // hide up/down chevron buttons
	disableWheel?: boolean; // prevent scroll-wheel from changing value
	invalid?: boolean;
	invalidText?: string;
	warn?: boolean;
	warnText?: string;
	disabled?: boolean;
	readonly?: boolean;
	required?: boolean;
	hideLabel?: boolean;
	size?: 'sm' | 'md' | 'lg'; // 'md' omits Carbon's `size` prop (40px default)
	name?: string;
	id?: string;
	class?: string;
	onChange?: (value: number | null) => void;
	onBlur?: () => void;
	validate?: (raw: string, locale: string | undefined) => boolean | undefined;
}
```

**Rationale + differences from TextInput adapter:**

- **`value: number | null`** — `null` represents "no value entered." Carbon distinguishes this from `0` so a user clearing the field doesn't get coerced to zero. Adapter follows Carbon's convention.
- **`min` / `max` / `step`** are first-class numeric props. Carbon enforces clamping on increment/decrement button presses; type-in values that violate min/max trigger `invalid` if `validate` returns false (or by default if min/max set).
- **`allowDecimal: boolean`** is the key differentiator for Argos. Native `<input type="number">` strips trailing zeros from `"1.0"`. For frequency / coordinate displays, this is wrong. `allowDecimal={true}` switches to text-mode + decimal-keypad inputmode.
- **`disableWheel: boolean`** — important UX guard. Without it, user scrolls page while focused on a number input → value silently changes. Argos forms will set this to `true` by default for all critical numeric inputs (port numbers, frequencies, thresholds).
- **`onChange` callback** receives the parsed `number | null` directly. Consumer doesn't need to pull from event.detail.
- **`size`** axis adds `'md'` to Carbon's `'sm' | 'xl'` — same pattern as TextInput. `'md'` omits Carbon's `size` prop (Carbon default 40px).

---

## Consumer pattern

### Before (raw HTML, FilterBar RSSI floor) — bespoke

```svelte
<div class="field">
	<label for="fb-rssi">RSSI floor (dBm)</label>
	<input
		id="fb-rssi"
		type="number"
		inputmode="numeric"
		step="1"
		min="-120"
		max="0"
		placeholder="-70"
		bind:value={rssiFloor}
		disabled={isBusy}
		onblur={() => void applyFilters()}
		class="fb-input"
	/>
</div>
```

### After (Carbon-wrapped) — FilterBar

```svelte
<NumberInput
	labelText="RSSI floor (dBm)"
	bind:value={rssiFloor}
	min={-120}
	max={0}
	step={1}
	placeholder="-70"
	disabled={isBusy}
	onBlur={() => void applyFilters()}
	disableWheel
	hideSteppers
	size="sm"
	class="fb-input"
/>
```

The parent `<div class="field">` + `<label>` are removed; Carbon owns label rendering. `disableWheel` added (UX safety). `hideSteppers` matches the original visual (no chevron buttons in the compact filter row). `inputmode="numeric"` is implicit — Carbon sets it automatically based on `step` and `allowDecimal`.

### Before (shadcn `<Input type="number">`, TakServerForm port)

```svelte
<label class="flex flex-1 flex-col gap-1 text-[11px] font-medium text-muted-foreground">
	Port
	<Input type="number" bind:value={config.port} placeholder="8089" class="h-8 text-xs" />
</label>
```

### After (Carbon-wrapped) — TakServerForm

```svelte
<NumberInput
	labelText="Port"
	bind:value={config.port}
	placeholder="8089"
	min={1}
	max={65535}
	step={1}
	size="sm"
	hideSteppers
	disableWheel
/>
```

The parent flex-`<label>` becomes inline since Carbon renders its own label. `min={1} max={65535}` adds explicit port-range validation that the bespoke component lacked — improvement.

---

## Direct Carbon `<NumberInput>` use

For surfaces needing Carbon-specific features the adapter doesn't expose (slot:labelChildren rich label, Form integration, AI-gradient skin):

```svelte
<script>
	import { NumberInput, Form } from 'carbon-components-svelte';
</script>

<Form on:submit|preventDefault={handleSubmit}>
	<NumberInput
		labelText="Frequency (MHz)"
		bind:value={frequency}
		min={24}
		max={1750}
		step={0.1}
		allowDecimal
		locale="en-US"
		formatOptions={{ minimumFractionDigits: 4, maximumFractionDigits: 6 }}
		invalid={frequency < 24 || frequency > 1750}
		invalidText="Must be 24–1750 MHz (HackRF range)"
	/>
</Form>
```

---

## State + interaction semantics

- **Controlled value** — `$bindable()`; parent owns canonical numeric value (`number | null`).
- **Increment/decrement** — `step` drives keyboard arrow-up/down and stepper-button clicks. Carbon clamps at min/max.
- **Wheel events** — disabled by default in adapter via `disableWheel={true}` recommendation; consumers can override.
- **Invalid + invalidText** — first-class on individual NumberInput (unlike Checkbox/RadioButton). Carbon renders red border + error icon + `aria-describedby` to error message.
- **Warn + warnText** — second-tier soft-warning state (yellow). Use for "value works but unusual" cases (e.g., frequency outside common bands).
- **`allowEmpty`** — when false (default), empty input is invalid. When true, empty stays valid (use for optional numeric fields).
- **`validate` hook** — runs on raw input string. Return `true`=force valid, `false`=force invalid, `undefined`=defer to built-in.

---

## Migration consumer call-sites

### PR3e (this PR) — 3 canary sites

| File                                                    | Lines   | Site description                           |
| ------------------------------------------------------- | ------- | ------------------------------------------ |
| `src/lib/components/dashboard/panels/FilterBar.svelte`  | 131-141 | RSSI floor filter (integer, -120 to 0 dBm) |
| `src/lib/components/dashboard/tak/TakServerForm.svelte` | 36-43   | TAK server port (integer 1-65535)          |
| `src/lib/components/dashboard/tak/TakAuthEnroll.svelte` | 90-97   | TAK enrollment port (integer 1-65535)      |

### PR3e-tier-2 — 16 sites across 5 files (✅ Done 2026-04-29)

Split into two PRs along the `allowDecimal` axis under the 1200-line Danger PR-shape gate:

**Tier-2a (PR #83, squash `18067250`)** — integer cohort, `value+onChange` pattern (legacy `persistedWritable` store):

| File                                                                              | Lines (post-merge) | Sites                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/components/dashboard/panels/rf-propagation/RFPropagationControls.svelte` | ~22-96             | 5: FREQUENCY (1-100000 MHz), TX HEIGHT, RX HEIGHT (0.5-500 m), RADIUS (0.1-100 km), RESOLUTION (5-300 m/px) |
| `src/lib/components/dashboard/panels/rf-propagation/RFAdvancedControls.svelte`    | ~59-81             | 2: TX POWER (0.001-100 W), RX SENSITIVITY (-150-0 dBm)                                                      |
| `src/lib/components/screens/parts/SpectrumControls.svelte`                        | ~118-138           | 2: start MHz, stop MHz (1-6000 MHz, Hz↔MHz preserved via `* 1e6`)                                          |

**Tier-2b (PR #84, squash `458b11ad`)** — decimal cohort, `bind:value` + `allowDecimal` (first production exercise of the wrapper's text-mode trailing-zero preservation):

| File                                                         | Lines (post-merge) | Sites                                                                                        |
| ------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------- |
| `src/lib/components/screens/parts/FrequencyTuner.svelte`     | ~22-32             | 1: GSM frequency (0-6000 MHz, step 0.1)                                                      |
| `src/routes/recon/cellular/trunk-recorder/PresetForm.svelte` | ~165-260           | 6: control channels (array, P25 0.0125 MHz step), Center MHz, Sample rate Hz, RF/IF/BB gains |

**Wrapper validation outcomes:**

- `onChange` callback path: confirmed correct (Carbon's `dispatch("change", value)` emits `e.detail = number | null` directly per `node_modules/carbon-components-svelte/src/NumberInput/NumberInput.svelte:189, 217, 236, 421`)
- `allowDecimal=true` text-mode: smoke-tested in production at `/gsm-evil` (FrequencyTuner) and `/recon/cellular/trunk-recorder` (PresetForm 851.0125 MHz P25 channel)

**Deletions enabled by tier-2:**

- `parseFloor()` function (RSSI-floor shim — already deleted in canary's FilterBar)
- `parseFloat`-based `handleNumber` helpers in RFPropagationControls + RFAdvancedControls
- `parseMhzToHz`, `parseOneControlChannel`, `tryAddChannel`, `parseIntegerField`, `hzToMhzString`, `isValidMHz` regex (PresetForm + FrequencyTuner)
- Dead CSS rules: `.input-row`, `.unit`, `.field-input[type='number']::-webkit-*`, `.channel-row input { flex: 1 }`

**Sentrux signal across tier-2:** baseline 6733 (canary tip) → 6733 (tier-2a merged) → 6733 (tier-2b merged). Zero architectural drift across 16-site migration.

---

## What we don't migrate

- **Range slider** (drag-to-adjust) — Carbon ships `<Slider>` separately; future Phase 6.
- **Dual-handle range inputs** — same as above.
- **`<input type="range">`** instances — not in scope; tracked as Phase 6.

---

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-numberinput--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/NumberInput/NumberInput.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/NumberInput/NumberInput.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/number-input/_number-input.scss`
- Argos current bespoke (canary): `src/lib/components/dashboard/panels/FilterBar.svelte:131-141`
- Adapter pattern reference: Phase 3a `TextInput.svelte` + `text-input/code.md`
- HTML5 number input behavior: <https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number>
