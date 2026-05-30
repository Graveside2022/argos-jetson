<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @audit-svelte-no-at-html-tags 2026-05-05 — uiIcons.* are hard-coded SVG string literals from $lib/data/tool-icons.ts; rule disabled for this file via config/eslint.config.js files-pattern override; no user input vector. -->
<script lang="ts">
	import { uiIcons } from '$lib/data/tool-icons';
	import {
		breadcrumbs,
		navigateBack,
		toolNavigationPath
	} from '$lib/stores/dashboard/tools-store.svelte';

	let canGoBack = $derived(toolNavigationPath.current.length > 0);
	let currentBreadcrumbs = $derived(breadcrumbs.current);
	let currentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 1] || 'TOOLS');
	let parentTitle = $derived(currentBreadcrumbs[currentBreadcrumbs.length - 2] || 'TOOLS');
</script>

<header class="panel-header">
	{#if canGoBack}
		<button class="back-btn" onclick={navigateBack}>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
			{@html uiIcons.arrowLeft}
			<span class="back-label">{parentTitle}</span>
		</button>
	{/if}
	<span class="panel-title">{currentTitle}</span>
</header>

<style>
	.panel-header {
		padding: var(--cds-spacing-04) var(--cds-spacing-05);
		border-bottom: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--cds-spacing-03);
	}

	.panel-title {
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--cds-text-secondary);
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: var(--cds-spacing-03);
		background: var(--cds-layer-hover);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		color: var(--cds-link-primary);
		font-size: 0.6875rem;
		cursor: pointer;
		padding: var(--cds-spacing-02) var(--cds-spacing-04);
		transition: all 0.15s ease;
		width: fit-content;
	}

	.back-btn:hover {
		background: var(--cds-layer);
		border-color: var(--cds-link-primary);
		color: var(--cds-text-primary);
	}

	.back-btn :global(svg) {
		flex-shrink: 0;
	}

	.back-label {
		letter-spacing: 0.025em;
		font-weight: 500;
	}
</style>
