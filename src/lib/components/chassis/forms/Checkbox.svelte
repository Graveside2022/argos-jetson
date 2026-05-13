<script lang="ts">
	import { Checkbox as CarbonCheckbox } from 'carbon-components-svelte';

	interface Props {
		checked?: boolean;
		indeterminate?: boolean;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		labelText: string;
		hideLabel?: boolean;
		helperText?: string;
		title?: string;
		name?: string;
		id?: string;
		class?: string;
		onCheck?: (checked: boolean) => void;
	}

	let {
		checked = $bindable(false),
		indeterminate = false,
		disabled = false,
		required = false,
		readonly = false,
		labelText,
		hideLabel = false,
		helperText = '',
		title,
		name,
		id,
		class: className,
		onCheck
	}: Props = $props();
</script>

<CarbonCheckbox
	bind:checked
	{indeterminate}
	{disabled}
	{required}
	{readonly}
	{labelText}
	{hideLabel}
	{helperText}
	{title}
	{name}
	{id}
	class={className}
	on:check={(e) => onCheck?.(e.detail)}
/>
