# Radio Button — Code

**Status:** Phase 3 canary in progress (PR3d)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/RadioButton.svelte`
**Carbon component:** `<RadioButton>` from `carbon-components-svelte` v0.107.0+

---

## Argos `RadioButton` adapter API

```ts
interface Props {
	checked?: boolean; // bindable via $bindable() — used in standalone mode
	disabled?: boolean;
	required?: boolean;
	labelText: string; // required — Carbon a11y mandate
	hideLabel?: boolean; // for chip-skin surfaces (TakAuthMethodPicker)
	name?: string; // standalone-mode group sync via Carbon RadioButtonRegistry
	id?: string; // optional — Carbon defaults to `ccs-${random}`
	value: string | number; // required for group identity
	class?: string; // forwards to Carbon `bx--radio-button-wrapper` div for Lunaris skins
	onChange?: (event: Event) => void; // Carbon emits `change`, NOT `check` (different from Checkbox)
}
```

**Differences from Checkbox adapter (call out before someone copy-pastes):**

- **`value` is required**, not optional. RadioButtons must have a value to participate in a group.
- **No `indeterminate` prop.** Indeterminate is a checkbox-only concept (radios are mutually exclusive).
- **No `helperText` prop.** Carbon's individual RadioButton doesn't support helper text — that lives on RadioButtonGroup.
- **`onChange` not `onCheck`.** Carbon emits `change: WindowEventMap["change"]` on individual RadioButton, not the `check` event Checkbox emits.
- **No `invalid` / `invalidText`.** Same constraint as Checkbox — Carbon validates groups, not singletons.

**Inside a `<RadioButtonGroup>`:**

When this RadioButton is rendered as a child of `<RadioButtonGroup>`, Carbon delegates selection state to the group's `selectedValue` writable store via `getContext("carbon:RadioButtonGroup")`. Don't `bind:checked` on children inside a group — the group's `bind:selected` is the single source of truth, and child `checked` syncs from it. Standalone mode (with `name`) uses an internal RadioButtonRegistry to sync `checked` across siblings sharing the same `name` attribute.

---

## Consumer pattern

### Before (raw HTML, TakAuthMethodPicker chip-skin)

```svelte
<label class="chip">
	<input type="radio" class="sr-only" bind:group={config.authMethod} value="import" />
	<span class="chip-content">Import</span>
</label>
<label class="chip">
	<input type="radio" class="sr-only" bind:group={config.authMethod} value="enroll" />
	<span class="chip-content">Enroll</span>
</label>
```

### After (Carbon-wrapped + RadioButtonGroup)

```svelte
<RadioButtonGroup bind:selected={config.authMethod} legendText="Authentication method" hideLegend>
	<RadioButton labelText="Import" value="import" class="chip" />
	<RadioButton labelText="Enroll" value="enroll" class="chip" />
</RadioButtonGroup>
```

The native `<label class="sr-only">` wrappers are removed — Carbon owns label rendering via `<label>` + `<input id={id}>` pairing. Visible chip-pill styling stays via `class="chip"` forwarding to Carbon's outer wrapper div. `hideLegend` keeps the `<legend>` AT-readable but visually hidden so the chip-pair flows inline without an "Authentication method" header.

---

## Direct Carbon `<RadioButton>` use

For standalone radios outside a group (Carbon supports this via `name`-based sibling sync):

```svelte
<script>
	import { RadioButton } from 'carbon-components-svelte';
	let mode = 'live';
</script>

<RadioButton bind:checked={live} labelText="Live" value="live" name="capture-mode" />
<RadioButton
	bind:checked={historical}
	labelText="Historical"
	value="historical"
	name="capture-mode"
/>
```

Carbon's RadioButtonRegistry auto-syncs `checked` across the two — clicking one un-checks the other. No `RadioButtonGroup` wrapper required.

---

## State + interaction semantics

- **Group binding (`bind:selected` on RadioButtonGroup)** is preferred for new code. Single-source-of-truth.
- **Standalone with shared `name`** is a fallback for cases where you can't wrap in a group (e.g. radios scattered across non-adjacent layout regions). Trade-off: AT loses the `<fieldset>`/`<legend>` semantic grouping.
- **Disabled** — pass-through; cursor + tab order handled by Carbon.
- **Required** — Carbon adds the HTML `required` attribute. Visible asterisk handled by surrounding form layout.
- **Keyboard navigation** — Tab moves focus INTO the first radio of a group, then arrow keys (Up/Down/Left/Right) cycle selection between siblings. Tab again exits the group. Different from Checkbox (Space toggles each independently).

---

## Migration consumer call-sites (PR3d scope)

### PR3d (this PR) — 1 file, 2 sites

| File                                                          | Lines | Site description                         |
| ------------------------------------------------------------- | ----- | ---------------------------------------- |
| `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte` | 28    | "Import" chip — auth via existing cert   |
| `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte` | 46    | "Enroll" chip — auth via SCEP enrollment |

Both sites bind to `config.authMethod` (string union `"import" | "enroll"`). Migrated as a single 2-child `<RadioButtonGroup>`.

---

## What we don't migrate yet

- **Multi-group radio sets** — no current consumer pattern. Phase 7 audit if any surface.
- **Radio with rich label content** (icons next to label text) — Carbon supports via `labelChildren` slot; reserve for when needed.

---

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-radiobutton--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButton/RadioButton.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/RadioButton/RadioButton.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`
- Argos current bespoke (canary): `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte:28+46`
- Adapter pattern reference: Phase 3c `Checkbox.svelte` + spec `checkbox/code.md`
