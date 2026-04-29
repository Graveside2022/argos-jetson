# Radio Button Group — Code

**Status:** Phase 3 PR3d — implementation in flight
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/RadioButtonGroup.svelte`
**Carbon component:** `<RadioButtonGroup>` from `carbon-components-svelte` v0.107.0+

---

## Argos `RadioButtonGroup` adapter API

```ts
interface Props {
	selected?: string | number; // bindable via $bindable() — single source of truth for child selection
	disabled?: boolean;
	required?: boolean;
	name?: string;
	legendText?: string;
	hideLegend?: boolean;
	helperText?: string;
	labelPosition?: 'right' | 'left';
	orientation?: 'horizontal' | 'vertical';
	id?: string;
	class?: string; // forwards to Carbon's outer div for Lunaris layout overrides
	onSelectionChange?: (value: string | number) => void; // unwraps Carbon's CustomEvent<Value>
}
```

**Key design decisions:**

- **`selected` is the single source of truth.** Don't `bind:checked` on individual RadioButton children inside a group — Carbon's group context overrides any local `bind:checked`. Use `bind:selected` on the group, and let children read selection via Carbon's context.
- **`onSelectionChange` callback** unwraps Carbon's `CustomEvent<Value>` to a plain `string | number`. Consumer doesn't need to know about CustomEvent shape.
- **`<slot />` for children.** Consumer composes RadioButton children inside the group; the slot renders them and Carbon's context provider wraps automatically.
- **No `legendChildren` slot exposed (yet)** — TakAuthMethodPicker doesn't need rich legend content. Add if/when a future surface needs an icon-prefixed legend.

---

## Consumer pattern

### Before (raw HTML, TakAuthMethodPicker chip pair)

```svelte
<div class="chip-row">
	<label class="chip">
		<input type="radio" class="sr-only" bind:group={config.authMethod} value="import" />
		<span>Import</span>
	</label>
	<label class="chip">
		<input type="radio" class="sr-only" bind:group={config.authMethod} value="enroll" />
		<span>Enroll</span>
	</label>
</div>
```

### After (Carbon-wrapped + RadioButtonGroup adapter)

```svelte
<RadioButtonGroup
	bind:selected={config.authMethod}
	legendText="Authentication method"
	hideLegend
	class="chip-row"
>
	<RadioButton labelText="Import" value="import" hideLabel class="chip" />
	<RadioButton labelText="Enroll" value="enroll" hideLabel class="chip" />
</RadioButtonGroup>
```

The `<div class="chip-row">` becomes part of the `class` forwarded to Carbon's `<fieldset>`. The `bind:group` → `bind:selected` swap is the central API translation. `hideLegend` keeps the AT-readable group label without visible chrome.

---

## Direct Carbon `<RadioButtonGroup>` use

For consumers needing Carbon-specific features (rich legend, alternative layouts, etc.):

```svelte
<script>
	import { RadioButton, RadioButtonGroup } from 'carbon-components-svelte';
	let plan = 'pro';
</script>

<RadioButtonGroup
	bind:selected={plan}
	legendText="Plan tier"
	helperText="You can switch plans later."
	orientation="vertical"
	required
>
	<RadioButton labelText="Free — 1 device" value="free" />
	<RadioButton labelText="Pro — 5 devices" value="pro" />
	<RadioButton labelText="Enterprise — unlimited" value="enterprise" />
</RadioButtonGroup>
```

Lunaris tokens flow through automatically via `lunaris-carbon-theme.scss`.

---

## State + interaction semantics

- **`bind:selected`** is a reactive contract: parent's `selected` value drives all child `checked` states; user click on any child updates `selected` which propagates to all siblings.
- **`disabled` on the group** disables ALL children. Per-child `disabled` still works for granular cases (e.g. one option requires an unmet license).
- **`required` on the group** sets a `required` attribute on the underlying `<fieldset>` semantics; HTML form-submit validation prevents submission with no radio selected.
- **`name`** — when explicitly set, all children share the same `name` attribute. Useful when reading the form state via `FormData` rather than Svelte bindings.
- **Keyboard interaction** — Tab into first/selected radio; arrow keys cycle within group; Tab exits. Selection-follows-focus per WAI-ARIA radio pattern.

---

## Migration consumer call-sites (PR3d scope)

### PR3d (this PR) — 1 file

| File                                                          | Lines | Site description                    |
| ------------------------------------------------------------- | ----- | ----------------------------------- |
| `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte` | 28-50 | 2-radio chip-pair (Import / Enroll) |

After migration:

- 1 `<RadioButtonGroup>` wrapper with `bind:selected={config.authMethod}` + `legendText` + `hideLegend` + `class="chip-row"`.
- 2 `<RadioButton>` children with `labelText` + `value` + `hideLabel` + `class="chip"`.
- Constitutional exemption #12 (the comment that documented why native HTML radio + sr-only was used) can be REMOVED in this PR — Carbon now provides the same functionality with proper a11y, no exemption needed.

---

## What we don't migrate yet

- **Multi-group radio sets in single form** — no current consumer.
- **Group with rich legend (icon + text)** — Carbon supports via `legendChildren` slot; expose only if a future surface needs it.
- **`required` validation surface** — TakAuthMethodPicker's auth method is never invalid (one of two always selected). No invalid-state migration needed.

---

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-radiobuttongroup--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/RadioButtonGroup/RadioButtonGroup.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/RadioButtonGroup/RadioButtonGroup.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/radio-button/_radio-button.scss`
- Argos current bespoke (canary): `src/lib/components/dashboard/tak/TakAuthMethodPicker.svelte`
- Companion atomic spec: `specs/026-lunaris-design-system/components/radio-button/code.md`
