<script lang="ts">
	import { Dropdown as CarbonDropdown } from 'carbon-components-svelte';

	interface DropdownItem {
		id: string | number;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		selectedId?: string | number;
		items: DropdownItem[];
		labelText: string;
		helperText?: string;
		invalid?: boolean;
		invalidText?: string;
		warn?: boolean;
		warnText?: string;
		disabled?: boolean;
		hideLabel?: boolean;
		inline?: boolean;
		portalMenu?: boolean;
		size?: 'sm' | 'md' | 'lg';
		direction?: 'bottom' | 'top';
		name?: string;
		id?: string;
		class?: string;
		onSelect?: (selectedId: string | number, selectedItem: DropdownItem) => void;
	}

	let {
		selectedId = $bindable(undefined),
		items,
		labelText,
		helperText = '',
		invalid = false,
		invalidText = '',
		warn = false,
		warnText = '',
		disabled = false,
		hideLabel = false,
		inline = false,
		portalMenu,
		size = 'md',
		direction = 'bottom',
		name,
		id,
		class: className,
		onSelect
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : undefined);

	const carbonItems = $derived(
		items.map((it) => ({ id: it.id, text: it.label, disabled: it.disabled }))
	);
</script>

<CarbonDropdown
	bind:selectedId
	items={carbonItems}
	itemToString={(item) => item.text}
	{labelText}
	{helperText}
	{invalid}
	{invalidText}
	{warn}
	{warnText}
	{disabled}
	{hideLabel}
	type={inline ? 'inline' : 'default'}
	{portalMenu}
	size={carbonSize}
	{direction}
	{name}
	{id}
	class={className}
	on:select={(e) => {
		const detail = e.detail as {
			selectedId: string | number;
			selectedItem: { id: string | number; text: string; disabled?: boolean };
		};
		const original = items.find((it) => it.id === detail.selectedId);
		if (original) onSelect?.(detail.selectedId, original);
	}}
/>
