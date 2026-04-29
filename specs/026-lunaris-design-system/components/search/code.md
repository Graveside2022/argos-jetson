# Search — Code

**Status:** Phase 3 PR3b prep
**Last updated:** 2026-04-29
**Implementation file (target):** `src/lib/components/chassis/forms/Search.svelte`
**Carbon component:** `<Search>` from `carbon-components-svelte` v0.107.0+

---

## Argos `Search` adapter API

Carbon's `<Search>` has a different surface than `<TextInput>`. The adapter exposes the subset Argos surfaces actually need.

```ts
interface Props {
	value: string;
	labelText: string; // required for a11y; pair with hideLabel for icon-only chrome
	hideLabel?: boolean;
	placeholder?: string;
	disabled?: boolean;
	autofocus?: boolean;
	closeButtonLabelText?: string; // default 'Clear search input'
	size?: 'sm' | 'md' | 'lg'; // adapter mapping (see below)
	id?: string;
	onInput?: (value: string) => void;
	onClear?: () => void;
	onChange?: (value: string) => void;
}
```

**Size axis mapping** (Carbon's axis is `'sm' | 'lg' | 'xl'`, default `'xl'`):

| Adapter `size` | Carbon `size` | Px height | Use                              |
| -------------- | ------------- | --------- | -------------------------------- |
| `'sm'`         | `'sm'`        | 32px      | Tools flyout, drawer-tab filters |
| `'md'`         | `'lg'`        | 40px      | Settings panel filters           |
| `'lg'`         | `'xl'`        | 48px      | Hero search (not currently used) |

Carbon's default is `xl` which is 48px — too tall for Argos chrome. Adapter remaps so `'md'` (Argos default convention) lands on Carbon's `'lg'` (40px).

**Rationale**:

- `value` is `string`-typed (Carbon types it as generic `T`; adapter narrows for the consumer cases Argos has).
- `labelText` is the visible label; when omitted, supply `ariaLabel` for screen-reader-only naming. Carbon does NOT ship `hideLabel` for `<Search>` (only for `<TextInput>`); the adapter routes `ariaLabel` through Carbon's `$$restProps` to the underlying `<input>`.
- `onClear` callback exposed — Carbon emits `CustomEvent<null>`; adapter unwraps.
- `labelText` defaults to empty string — adapter does not require it. `expandable` / `expanded` props NOT exposed — Argos doesn't surface that variant in PR3b. Add later if needed.
- `icon` prop NOT exposed — let Carbon's default magnifier ship; consumers don't override.

## Consumer pattern

**Before (bespoke, ToolsFlyoutHeader.svelte)**:

```svelte
<div class="search">
	<Search size={14} />
	<input
		bind:this={searchInput}
		bind:value={query}
		type="search"
		placeholder="Search tools…"
		aria-label="Search tools"
		spellcheck="false"
		autocomplete="off"
	/>
	<span class="kbd">ESC</span>
</div>
```

**After (Carbon-wrapped)**:

```svelte
<div class="search-row">
	<SearchAdapter
		labelText="Search tools"
		ariaLabel="Search tools"
		placeholder="Search tools…"
		autofocus={open}
		bind:value={query}
		size="sm"
	/>
	<span class="kbd">ESC</span>
</div>
```

The Lucide `<Search>` prefix icon, the bespoke focus-within ring, and the manual self-focus all DELETE — Carbon handles each.

## Direct Carbon `<Search>` use

For surfaces that want the expandable / skeleton / icon-override features:

```svelte
<script>
	import { Search } from 'carbon-components-svelte';
	import { Filter } from 'carbon-icons-svelte';
</script>

<Search
	expandable
	icon={Filter}
	labelText="Filter logs"
	bind:value={logFilter}
	on:clear={() => (logFilter = '')}
/>
```

## State + interaction semantics

- **Empty**: clear button hidden; Argos's ESC clear-chip stays decorative.
- **Filled**: Carbon shows `<Close>` clear button; clicking fires `on:clear` event (`detail: null`); adapter calls `onClear?.()`.
- **Focused**: Carbon's bottom-border focus ring activates; Argos's bespoke `:focus-within` rule on parent wrapper deletes.
- **Disabled**: passes through.
- **Autofocus**: Carbon ships `autofocus` prop; adapter passes through. ToolsFlyoutHeader's existing self-focus pattern reduces to `autofocus={open}`.

## Migration consumer call-sites

### PR3b — primary canary

- **`src/lib/components/chassis/ToolsFlyoutHeader.svelte`** — replaces the bespoke `<input type="search">` + Lucide prefix + `:focus-within` wrapper.

### Future (separate spec sub-track)

- Drawer-tab filters (Logs / Wifi / Bluetooth) — when those tabs adopt the chassis filter pattern.
- Settings panel filter (if added) — currently not present.

## What we don't migrate yet

- `expandable` collapsing variant — no surface needs it today.
- Custom icon override (`icon` prop) — Argos sticks with Carbon's magnifier for consistency.
- Search skeleton state — async filtering not surfaced yet.

## Authority citations

- Carbon Svelte component reference: <https://svelte.carbondesignsystem.com/?path=/docs/components-search--default>
- Carbon Svelte source: `node_modules/carbon-components-svelte/src/Search/Search.svelte`
- Carbon Svelte type defs: `node_modules/carbon-components-svelte/src/Search/Search.svelte.d.ts`
- Argos current bespoke: `src/lib/components/chassis/ToolsFlyoutHeader.svelte`
- ADR-0001 (taxonomy decision): `specs/026-lunaris-design-system/adrs/0001-phase-3-canary-textinput.md`
