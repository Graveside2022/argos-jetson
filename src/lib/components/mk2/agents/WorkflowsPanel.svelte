<script lang="ts">
	import { Accordion, AccordionItem } from 'carbon-components-svelte';

	import type { DockMode } from '$lib/components/chassis/DockShell.svelte';
	import Tag from '$lib/components/chassis/forms/Tag.svelte';
	import { type Workflow, WORKFLOW_CATEGORIES, type WorkflowCategory } from '$lib/types/agents';

	interface Props {
		workflows: readonly Workflow[];
		dock?: DockMode;
		onDock?: (next: DockMode) => void;
		onRun?: (name: string) => void;
	}

	const { workflows, dock = 'right', onDock, onRun }: Props = $props();

	const grouped = $derived<Record<WorkflowCategory, Workflow[]>>(
		WORKFLOW_CATEGORIES.reduce(
			(acc, cat) => {
				acc[cat] = workflows.filter((w) => w.cat === cat);
				return acc;
			},
			{} as Record<WorkflowCategory, Workflow[]>
		)
	);

	const total = $derived(workflows.length);

	const dockChips = [
		{ id: 'left' as const, glyph: '◧', label: 'Dock left' },
		{ id: 'top' as const, glyph: '⬒', label: 'Dock top' },
		{ id: 'bottom' as const, glyph: '⬓', label: 'Dock bottom' },
		{ id: 'right' as const, glyph: '◨', label: 'Dock right' }
	];
</script>

<section class="wf-panel" aria-label="Workflows">
	<header class="wf-head">
		<div class="wf-title">
			<span class="wf-tag">WRK-03</span>
			<span class="wf-name">WORKFLOWS</span>
			<span class="wf-meta">{total} SAVED</span>
		</div>
		<div class="wf-dock-chips" role="group" aria-label="Dock controls">
			{#each dockChips as chip (chip.id)}
				<button
					type="button"
					class="wf-dock-chip"
					class:active={dock === chip.id}
					onclick={() => onDock?.(chip.id)}
					aria-label={chip.label}
					aria-pressed={dock === chip.id}
					title={chip.label}
				>
					{chip.glyph}
				</button>
			{/each}
			<button
				type="button"
				class="wf-dock-chip"
				onclick={() => onDock?.('hidden')}
				aria-label="Hide panel"
				title="Hide panel"
			>
				×
			</button>
		</div>
	</header>

	<div class="wf-cats">
		<Accordion size="sm" align="start">
			{#each WORKFLOW_CATEGORIES as cat (cat)}
				{@const items = grouped[cat] ?? []}
				{#if items.length > 0}
					<AccordionItem
						title={`${cat} · ${items.length}`}
						open={cat === 'RECON' || cat === 'GSM/SDR' || cat === 'BLUE-TEAM'}
					>
						{#each items as wf (wf.name)}
							<div class="wf-row">
								<div class="wf-row-info">
									<div class="wf-name-row">{wf.name}</div>
									<div class="wf-desc">{wf.desc}</div>
									<div class="wf-step-meta">{wf.steps} STEPS · {wf.last}</div>
								</div>
								{#if wf.hot}
									<Tag type="green" size="sm">RUN</Tag>
								{/if}
								<button
									type="button"
									class="wf-run-btn"
									onclick={() => onRun?.(wf.name)}
									aria-label={`Run ${wf.name}`}
									disabled={wf.steps === 0}
								>
									▶
								</button>
							</div>
						{/each}
					</AccordionItem>
				{/if}
			{/each}
		</Accordion>
	</div>
</section>

<style>
	.wf-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--mk2-bg);
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink);
	}

	.wf-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--mk2-bg-2);
		border-bottom: 1px solid var(--mk2-line);
	}

	.wf-title {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.wf-tag {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-accent);
		letter-spacing: 0.12em;
	}

	.wf-name {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.1em;
	}

	.wf-meta {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-3);
		letter-spacing: 0.06em;
	}

	.wf-dock-chips {
		display: flex;
		gap: 2px;
	}

	.wf-dock-chip {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--mk2-ink-3);
		border: 1px solid var(--mk2-line-2);
		font-size: 12px;
		cursor: pointer;
	}

	.wf-dock-chip.active,
	.wf-dock-chip:hover {
		color: var(--mk2-accent);
		border-color: var(--mk2-accent);
	}

	.wf-cats {
		flex: 1;
		overflow: auto;
	}

	.wf-row {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 6px 0;
		border-bottom: 1px solid var(--mk2-line);
	}

	.wf-row:last-child {
		border-bottom: 0;
	}

	.wf-row-info {
		flex: 1;
		min-width: 0;
	}

	.wf-name-row {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink);
		letter-spacing: 0.02em;
	}

	.wf-desc {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-3);
		margin-top: 3px;
	}

	.wf-step-meta {
		font-size: var(--mk2-fs-1);
		color: var(--mk2-ink-4);
		margin-top: 3px;
		letter-spacing: 0.04em;
	}

	.wf-run-btn {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--mk2-ink-3);
		border: 1px solid var(--mk2-line-2);
		cursor: pointer;
		font-size: 10px;
	}

	.wf-run-btn:hover:not(:disabled) {
		color: var(--mk2-accent);
		border-color: var(--mk2-accent);
	}

	.wf-run-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
