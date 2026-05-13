<script lang="ts">
	import { NumberInput as CarbonNumberInput } from 'carbon-components-svelte';

	interface Props {
		value?: number | null;
		labelText: string;
		helperText?: string;
		placeholder?: string;
		min?: number;
		max?: number;
		step?: number;
		stepStartValue?: number;
		allowEmpty?: boolean;
		allowDecimal?: boolean;
		locale?: string;
		formatOptions?: Intl.NumberFormatOptions;
		hideSteppers?: boolean;
		disableWheel?: boolean;
		invalid?: boolean;
		invalidText?: string;
		warn?: boolean;
		warnText?: string;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		hideLabel?: boolean;
		size?: 'sm' | 'md' | 'lg';
		name?: string;
		id?: string;
		class?: string;
		onChange?: (value: number | null) => void;
		onBlur?: (value: number | null) => void;
		validate?: (raw: string, locale: string | undefined) => boolean | undefined;
	}

	let {
		value = $bindable(null),
		labelText,
		helperText = '',
		placeholder = '',
		min,
		max,
		step,
		stepStartValue,
		allowEmpty = false,
		allowDecimal = false,
		locale,
		formatOptions,
		hideSteppers = false,
		disableWheel = false,
		invalid = false,
		invalidText = '',
		warn = false,
		warnText = '',
		disabled = false,
		readonly = false,
		required = false,
		hideLabel = false,
		size = 'md',
		name,
		id,
		class: className,
		onChange,
		onBlur,
		validate
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : undefined);
</script>

<CarbonNumberInput
	bind:value
	{labelText}
	{helperText}
	{placeholder}
	{min}
	{max}
	{step}
	{stepStartValue}
	{allowEmpty}
	{allowDecimal}
	{locale}
	{formatOptions}
	{hideSteppers}
	{disableWheel}
	{invalid}
	{invalidText}
	{warn}
	{warnText}
	{disabled}
	{readonly}
	{required}
	{hideLabel}
	size={carbonSize}
	{name}
	{id}
	{validate}
	class={className}
	on:change={(e) => onChange?.(e.detail)}
	on:blur={(e) => onBlur?.(e.detail.value)}
/>
