<!--
	V3Breadcrumb — NVIDIA breadcrumb-bar (DESIGN.md): 48px, soft surface,
	uppercase caption type, chevron separators in the mute tone.
-->
<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';

	import type { V3Crumb } from '$lib/types/v3';

	interface Props {
		segments?: V3Crumb[];
	}

	let { segments = [] }: Props = $props();
</script>

<nav class="v3-breadcrumb" aria-label="Breadcrumb">
	<ol class="v3-breadcrumb__list">
		{#each segments as crumb, i (crumb.label)}
			<li class="v3-breadcrumb__item">
				{#if crumb.href && i < segments.length - 1}
					<a class="v3-breadcrumb__link" href={crumb.href}>{crumb.label}</a>
				{:else}
					<span class="v3-breadcrumb__current" aria-current="page">{crumb.label}</span>
				{/if}
				{#if i < segments.length - 1}
					<span class="v3-breadcrumb__sep" aria-hidden="true">
						<ChevronRight size={14} />
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.v3-breadcrumb {
		display: flex;
		align-items: center;
		height: var(--v3-breadcrumb-h);
		padding: 0 var(--v3-space-xl);
		background: var(--v3-surface-soft);
		border-bottom: 1px solid var(--v3-hairline);
	}
	.v3-breadcrumb__list {
		display: flex;
		align-items: center;
		gap: var(--v3-space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.v3-breadcrumb__item {
		display: inline-flex;
		align-items: center;
		gap: var(--v3-space-xs);
		font-family: var(--v3-font-sans);
		font-size: var(--v3-text-caption);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.v3-breadcrumb__link {
		color: var(--foreground-tertiary);
		text-decoration: none;
	}
	.v3-breadcrumb__link:hover {
		color: var(--primary);
	}
	.v3-breadcrumb__current {
		color: var(--foreground);
	}
	.v3-breadcrumb__sep {
		display: inline-flex;
		color: var(--muted-foreground);
	}
</style>
