<script lang="ts">
	import { Select as CarbonSelect } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		value?: string | number;
		labelText?: string;
		helperText?: string;
		invalid?: boolean;
		invalidText?: string;
		warn?: boolean;
		warnText?: string;
		disabled?: boolean;
		required?: boolean;
		hideLabel?: boolean;
		noLabel?: boolean;
		inline?: boolean;
		size?: 'sm' | 'md' | 'lg';
		name?: string;
		id?: string;
		class?: string;
		onChange?: (value: string | number | undefined) => void;
		children?: Snippet;
	}

	let {
		value = $bindable(undefined),
		labelText = '',
		helperText = '',
		invalid = false,
		invalidText = '',
		warn = false,
		warnText = '',
		disabled = false,
		required = false,
		hideLabel = false,
		noLabel = false,
		inline = false,
		size = 'md',
		name,
		id,
		class: className,
		onChange,
		children
	}: Props = $props();

	const carbonSize = $derived(size === 'sm' ? 'sm' : size === 'lg' ? 'xl' : undefined);
</script>

<CarbonSelect
	selected={value}
	{labelText}
	{helperText}
	{invalid}
	{invalidText}
	{warn}
	{warnText}
	{disabled}
	{required}
	{hideLabel}
	{noLabel}
	{inline}
	size={carbonSize}
	{name}
	{id}
	class={className}
	on:update={(e) => {
		value = e.detail;
		onChange?.(e.detail);
	}}
>
	{@render children?.()}
</CarbonSelect>
