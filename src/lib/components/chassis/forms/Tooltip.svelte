<script lang="ts">
	import { Tooltip as CarbonTooltip } from 'carbon-components-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		direction?: 'top' | 'right' | 'bottom' | 'left';
		align?: 'start' | 'center' | 'end';
		hideIcon?: boolean;
		iconDescription?: string;
		triggerText?: string;
		enterDelayMs?: number;
		leaveDelayMs?: number;
		tabindex?: number | string;
		tooltipId?: string;
		triggerId?: string;
		class?: string;
		children?: Snippet;
		onOpen?: () => void;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		direction = 'bottom',
		align = 'start',
		hideIcon = false,
		iconDescription = 'More information',
		triggerText = '',
		enterDelayMs = 100,
		leaveDelayMs = 300,
		tabindex = '0',
		tooltipId,
		triggerId,
		class: className,
		children,
		onOpen,
		onClose
	}: Props = $props();
</script>

<CarbonTooltip
	bind:open
	{direction}
	{align}
	{hideIcon}
	{iconDescription}
	{triggerText}
	{enterDelayMs}
	{leaveDelayMs}
	{tabindex}
	{tooltipId}
	{triggerId}
	class={className}
	on:open={() => onOpen?.()}
	on:close={() => onClose?.()}
>
	{@render children?.()}
</CarbonTooltip>
