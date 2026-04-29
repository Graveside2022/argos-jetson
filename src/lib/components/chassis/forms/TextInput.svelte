<script lang="ts">
	import { TextInput as CarbonTextInput } from 'carbon-components-svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		value: string;
		labelText: string;
		placeholder?: string;
		helperText?: string;
		invalid?: boolean;
		invalidText?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		hideLabel?: boolean;
		size?: 'sm' | 'md' | 'lg';
		type?: 'text' | 'email' | 'tel' | 'url';
		name?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		id?: string;
		onInput?: (value: string) => void;
		onChange?: (value: string) => void;
		onBlur?: () => void;
	}

	let {
		value = $bindable(''),
		labelText,
		placeholder = '',
		helperText = '',
		invalid = false,
		invalidText = '',
		disabled = false,
		readonly = false,
		required = false,
		hideLabel = false,
		size = 'md',
		type = 'text',
		name,
		autocomplete,
		id,
		onInput,
		onChange,
		onBlur
	}: Props = $props();

	// Carbon size axis is 'sm' | 'xl' (default omit = 40px md).
	// Adapter exposes 'sm' | 'md' | 'lg' for Argos consistency; 'md' omits the prop.
	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : undefined);

	function unwrap(detail: null | number | string): string {
		if (typeof detail === 'string') return detail;
		if (detail == null) return '';
		return String(detail);
	}
</script>

<CarbonTextInput
	{labelText}
	{placeholder}
	{helperText}
	{invalid}
	{invalidText}
	{disabled}
	{readonly}
	{required}
	{hideLabel}
	size={carbonSize}
	{type}
	{name}
	{autocomplete}
	{id}
	bind:value
	on:input={(e) => onInput?.(unwrap(e.detail))}
	on:change={(e) => onChange?.(unwrap(e.detail))}
	on:blur={() => onBlur?.()}
/>
