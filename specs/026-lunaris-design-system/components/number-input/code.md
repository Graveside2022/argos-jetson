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

### Before (raw HTML, FilterBar RSSI floor)

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

### After (Carbon-wrapped)

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

### After (Carbon-wrapped)

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

### PR3e-tier-2 (follow-up) — 16 sites across 5 files

- `RFAdvancedControls.svelte` (2 sites — RF propagation advanced)
- `RFPropagationControls.svelte` (5 sites — RF propagation main controls)
- `SpectrumControls.svelte` (2 sites — spectrum analyzer)
- `PresetForm.svelte` (6 sites — trunk-recorder preset, decimal frequencies via `allowDecimal`)
- `FrequencyTuner.svelte` (1 site — main frequency display, large `xl` size + `locale` formatting)

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
