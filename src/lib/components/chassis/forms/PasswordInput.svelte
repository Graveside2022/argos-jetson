<script lang="ts">
	import { PasswordInput as CarbonPasswordInput } from 'carbon-components-svelte';

	type Autocomplete = 'current-password' | 'new-password' | 'one-time-code' | 'off';

	interface Props {
		value: string;
		labelText: string;
		placeholder?: string;
		helperText?: string;
		invalid?: boolean;
		invalidText?: string;
		disabled?: boolean;
		required?: boolean;
		hideLabel?: boolean;
		size?: 'sm' | 'md' | 'lg';
		name?: string;
		autocomplete?: Autocomplete;
		id?: string;
		hidePasswordLabel?: string;
		showPasswordLabel?: string;
		tooltipAlignment?: 'start' | 'center' | 'end';
		tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
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
		required = false,
		hideLabel = false,
		size = 'md',
		name,
		autocomplete = 'current-password',
		id,
		hidePasswordLabel = 'Hide password',
		showPasswordLabel = 'Show password',
		tooltipAlignment = 'center',
		tooltipPosition = 'bottom',
		onInput,
		onChange,
		onBlur
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : undefined);

	function readTarget(e: Event): string {
		const t = e.target;
		return t instanceof HTMLInputElement ? t.value : '';
	}
</script>

<CarbonPasswordInput
	{labelText}
	{placeholder}
	{helperText}
	{invalid}
	{invalidText}
	{disabled}
	{required}
	{hideLabel}
	size={carbonSize}
	{name}
	{autocomplete}
	{id}
	{hidePasswordLabel}
	{showPasswordLabel}
	{tooltipAlignment}
	{tooltipPosition}
	bind:value
	on:input={(e) => onInput?.(readTarget(e))}
	on:change={(e) => onChange?.(readTarget(e))}
	on:blur={() => onBlur?.()}
/>
