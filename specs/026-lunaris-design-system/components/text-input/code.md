# Text Input — Code

**Status:** Phase 3 canary in progress (PR3a)
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/TextInput.svelte`
**Carbon component:** `<TextInput>` from `carbon-components-svelte` v0.107.0+

---

## Argos `TextInput` adapter API

The Argos `TextInput` is a Svelte 5 (runes) wrapper that delegates to Carbon's `<TextInput>`. It exists to (1) keep call-sites idiomatic (callback props, not event dispatchers), (2) inject Lunaris density defaults, (3) provide a single seam for theme / a11y overrides if needed.

```ts
interface Props {
	value: string; // bindable via $bindable()
	labelText: string; // required — Carbon a11y mandate
	placeholder?: string;
	helperText?: string;
	invalid?: boolean;
	invalidText?: string;
	disabled?: boolean;
	readonly?: boolean;
	required?: boolean;
	hideLabel?: boolean; // for surfaces that already render a visual label
	size?: 'sm' | 'md' | 'lg'; // 'md' = default (omits Carbon `size` prop)
	type?: 'text' | 'email' | 'tel' | 'url'; // password/number use their own components
	name?: string;
	autocomplete?: string;
	id?: string; // optional — Carbon defaults to `ccs-${random}`
	onInput?: (value: string) => void;
	onChange?: (value: string) => void;
	onBlur?: () => void;
}
```

**Rationale**:

- `value` is the single source of truth via `$bindable()` per Svelte 5 runes idiom; consumers `bind:value` or supply `onInput`.
- `labelText` is **required** — Carbon's accessibility contract. Adapter does NOT default to empty string (unlike Carbon) to force consumer to provide one. Use `hideLabel` when an enclosing surface already renders a label.
- `size` adds `'md'` to Carbon's `'sm' | 'xl'` axis — `'md'` omits the prop (Carbon default 40px).
- `type` is restricted to text-shaped types. `password` → use a future `<PasswordInput>` adapter (Phase 3 PR3b). `number` → use future `<NumberInput>` adapter.
- Callback props (`onInput` / `onChange` / `onBlur`) — Svelte 5 idiom. Carbon's `CustomEvent<null|number|string>` is unwrapped by the adapter; consumers receive a plain `string`.

---

## Consumer pattern

**Before (bespoke, GpServerForm portal field)**:

```svelte
<label class="flex flex-col gap-1 ...">
	Portal Address
	<input
		type="text"
		class="h-9 rounded-md border ..."
		style="background-color: #2a2a2a"
		placeholder="vpn.example.mil"
		value={config.portal}
		oninput={(e) => update('portal', e.currentTarget.value)}
	/>
</label>
```

**After (Carbon-wrapped)**:

```svelte
<TextInput
	labelText="Portal Address"
	placeholder="vpn.example.mil"
	bind:value={portal}
	onInput={(value) => update('portal', value)}
/>
```

The Lunaris theme overlay (`src/lib/styles/lunaris-carbon-theme.scss`) handles all chrome — bespoke Tailwind utility soup (`h-9 rounded-md border-border/40 ...`) is replaced by Carbon-rendered structure with Lunaris token values.

---

## Direct Carbon `<TextInput>` use

For surfaces that need Carbon-specific features not exposed by the adapter (Form-context integration, `inline` variant, `warn` state, `slot:labelChildren` rich label):

```svelte
<script>
	import { TextInput, Form } from 'carbon-components-svelte';
</script>

<Form on:submit|preventDefault={handleSubmit}>
	<TextInput
		labelText="Email"
		type="email"
		bind:value={email}
		invalid={emailInvalid}
		invalidText="Must be a valid email address"
	/>
</Form>
```

Lunaris tokens flow through automatically. No per-call-site CSS.

---

## State + interaction semantics

- **Controlled value** — adapter uses `$bindable()`; parent or adapter consumer owns the canonical value.
- **Invalid** — `invalid + invalidText` pair; Carbon renders the warning icon + describes via `aria-describedby`.
- **Disabled** — passes through to Carbon; `aria-disabled` + cursor + click suppression handled.
- **Read-only** — Carbon renders an `EditOff` icon; semantically distinct from `disabled` (read-only stays in tab order).
- **Required** — Carbon adds the HTML `required` attribute; visual indicator handled by the form-level surface (Carbon doesn't add an asterisk).
- **Type narrowing** — adapter restricts `type` so consumers cannot accidentally pass `'password'` and bypass the `<PasswordInput>` taxonomy.

---

## Migration consumer call-sites

Per `text-input/usage.md` inventory (corrected post-RTFM 2026-04-29):

### PR3a (canary) — this PR

- **`src/lib/components/dashboard/globalprotect/GpServerForm.svelte`** — `portal` + `username` inputs only. Password input stays bespoke until PR3b.

### PR3b (tier-migrate)

- **`src/lib/components/dashboard/globalprotect/GpServerForm.svelte`** — `password` input → `<PasswordInput>` adapter (separate spec set under `components/password-input/`).
- **`src/lib/components/dashboard/panels/FilterBar.svelte`** — single `<input>` filter.
- **`src/lib/components/screens/parts/FrequencyTuner.svelte`** — _label half only_; numeric half goes to `<NumberInput>` adapter (Phase 3 stretch).

### Deferred to a separate Phase 3 sub-track (Search component spec)

- **`src/lib/components/chassis/ToolsFlyoutHeader.svelte`** — semantically Carbon `<Search>`, not `<TextInput>`. New component spec required.
- **`src/lib/components/screens/parts/KismetInspector.svelte`** — re-verify: grep found no `<input>`; may already use a different abstraction.

Each tier ships as its own commit / PR for bisect granularity.

---

## What we don't migrate yet

- **`<TextArea>`** — multi-line capture; reserved for a future Phase 3 stretch.
- **`<PasswordInput>`** — separate component spec; PR3b.
- **`<NumberInput>`** — already has `usage.md` (drafted PR #68); separate adapter, separate PR.
- **`<Search>`** — Carbon's search-specific component; new spec set required for ToolsFlyout/Kismet migrations.
- **Inputs inside Carbon `<DataTable>` slots** — handled in their parent table's spec (Phase 2 already complete).

---

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-textinput--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/TextInput/TextInput.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/TextInput/TextInput.svelte.d.ts`
- Carbon SCSS source: `docs/carbon-design-system/packages/styles/scss/components/text-input/_text-input.scss`
- Argos current bespoke (canary): `src/lib/components/dashboard/globalprotect/GpServerForm.svelte`
- Adapter pattern reference: Gang of Four §Structural; <https://refactoring.guru/design-patterns/adapter>
- Branch-by-abstraction reference: Newman, "Building Microservices" 2nd ed §5
