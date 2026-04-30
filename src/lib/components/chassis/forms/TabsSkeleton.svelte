<script lang="ts">
	import { TabsSkeleton as CarbonTabsSkeleton } from 'carbon-components-svelte';

	interface Props {
		count?: number;
		type?: 'default' | 'container';
		class?: string;
	}

	let { count = 4, type = 'default', class: className }: Props = $props();
</script>

<CarbonTabsSkeleton {count} {type} class={className} />
