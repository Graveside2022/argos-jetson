<!--
	V3Shell — the NVIDIA-themed layout frame for the V3 UI (:5175). Stacks the
	utility-bar / primary-nav / breadcrumb chrome above a content slot, closed
	by the footer chapter. The V3 equivalent of V1's DashboardShell.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	import type { V3Crumb } from '$lib/types/v3';

	import V3Breadcrumb from './V3Breadcrumb.svelte';
	import V3Footer from './V3Footer.svelte';
	import V3PrimaryNav from './V3PrimaryNav.svelte';
	import V3UtilityBar from './V3UtilityBar.svelte';

	interface Props {
		breadcrumb?: V3Crumb[];
		children: Snippet;
	}

	let { breadcrumb = [], children }: Props = $props();
</script>

<div class="v3-shell">
	<header class="v3-shell__chrome">
		<V3UtilityBar />
		<V3PrimaryNav />
		{#if breadcrumb.length > 0}
			<V3Breadcrumb segments={breadcrumb} />
		{/if}
	</header>

	<main class="v3-shell__content">
		{@render children()}
	</main>

	<V3Footer />
</div>

<style>
	.v3-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: var(--background);
		color: var(--foreground);
	}
	.v3-shell__chrome {
		position: sticky;
		top: 0;
		z-index: 50;
	}
	.v3-shell__content {
		flex: 1;
		min-width: 0;
	}
</style>
