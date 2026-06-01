<!--
  Renders the dashboard center region for the active view, via the declarative
  registry in ./dashboard-views.ts. Replaces the ~25-branch {#if $activeView}
  chain previously inlined in +page.svelte.
-->
<script lang="ts">
	import ToolUnavailableView from '$lib/components/dashboard/views/ToolUnavailableView.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import type { ActiveView } from '$lib/types/dashboard-view';

	import { resolveViewEntry } from './dashboard-views';

	let { activeView, onBackToMap }: { activeView: ActiveView; onBackToMap: () => void } = $props();

	const entry = $derived(resolveViewEntry(activeView));
</script>

{#if entry.kind === 'component'}
	{#await entry.load()}
		<div class="view-loading">Loading…</div>
	{:then { default: View }}
		<View />
	{:catch}
		<div class="view-loading" role="alert">
			<p>View failed to load.</p>
			<button type="button" class="view-error-action" onclick={onBackToMap}
				>Back to map</button
			>
		</div>
	{/await}
{:else if entry.kind === 'iframe'}
	<ToolViewWrapper title={entry.title} onBack={onBackToMap}>
		<iframe src={entry.src} title={entry.title} class="tool-iframe"></iframe>
	</ToolViewWrapper>
{:else}
	<ToolUnavailableView title={entry.title} />
{/if}

<style>
	.view-loading {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		color: var(--cds-text-helper);
	}

	.view-error-action {
		font: inherit;
		padding: 6px 14px;
		color: var(--cds-text-primary);
		background: var(--cds-layer);
		border: 1px solid var(--cds-border-subtle);
		border-radius: 4px;
		cursor: pointer;
	}

	.view-error-action:hover {
		background: var(--cds-layer);
	}

	.tool-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--cds-background);
	}
</style>
