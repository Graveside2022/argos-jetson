<script lang="ts" module>
	export type Status = 'active' | 'inactive' | 'finished' | 'error';
</script>

<script lang="ts">
	import { InlineLoading as CarbonInlineLoading } from 'carbon-components-svelte';

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
