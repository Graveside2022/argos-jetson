<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { Button, Tag } from 'carbon-components-svelte';
	import ChevronLeft from 'carbon-icons-svelte/lib/ChevronLeft.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		status?: string;
		onBack: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let { title, status = '', onBack, children, actions }: Props = $props();
</script>

<div class="tool-view">
	<div class="tool-view-header">
		<Button kind="ghost" size="small" icon={ChevronLeft} iconDescription="Back" on:click={onBack}>
			Back
		</Button>
		<span class="tool-view-title">{title}</span>
		{#if status}
			<Tag type="green" size="sm">{status}</Tag>
		{/if}
		{#if actions}
			<div class="tool-view-actions">
				{@render actions()}
			</div>
		{/if}
	</div>
	<div class="tool-view-content">
		{@render children()}
	</div>
</div>

<style>
	.tool-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tool-view-header {
		height: 48px;
		min-height: 48px;
		display: flex;
		align-items: center;
		gap: var(--cds-spacing-04);
		padding: 0 var(--cds-spacing-05);
		background: var(--cds-layer);
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.tool-view-title {
		font-family: var(--cds-code-02-font-family);
		font-size: var(--cds-code-02-font-size);
		font-weight: 600;
		color: var(--cds-text-primary);
		letter-spacing: 1.5px;
	}

	.tool-view-actions {
		margin-left: auto;
	}

	.tool-view-content {
		flex: 1;
		overflow: hidden;
	}
</style>
