<script lang="ts">
	import { Loading as CarbonLoading } from 'carbon-components-svelte';

	interface Props {
		small?: boolean;
		active?: boolean;
		withOverlay?: boolean;
		description?: string;
		class?: string;
	}

	let {
		small = false,
		active = true,
		withOverlay = true,
		description = 'Loading',
		class: className
	}: Props = $props();
</script>

<CarbonLoading {small} {active} {withOverlay} {description} class={className} />
