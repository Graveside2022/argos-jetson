# Password Input — Code

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/PasswordInput.svelte`
**Carbon component:** `<PasswordInput>` from `carbon-components-svelte` v0.107.0+

---

## Argos `PasswordInput` adapter API

Mirrors the `TextInput` adapter pattern (per `text-input/code.md`). Adds the visibility-toggle props Carbon's `<PasswordInput>` exposes.

```ts
interface Props {
	value: string;
	labelText: string; // required
	placeholder?: string;
	helperText?: string;
	invalid?: boolean;
	invalidText?: string;
	disabled?: boolean;
	required?: boolean;
	hideLabel?: boolean;
	size?: 'sm' | 'md' | 'lg';
	name?: string;
	autocomplete?: 'current-password' | 'new-password' | 'one-time-code' | 'off';
	id?: string;
	hidePasswordLabel?: string; // tooltip text when masked (default 'Hide password')
	showPasswordLabel?: string; // tooltip text when revealed (default 'Show password')
	tooltipAlignment?: 'start' | 'center' | 'end';
	tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
	onInput?: (value: string) => void;
	onChange?: (value: string) => void;
	onBlur?: () => void;
}
```

**Rationale**:

- `autocomplete` restricted to password-relevant tokens. Default to `'current-password'` for credential entry; consumers SET `'new-password'` for password-creation flows.
- `type` prop NOT exposed — Carbon's `<PasswordInput>` toggles internally; consumer never sets it. Adapter forces password semantics.
- Same Svelte-5 callback-prop idiom as `<TextInput>`: `onInput` / `onChange` / `onBlur`.
- Size axis reuses TextInput's `'sm' | 'md' | 'lg'` mapping.

## Consumer pattern

**Before (bespoke, GpServerForm password field)**:

```svelte
<label class="flex flex-col gap-1 ...">
	Password
	<input
		type="password"
		class="h-9 rounded-md border ..."
		style="background-color: #2a2a2a"
		placeholder="Enter password"
		value={password}
		oninput={(e) => onpassword(e.currentTarget.value)}
	/>
</label>
```

**After (Carbon-wrapped)**:

```svelte
<PasswordInput
	labelText="Password"
	placeholder="Enter password"
	autocomplete="current-password"
	bind:value={password}
	onInput={(value: string) => onpassword(value)}
/>
```

The visibility-toggle button + tooltip + masked/revealed state machine ship for free from Carbon. Consumer writes nothing extra.

## Direct Carbon `<PasswordInput>` use

Cases where the adapter's restricted surface is too narrow:

```svelte
<script>
	import { PasswordInput } from 'carbon-components-svelte';
</script>

<PasswordInput
	labelText="New passphrase"
	bind:value={newPass}
	helperText="≥ 12 chars; mixed case + digits + symbols"
	tooltipPosition="left"
/>
```

Use direct import when needing `tooltipAlignment` / `inline` / `warn` / `light` / `portalTooltip` access.

## State + interaction semantics

- **Default state**: masked (`type="password"` semantically; toggle icon = `<View>`).
- **Revealed state**: clicking eye flips to `type="text"`; icon switches to `<ViewOff>`; tooltip text flips from "Show password" to "Hide password" (or Argos-overridden labels).
- **Focus**: focus stays on the input through visibility toggle clicks; the toggle button has its OWN focus target (tab-reachable).
- **Caps lock indicator**: NOT shipped by Carbon; out of Argos scope.
- **Paste**: allowed by default; Carbon doesn't suppress (correct per WCAG — disabling paste hurts password managers).

## Migration consumer call-sites

### PR3b (this PR) — single canary + finalize

- **`src/lib/components/dashboard/globalprotect/GpServerForm.svelte`** — password input. Completes PR3a's deferred migration.

No further `<PasswordInput>` consumers anticipated until new credential-entry flows are added (e.g., TAK enrolment redesign — out of Phase 3 scope).

## What we don't migrate yet

- New credential flows that don't exist yet (placeholder).
- Inline / `warn` variant usage — no current Argos surface needs them.

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-passwordinput--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/TextInput/PasswordInput.svelte.d.ts`
- Argos current bespoke (1 surface): `src/lib/components/dashboard/globalprotect/GpServerForm.svelte`
- WCAG 2.1 SC 1.3.5 Identify Input Purpose (autocomplete tokens): <https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html>
