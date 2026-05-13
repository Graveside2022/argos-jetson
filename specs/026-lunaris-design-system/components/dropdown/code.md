# Dropdown — Code

The chassis `<Dropdown>` wrapper at `src/lib/components/chassis/forms/Dropdown.svelte` adapts Carbon's Svelte-4 Dropdown primitive into Svelte-5 runes.

## Distinct from `<Select>`

Phase 3f ships **two** chassis wrappers because Carbon offers two DIFFERENT primitives with different ARIA semantics:

|                    | `<Select>` (PR-A)                  | `<Dropdown>` (this)                                  |
| ------------------ | ---------------------------------- | ---------------------------------------------------- |
| Underlying element | Native HTML `<select>`             | Custom popover combobox                              |
| ARIA role          | `<select>` (browser-native)        | `combobox` + `listbox`                               |
| Items API          | Slot-based `<SelectItem>` children | Data prop `items: Array<{id, label}>`                |
| Keyboard           | Browser handles all                | Carbon implements (TAB/ARROW/ENTER/ESC/SPACE)        |
| Mobile picker      | Native (iOS wheel, Android sheet)  | Custom popover (no native picker)                    |
| Focus management   | Browser-native                     | Carbon implements + `portalMenu` for overflow escape |

PR-C uses Dropdown specifically for object-keyed dynamic lists where `{id, label}` shape outperforms slot iteration.

## Public API

```ts
interface DropdownItem {
	id: string | number;
	label: string;
	disabled?: boolean;
}

interface Props {
	/** Selected item id. Two-way bindable via $bindable. */
	selectedId?: string | number;
	/** Array of items to render. Required. */
	items: DropdownItem[];
	/** Visible label above the dropdown. Required for a11y. */
	labelText: string;
	/** Helper text below the field. */
	helperText?: string;
	/** Mark field invalid; renders red border + icon. */
	invalid?: boolean;
	/** Error text shown when invalid. */
	invalidText?: string;
	/** Mark field as warn; renders amber border + icon. */
	warn?: boolean;
	/** Warning text. */
	warnText?: string;
	/** Disable the entire dropdown. */
	disabled?: boolean;
	/** Visually hide the label (still announced). */
	hideLabel?: boolean;
	/** Inline label/field layout (vs default stacked). */
	inline?: boolean;
	/** Render menu in a portal to escape overflow:hidden parents. */
	portalMenu?: boolean;
	/** Argos-density size token. */
	size?: 'sm' | 'md' | 'lg';
	/** Popover direction. */
	direction?: 'bottom' | 'top';
	/** Form name attribute. */
	name?: string;
	/** Element id. */
	id?: string;
	/** Extra class. */
	class?: string;
	/** Callback fired on selection change. */
	onSelect?: (selectedId: string | number, selectedItem: DropdownItem) => void;
}
```

## Internal forwarding

```svelte
<CarbonDropdown
	bind:selectedId
	items={mapped}
	itemToString={(item) => item.text}
	{labelText}
	size={carbonSize}
	...
	on:select={(e) => onSelect?.(e.detail.selectedId, e.detail.selectedItem)}
/>
```

Carbon's items API uses `text` as the display field. The Lunaris wrapper accepts `label` for Argos-consistent naming, then maps internally:

```ts
const mapped = $derived(items.map((it) => ({ id: it.id, text: it.label, disabled: it.disabled })));
```

## Why bind:selectedId (not controlled-with-callback like Select)

Select's wrapper used controlled-with-callback to dodge a Svelte-5/$bindable through prop-renaming edge case. Dropdown's `selectedId` prop does NOT rename — it stays `selectedId` from the wrapper through to Carbon. So `bind:selectedId` flows cleanly. Consumers who prefer the callback shape can use `selectedId={x} onSelect={(id) => x = id}` instead.

## Filterable / ComboBox

`filterable` is NOT exposed in this wrapper. Carbon's `<Dropdown>` does not ship filtering. The corresponding Carbon component is `<ComboBox>`, which has a different prop surface and DOM. PR-C does not migrate filterable use cases; future Argos `<ComboBox>` wrapper handles them.

## Tests

No Vitest tests in PR-C. Carbon's own test suite covers the primitive. Argos-side smoke gates:

1. `npm run build` clean.
2. Chrome-devtools MCP visual diff per `style.md` procedure.
3. Manual keyboard a11y trace per `accessibility.md`.

A vitest spec is added when a tier-2 site reveals a regression — defer until concrete.
