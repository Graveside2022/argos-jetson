# Checkbox — Code

**Status:** Phase 3 canary in progress (PR3c)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/Checkbox.svelte`
**Carbon component:** `<Checkbox>` from `carbon-components-svelte` v0.107.0+

---

## Argos `Checkbox` adapter API

The Argos `Checkbox` is a Svelte 5 (runes) wrapper that delegates to Carbon's `<Checkbox>`. It exists to (1) keep call-sites idiomatic (callback prop, not event dispatcher), (2) enforce required `labelText` for a11y, (3) provide a single `class`-forwarding seam for Lunaris-bespoke chip skins (`.opt`), (4) defer `bind:group` to the future RadioButton + CheckboxGroup wrappers.

```ts
interface Props {
	checked?: boolean; // bindable via $bindable()
	indeterminate?: boolean;
	disabled?: boolean;
	required?: boolean;
	readonly?: boolean;
	labelText: string; // required — Carbon a11y mandate
	hideLabel?: boolean; // for chip surfaces that render visual text outside the label
	helperText?: string;
	title?: string; // tooltip; falls back to label-truncation per Carbon
	name?: string;
	id?: string; // optional — Carbon defaults to `ccs-${random}`
	class?: string; // forwards to Carbon `bx--checkbox-wrapper` div for Lunaris skins
	onCheck?: (checked: boolean) => void;
}
```

**Rationale**:

- `checked` is `$bindable()` so consumers `bind:checked` exactly like the bespoke `<input>`. Migration is one-line.
- `labelText` is **required** — Carbon's accessibility contract. Adapter does NOT default to empty string.
- `bind:group` and `bind:selected` are **deferred to a future `<CheckboxGroup>` wrapper** (Phase 3d co-ships with RadioButton). The 5 PR3c sites are all individual toggles; group binding is unused.
- `class` prop forwards to Carbon's outermost `bx--checkbox-wrapper` div so BluetoothPanel's `.opt` chip skin keeps applying.
- Single `onCheck(checked)` callback (boolean) — the only Carbon event the adapter exposes. `on:click` / `on:change` are not forwarded; `bind:checked` covers state, `onCheck` covers side-effects.

---

## Consumer pattern

### Before (raw HTML, ReportsView mission modal)

```svelte
<label class="form-field form-field-inline">
	<input type="checkbox" bind:checked={missionSetActive} disabled={missionSubmitting} />
	<span class="field-label">SET ACTIVE</span>
</label>
```

### After (Carbon-wrapped)

```svelte
<Checkbox bind:checked={missionSetActive} disabled={missionSubmitting} labelText="SET ACTIVE" />
```

The parent `<label>` wrapper is removed (Carbon owns label rendering). The `<span class="field-label">` is removed (Carbon owns the visible label). The form-row layout (gap/spacing) is adjusted in the parent if needed; in the ReportsView case the `.form-field-inline` flex rule continues to apply because the `<Checkbox>` renders a single visible block.

### Before (BluetoothPanel `.opt` chip)

```svelte
<label
	class="opt"
	title="Capture full BLE band 2402–2480 MHz (96 channels). Default covers ch37+ch38 only."
>
	<input
		type="checkbox"
		bind:checked={allChannels}
		disabled={togglesDisabled}
		aria-label="All BLE channels (96 ch wideband)"
	/>
	ALL CH
</label>
```

### After (Carbon-wrapped, chip skin preserved)

```svelte
<Checkbox
	bind:checked={allChannels}
	disabled={togglesDisabled}
	labelText="ALL CH"
	title="Capture full BLE band 2402–2480 MHz (96 channels). Default covers ch37+ch38 only."
	class="opt"
/>
```

The `aria-label` "All BLE channels (96 ch wideband)" is dropped — `labelText="ALL CH"` is now the accessible name and the visible text. If a richer accessible name is required (full description of what the toggle does), use `title` (Carbon shows it as `<label title>` so AT may concatenate).

For the chip skin to keep working, BluetoothPanel's existing `.opt` CSS must successfully target the Carbon DOM. Verification step in PR3c.

---

## Direct Carbon `<Checkbox>` use

For surfaces that need Carbon-specific features the adapter does not expose (`<CheckboxGroup>`, `<CheckboxSkeleton>`, helper-text rendering, `on:click` slot for analytic hooks):

```svelte
<script>
	import { Checkbox, CheckboxGroup } from 'carbon-components-svelte';

	let selected = ['email'];
</script>

<CheckboxGroup legendText="Notification preferences" name="prefs" bind:selected>
	<Checkbox value="email" labelText="Email" />
	<Checkbox value="sms" labelText="SMS" />
	<Checkbox value="push" labelText="Push notifications" />
</CheckboxGroup>
```

Lunaris tokens flow through automatically.

---

## State + interaction semantics

- **Controlled value** — adapter uses `$bindable()`; parent owns the canonical `checked`.
- **Indeterminate** — Carbon adds the dash glyph + `aria-checked="mixed"`. None of the PR3c sites use this; included for future.
- **Disabled** — passes through; cursor + tab-order behavior handled by Carbon.
- **Read-only** — adapter exposes the prop for symmetry with TextInput; no PR3c site uses it.
- **Invalid state** — Carbon's individual `<Checkbox>` does NOT support per-checkbox invalid state; only `<CheckboxGroup>` does (group-level validation). The wrapper does not expose `invalid` / `invalidText`. If a future surface needs single-checkbox validation, render an external error message via the surrounding form layout.
- **Required** — Carbon adds the HTML `required` attribute; visible asterisk handled by surrounding form pattern (form-level only — Carbon does not auto-add per-field asterisk).

---

## Migration consumer call-sites (PR3c scope)

Per audit on 2026-04-29 08:35 (no bespoke `ui/checkbox` exists; all sites are raw HTML):

### PR3c (this PR) — 5 sites

| File                                                        | Line | Site description                              |
| ----------------------------------------------------------- | ---- | --------------------------------------------- |
| `src/lib/components/dashboard/views/ReportsView.svelte`     | 604  | mission modal "SET ACTIVE" toggle (canary)    |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte` | 233  | `.opt` chip "ALL CH" (BLE wideband)           |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte` | 245  | `.opt` chip "ACTIVE" (HCI active scan)        |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte` | 254  | `.opt` chip "GPS" (gpsd packet tagging)       |
| `src/lib/components/dashboard/panels/BluetoothPanel.svelte` | 266  | `.opt` chip "CODED" (LE Coded PHY long-range) |

Total: 5 sites, all individual toggles. No `<CheckboxGroup>` candidates in PR3c (BluetoothPanel's 4 are independent BLE-scan options).

---

## What we don't migrate yet

- **`<CheckboxGroup>`** — deferred to Phase 3d / 3e once a real consumer pattern exists. Group binding (`bind:selected`) is a different idiom from individual `bind:checked`.
- **`<CheckboxSkeleton>`** — Argos has no async-loaded checkbox surfaces today; reserve until needed.
- **Indeterminate (mixed) state** — no current consumer; added when the first parent-of-N-children pattern lands.

---

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-checkbox--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/Checkbox/Checkbox.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/Checkbox/Checkbox.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/checkbox/_checkbox.scss`
- Argos current bespoke (canary): `src/lib/components/dashboard/views/ReportsView.svelte:604`
- Argos chip skin reference: `src/lib/components/dashboard/panels/BluetoothPanel.svelte:233-266`
- Adapter pattern reference: Phase 3a `TextInput.svelte` + spec `text-input/code.md`
