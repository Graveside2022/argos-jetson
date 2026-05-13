<script lang="ts">
	import { RadioButton as CarbonRadioButton } from 'carbon-components-svelte';

	interface Props {
		checked?: boolean;
		disabled?: boolean;
		required?: boolean;
		labelText: string;
		hideLabel?: boolean;
		labelPosition?: 'right' | 'left';
		name?: string;
		id?: string;
		value: string | number;
		class?: string;
		onChange?: (event: Event) => void;
	}

	let {
		checked = $bindable(false),
		disabled = false,
		required = false,
		labelText,
		hideLabel = false,
		labelPosition = 'right',
		name,
		id,
		value,
		class: className,
		onChange
	}: Props = $props();
</script>

<CarbonRadioButton
	bind:checked
	{disabled}
	{required}
	{labelText}
	{hideLabel}
	{labelPosition}
	{name}
	{id}
	{value}
	class={className}
	on:change={(e) => onChange?.(e)}
/>
