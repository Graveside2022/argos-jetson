<script lang="ts">
	import { RadioButtonGroup as CarbonRadioButtonGroup } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		selected?: string | number;
		disabled?: boolean;
		required?: boolean;
		name?: string;
		legendText?: string;
		hideLegend?: boolean;
		helperText?: string;
		labelPosition?: 'right' | 'left';
		orientation?: 'horizontal' | 'vertical';
		id?: string;
		class?: string;
		onSelectionChange?: (value: string | number) => void;
		children?: Snippet;
	}

	let {
		selected = $bindable(undefined),
		disabled = false,
		required = false,
		name,
		legendText = '',
		hideLegend = false,
		helperText = '',
		labelPosition = 'right',
		orientation = 'horizontal',
		id,
		class: className,
		onSelectionChange,
		children
	}: Props = $props();
</script>

<CarbonRadioButtonGroup
	bind:selected
	{disabled}
	{required}
	{name}
	{legendText}
	{hideLegend}
	{helperText}
	{labelPosition}
	{orientation}
	{id}
	class={className}
	on:change={(e) => onSelectionChange?.(e.detail)}
>
	{#if children}{@render children()}{/if}
</CarbonRadioButtonGroup>
