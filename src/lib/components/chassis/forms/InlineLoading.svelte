<script lang="ts">
	import { InlineLoading as CarbonInlineLoading } from 'carbon-components-svelte';

	type Status = 'active' | 'inactive' | 'finished' | 'error';

	interface Props {
		status?: Status;
		description?: string;
		iconDescription?: string;
		successDelay?: number;
		class?: string;
		onSuccess?: () => void;
	}

	let {
		status = 'active',
		description,
		iconDescription,
		successDelay = 1500,
		class: className,
		onSuccess
	}: Props = $props();
</script>

<CarbonInlineLoading
	{status}
	{description}
	{iconDescription}
	{successDelay}
	class={className}
	on:success={() => onSuccess?.()}
/>
