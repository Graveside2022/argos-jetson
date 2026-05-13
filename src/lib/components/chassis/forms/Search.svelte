<script lang="ts">
	import { Search as CarbonSearch } from 'carbon-components-svelte';

	interface Props {
		value: string;
		/**
		 * Visible label text (rendered above the input by Carbon).
		 * When omitted, supply `ariaLabel` instead so the input still has
		 * an accessible name. Carbon's <Search> does not ship a hideLabel
		 * prop (unlike <TextInput>); we emulate it by leaving labelText
		 * empty and routing the name through aria-label.
		 */
		labelText?: string;
		/** Screen-reader-only accessible name when no visible label is rendered. */
		ariaLabel?: string;
		placeholder?: string;
		disabled?: boolean;
		autofocus?: boolean;
		closeButtonLabelText?: string;
		size?: 'sm' | 'md' | 'lg';
		id?: string;
		onInput?: (value: string) => void;
		onClear?: () => void;
		onChange?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		labelText = '',
		ariaLabel,
		placeholder = '',
		disabled = false,
		autofocus = false,
		closeButtonLabelText = 'Clear search input',
		size = 'md',
		id,
		onInput,
		onClear,
		onChange
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : 'lg');

	function readTarget(e: Event): string {
		const t = e.target;
		return t instanceof HTMLInputElement ? t.value : '';
	}
</script>

<CarbonSearch
	{labelText}
	{placeholder}
	{disabled}
	{autofocus}
	{closeButtonLabelText}
	size={carbonSize}
	{id}
	aria-label={ariaLabel}
	bind:value
	on:input={(e) => onInput?.(readTarget(e))}
	on:change={(e) => onChange?.(readTarget(e))}
	on:clear={() => onClear?.()}
/>
