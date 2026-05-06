<script lang="ts" module>
	export type DockMode = 'left' | 'right' | 'top' | 'bottom' | 'hidden';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		dock: DockMode;
		primary: Snippet;
		secondary: Snippet;
		secondarySize?: string;
		primaryLabel?: string;
		secondaryLabel?: string;
		class?: string;
	}

	const {
		dock,
		primary,
		secondary,
		secondarySize,
		primaryLabel = 'Primary panel',
		secondaryLabel = 'Secondary panel',
		class: className = ''
	}: Props = $props();

	const sizeStyle = $derived(secondarySize ? `--dock-secondary-size: ${secondarySize};` : '');
</script>

<div class={`dock-shell-root ${className}`.trim()} data-dock={dock} style={sizeStyle}>
	<section class="dock-primary" aria-label={primaryLabel}>
		{@render primary()}
	</section>
	{#if dock !== 'hidden'}
		<section class="dock-secondary" aria-label={secondaryLabel}>
			{@render secondary()}
		</section>
	{/if}
</div>

<style>
	.dock-shell-root {
		display: grid;
		width: 100%;
		height: 100%;
		gap: 0;
		position: relative;
	}

	.dock-shell-root[data-dock='right'] {
		grid-template-columns: 1fr var(--dock-secondary-size, clamp(240px, 28vw, 480px));
		grid-template-areas: 'primary secondary';
	}

	.dock-shell-root[data-dock='left'] {
		grid-template-columns: var(--dock-secondary-size, clamp(240px, 28vw, 480px)) 1fr;
		grid-template-areas: 'secondary primary';
	}

	.dock-shell-root[data-dock='top'] {
		grid-template-rows: var(--dock-secondary-size, clamp(160px, 30vh, 400px)) 1fr;
		grid-template-areas: 'secondary' 'primary';
	}

	.dock-shell-root[data-dock='bottom'] {
		grid-template-rows: 1fr var(--dock-secondary-size, clamp(160px, 30vh, 400px));
		grid-template-areas: 'primary' 'secondary';
	}

	.dock-shell-root[data-dock='hidden'] {
		grid-template: 'primary' 1fr / 1fr;
	}

	.dock-primary {
		grid-area: primary;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.dock-secondary {
		grid-area: secondary;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border-left: 1px solid var(--mk2-line);
	}

	.dock-shell-root[data-dock='left'] .dock-secondary {
		border-left: 0;
		border-right: 1px solid var(--mk2-line);
	}

	.dock-shell-root[data-dock='top'] .dock-secondary {
		border-left: 0;
		border-bottom: 1px solid var(--mk2-line);
	}

	.dock-shell-root[data-dock='bottom'] .dock-secondary {
		border-left: 0;
		border-top: 1px solid var(--mk2-line);
	}
</style>
