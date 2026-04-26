<script lang="ts">
	import type { Mk2Tool } from '$lib/types/mk2-tool';

	// spec-024 PR8 T046 — single tile inside ToolsFlyout's pillar column.
	// Pure presentational; parent owns activation + close lifecycle.

	interface Props {
		tool: Mk2Tool;
		onActivate: (tool: Mk2Tool) => void;
	}

	let { tool, onActivate }: Props = $props();

	const disabled = $derived(tool.action.kind === 'unwired');

	function actionHint(): string {
		const k = tool.action.kind;
		if (k === 'route') return 'OPEN';
		if (k === 'drawer') return 'DRAWER';
		if (k === 'external') return 'EXTERNAL ↗';
		return 'PENDING';
	}
</script>

<button
	type="button"
	class="tile"
	class:disabled
	{disabled}
	onclick={() => onActivate(tool)}
	aria-label={tool.name}
>
	<span class="tile-icon" aria-hidden="true">
		<tool.icon size={16} />
	</span>
	<span class="tile-body">
		<span class="tile-name">{tool.name}</span>
		<span class="tile-desc">{tool.description}</span>
	</span>
	<span class="tile-hint">{actionHint()}</span>
</button>

<style>
	.tile {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 14px;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--mk2-line);
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}

	.tile:hover:not(.disabled) {
		background: var(--mk2-bg-2);
	}

	.tile.disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.tile-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--mk2-accent);
	}

	.tile-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.tile-name {
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-desc {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-hint {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.08em;
		color: var(--mk2-ink-4);
		text-transform: uppercase;
	}
</style>
