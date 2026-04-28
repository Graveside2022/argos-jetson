<script lang="ts">
	import type { Mk2Tool, Mk2ToolPillar } from '$lib/types/mk2-tool';

	import {
		actionLabel,
		activateTool,
		type ArrowKey,
		getFocusables,
		isArrowKey,
		pickArrowTarget,
		pickTabTarget
	} from './tools-flyout-focus';
	import ToolsFlyoutDetail from './ToolsFlyoutDetail.svelte';
	import ToolsFlyoutHeader from './ToolsFlyoutHeader.svelte';
	import ToolsFlyoutTile from './ToolsFlyoutTile.svelte';

	// spec-024 PR8 T046 — Tools Flyout (⌘K launcher).
	// Phase 3 PR B2-full (2026-04-28) — restructured to match JSX prototype:
	// pillar tab bar (one visible) + tree (left) + detail (right) + keybind footer.
	// Header / Detail / Tile / focus helpers extracted to keep parent under 300 LOC.

	interface Props {
		open: boolean;
		catalog: readonly Mk2Tool[];
		onClose: () => void;
	}

	let { open, catalog, onClose }: Props = $props();

	const PILLARS: readonly Mk2ToolPillar[] = ['OFFNET', 'ONNET', 'OSINT'];

	let query = $state('');
	let pillar = $state<Mk2ToolPillar>('OFFNET');
	let selectedToolId = $state<string | null>(null);
	let flyoutEl = $state<HTMLDivElement | null>(null);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return catalog;
		return catalog.filter(
			(t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
		);
	});

	// Query non-empty → search flat across all pillars (matches JSX prototype).
	const visibleTools = $derived(
		query.trim() === '' ? filtered.filter((t) => t.pillar === pillar) : filtered
	);

	const pillarCounts = $derived.by(() => {
		const out: Record<Mk2ToolPillar, number> = { OFFNET: 0, ONNET: 0, OSINT: 0 };
		for (const t of catalog) out[t.pillar]++;
		return out;
	});

	const selectedTool = $derived(
		selectedToolId ? (visibleTools.find((t) => t.id === selectedToolId) ?? null) : null
	);

	$effect(() => {
		if (!open) {
			query = '';
			selectedToolId = null;
		}
	});

	$effect(() => {
		if (visibleTools.length === 0) {
			selectedToolId = null;
			return;
		}
		const stillValid =
			selectedToolId !== null && visibleTools.some((t) => t.id === selectedToolId);
		if (!stillValid) selectedToolId = visibleTools[0].id;
	});

	function activate(t: Mk2Tool): void {
		if (t.action.kind === 'unwired') return;
		activateTool(t);
		onClose();
	}

	function trapTab(e: KeyboardEvent): void {
		const target = pickTabTarget(getFocusables(flyoutEl), document.activeElement, e.shiftKey);
		if (!target) return;
		target.focus();
		e.preventDefault();
	}

	function handleArrow(e: KeyboardEvent, key: ArrowKey): void {
		const result = pickArrowTarget(visibleTools, PILLARS, selectedToolId, pillar, key);
		if (result.toolId) selectedToolId = result.toolId;
		if (result.pillar) {
			pillar = result.pillar;
			selectedToolId = null;
		}
		e.preventDefault();
	}

	function doClose(e: KeyboardEvent): void {
		e.preventDefault();
		onClose();
	}

	function doActivate(e: KeyboardEvent): void {
		if (!selectedTool) return;
		e.preventDefault();
		activate(selectedTool);
	}

	function routeKey(e: KeyboardEvent): void {
		if (e.key === 'Escape') return doClose(e);
		if (e.key === 'Enter') return doActivate(e);
		if (isArrowKey(e.key)) return handleArrow(e, e.key);
		if (e.key === 'Tab') trapTab(e);
	}

	function onKeydown(e: KeyboardEvent): void {
		if (open) routeKey(e);
	}

	function pickPillar(p: Mk2ToolPillar): void {
		pillar = p;
		selectedToolId = null;
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="overlay">
		<button type="button" class="backdrop" aria-label="Close tools" onclick={onClose}></button>
		<div
			bind:this={flyoutEl}
			class="flyout"
			role="dialog"
			aria-modal="true"
			aria-label="Tools library"
		>
			<ToolsFlyoutHeader total={catalog.length} bind:query {open} {onClose} />

			<nav class="pillars" role="tablist" aria-label="Tool pillars">
				{#each PILLARS as p (p)}
					<button
						type="button"
						class="pillar-tab"
						class:active={pillar === p}
						role="tab"
						aria-selected={pillar === p}
						onclick={() => pickPillar(p)}
					>
						<span class="pillar-name">{p}</span>
						<span class="pillar-count">{pillarCounts[p]}</span>
					</button>
				{/each}
			</nav>

			<div class="body">
				<div class="tree" role="listbox" aria-label="{pillar} tools">
					{#if visibleTools.length === 0}
						<div class="empty">NO MATCHES</div>
					{:else}
						{#each visibleTools as tool (tool.id)}
							<ToolsFlyoutTile
								{tool}
								selected={selectedToolId === tool.id}
								showCrumb={query.trim() !== ''}
								hint={actionLabel(tool)}
								onSelect={(id) => (selectedToolId = id)}
								onActivate={activate}
							/>
						{/each}
					{/if}
				</div>
				<ToolsFlyoutDetail tool={selectedTool} {actionLabel} onActivate={activate} />
			</div>

			<footer class="foot">
				<span class="kbd">↑↓</span><span class="hint">NAVIGATE</span>
				<span class="kbd">⏎</span><span class="hint">OPEN</span>
				<span class="kbd">←→</span><span class="hint">PILLAR</span>
				<span class="kbd">ESC</span><span class="hint">CLOSE</span>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 80px 24px 24px;
		z-index: 1000;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		background: var(--overlay-backdrop);
		backdrop-filter: blur(2px);
		border: 0;
		padding: 0;
		cursor: pointer;
		z-index: 0;
	}
	.flyout {
		position: relative;
		z-index: 1;
		width: min(1100px, 100%);
		max-height: calc(100vh - 120px);
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink-2);
	}
	.pillars {
		display: flex;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
	}
	.pillar-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 14px;
		background: transparent;
		border: 0;
		border-right: 1px solid var(--mk2-line);
		color: var(--mk2-ink-4);
		font: inherit;
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		cursor: pointer;
		text-transform: uppercase;
	}
	.pillar-tab:last-child {
		border-right: 0;
	}
	.pillar-tab:hover {
		color: var(--mk2-ink-2);
	}
	.pillar-tab.active {
		color: var(--mk2-ink);
		border-bottom: 1px solid var(--mk2-accent);
		margin-bottom: -1px;
	}
	.pillar-count {
		color: var(--mk2-ink-3);
	}
	.body {
		display: grid;
		grid-template-columns: 1fr 360px;
		min-height: 0;
	}
	.tree {
		overflow-y: auto;
		border-right: 1px solid var(--mk2-line);
	}
	.empty {
		padding: 40px;
		text-align: center;
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		border-top: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
	}
	.kbd {
		padding: 1px 6px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-2);
		font-size: var(--mk2-fs-1);
	}
	.hint {
		letter-spacing: 0.1em;
		margin-right: 6px;
	}
</style>
