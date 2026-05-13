<script lang="ts">
	import type { Mk2Tool } from '$lib/types/mk2-tool';

	// spec-024 PR8 T046 / Phase 3 PR B2-full — single tool row inside ToolsFlyout's tree.
	// Hover or focus selects (caller updates selection); click activates.

	interface Props {
		tool: Mk2Tool;
		selected: boolean;
		showCrumb: boolean;
		hint: string;
		onSelect: (id: string) => void;
		onActivate: (tool: Mk2Tool) => void;
	}

	let { tool, selected, showCrumb, hint, onSelect, onActivate }: Props = $props();

	const disabled = $derived(tool.action.kind === 'unwired');
</script>

<button
	type="button"
	class="row"
	class:sel={selected}
	class:disabled
	role="option"
	aria-selected={selected}
	onmouseenter={() => onSelect(tool.id)}
	onfocus={() => onSelect(tool.id)}
	onclick={() => onActivate(tool)}
>
	<span class="icon" aria-hidden="true"><tool.icon size={14} /></span>
	<span class="name">{tool.name}</span>
	{#if showCrumb}
		<span class="crumb">{tool.pillar}</span>
	{/if}
	<span class="hint">{hint}</span>
</button>

<style>
	.row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 14px;
		background: transparent;
		border: 0;
		color: var(--mk2-ink-2);
		font: inherit;
		cursor: pointer;
		text-align: left;
		position: relative;
	}
	.row:hover {
		background: var(--mk2-bg-2);
		color: var(--mk2-ink);
	}
	.row.sel {
		background: var(--mk2-bg-2);
		color: var(--mk2-ink);
	}
	.row.sel::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--mk2-accent);
	}
	.row.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.icon {
		display: flex;
		align-items: center;
		color: var(--mk2-accent);
	}
	.name {
		font-size: var(--mk2-fs-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.crumb {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-4);
		letter-spacing: 0.12em;
	}
	.hint {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.08em;
		color: var(--mk2-ink-4);
		text-transform: uppercase;
	}
</style>
