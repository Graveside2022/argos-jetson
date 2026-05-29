<!-- @audit-svelte-no-at-html-tags 2026-05-05 — uiIcons.* are hard-coded SVG string literals from $lib/data/tool-icons.ts; rule disabled for this file via config/eslint.config.js files-pattern override; no user input vector. -->
<script lang="ts">
	import { onnetCategory } from '$lib/data/onnet';
	import { countTools } from '$lib/data/tool-hierarchy';
	import { uiIcons } from '$lib/data/tool-icons';
	import { activePanel } from '$lib/stores/dashboard/dashboard-store.svelte';
	import { toolNavigationPath } from '$lib/stores/dashboard/tools-store.svelte';

	function handleBack() {
		activePanel.set('tools');
		toolNavigationPath.set([]);
	}

	function handleCategoryClick(categoryId: string) {
		activePanel.set('tools');
		toolNavigationPath.set(['onnet', categoryId]);
	}
</script>

<div class="onnet-panel">
	<header class="panel-header">
		<button class="back-btn" onclick={handleBack}>
			<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
			{@html uiIcons.arrowLeft}
			<span class="back-label">TOOLS</span>
		</button>
		<span class="panel-title">ONNET</span>
	</header>

	<div class="cards-container">
		{#each onnetCategory.children as category (category.id)}
			{@const counts =
				'children' in category ? countTools(category) : { installed: 0, total: 0 }}
			<button class="category-card" onclick={() => handleCategoryClick(category.id)}>
				<div class="card-header">
					<span class="card-name">{category.name}</span>
					<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — Static hardcoded SVG icon string from tool-icons.ts, no user input -->
					<div class="chevron">{@html uiIcons.chevronRight}</div>
				</div>
				{#if 'description' in category && category.description}
					<p class="card-description">{category.description}</p>
				{/if}
				<div class="card-meta">
					<span class="tool-count">{counts.installed} / {counts.total} tools</span>
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	.onnet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--cds-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
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
		gap: var(--space-2);
		background: var(--cds-layer-hover);
		border: 1px solid var(--cds-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--cds-link-primary);
		font-size: 0.6875rem;
		cursor: pointer;
		padding: var(--space-1) var(--space-3);
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
		color: var(--cds-link-primary);
	}

	.cards-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.category-card {
		padding: 8px 12px;
		background: var(--cds-background);
		border: none;
		border-bottom: 1px solid var(--cds-border-subtle);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-card:hover {
		border-color: var(--cds-link-primary);
		background: var(--cds-layer-hover);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.card-name {
		flex: 1;
		font-family: var(--cds-code-01-font-family);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--cds-text-primary);
	}

	.chevron {
		flex-shrink: 0;
		color: var(--cds-text-helper);
	}

	.chevron :global(svg) {
		display: block;
	}

	.card-description {
		font-size: 0.6875rem;
		color: var(--cds-text-helper);
		line-height: 1.4;
		margin: 0;
	}

	.card-meta {
		font-size: 0.6875rem;
		color: var(--cds-text-helper);
	}

	.tool-count {
		font-family: var(--cds-code-01-font-family);
		font-variant-numeric: tabular-nums;
	}
</style>
