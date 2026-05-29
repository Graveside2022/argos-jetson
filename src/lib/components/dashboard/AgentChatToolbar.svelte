<!-- Agent chat toolbar — status badge and clear button -->
<script lang="ts">
	import Layers from 'carbon-icons-svelte/lib/Layers.svelte';
	import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';

	import TooltipIcon from '$lib/components/chassis/forms/TooltipIcon.svelte';

	interface Props {
		llmProvider: 'anthropic' | 'unavailable';
		isCheckingLLM: boolean;
		onClear: () => void;
	}

	let { llmProvider, isCheckingLLM, onClear }: Props = $props();
</script>

<div class="chat-toolbar">
	<div class="toolbar-left">
		<Layers size={16} class="agent-icon" />
		<span class="toolbar-title">Argos Agent</span>
		{#if !isCheckingLLM}
			<span class="llm-badge" class:online={llmProvider !== 'unavailable'}>
				{llmProvider === 'anthropic' ? 'Claude' : 'Offline'}
			</span>
		{/if}
	</div>
	<div class="toolbar-right">
		<TooltipIcon tooltipText="Clear chat" icon={TrashCan} onClick={onClear} />
	</div>
</div>

<style>
	.chat-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 36px;
		min-height: 36px;
		padding: 0 12px;
		background: var(--cds-layer);
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.agent-icon {
		color: var(--cds-link-primary);
	}

	.toolbar-title {
		color: var(--cds-text-primary);
		font-weight: 500;
	}

	.llm-badge {
		padding: 2px 8px;
		border-radius: 3px;
		background: var(--cds-border-subtle);
		color: var(--cds-text-helper);
		font-size: 11px;
		text-transform: uppercase;
	}

	.llm-badge.online {
		background: color-mix(in srgb, var(--cds-support-success) 20%, transparent);
		color: var(--cds-support-success);
	}

	.toolbar-right {
		display: flex;
		gap: 4px;
	}
</style>
