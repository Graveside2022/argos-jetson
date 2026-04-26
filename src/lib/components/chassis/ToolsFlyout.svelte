<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { tick } from 'svelte';

	import { goto } from '$app/navigation';
	import {
		drawerActiveStore,
		drawerOpenStore,
		type DrawerTab
	} from '$lib/state/ui.svelte';
	import type { Mk2Tool, Mk2ToolPillar } from '$lib/types/mk2-tool';

	import ToolsFlyoutTile from './ToolsFlyoutTile.svelte';

	// spec-024 PR8 T046 — Tools Flyout (⌘K launcher). 3-pillar grid,
	// live search, action dispatch. Parent owns `open` + ⌘K hotkey;
	// this component owns Esc + click-outside + search focus.

	interface Props {
		open: boolean;
		catalog: readonly Mk2Tool[];
		onClose: () => void;
	}

	let { open, catalog, onClose }: Props = $props();

	const PILLARS: readonly Mk2ToolPillar[] = ['OFFNET', 'ONNET', 'OSINT'];

	let query = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return catalog;
		return catalog.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q)
		);
	});

	function toolsByPillar(pillar: Mk2ToolPillar): readonly Mk2Tool[] {
		return filtered.filter((t) => t.pillar === pillar);
	}

	$effect(() => {
		if (!open) {
			query = '';
			return;
		}
		void tick().then(() => searchInput?.focus());
	});

	function onKeydown(e: KeyboardEvent): void {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function openDrawerAt(tab: DrawerTab): void {
		drawerOpenStore.value = true;
		drawerActiveStore.value = tab;
	}

	function activate(tool: Mk2Tool): void {
		const action = tool.action;
		if (action.kind === 'route') {
			void goto(action.href);
		} else if (action.kind === 'drawer') {
			openDrawerAt(action.tab);
		} else if (action.kind === 'external') {
			window.open(action.url, '_blank', 'noopener');
		}
		// `unwired` falls through with no side effect.
		onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="overlay">
		<button
			type="button"
			class="backdrop"
			aria-label="Close tools"
			onclick={onClose}
		></button>
		<div class="flyout" role="dialog" aria-modal="true" aria-label="Tools library">
			<header class="head">
				<div class="brand">TOOLS · LIBRARY</div>
				<div class="search">
					<Search size={14} />
					<input
						bind:this={searchInput}
						bind:value={query}
						type="search"
						placeholder="Search tools…"
						aria-label="Search tools"
						spellcheck="false"
						autocomplete="off"
					/>
				</div>
				<button type="button" class="close" onclick={onClose} aria-label="Close tools">
					<X size={14} />
				</button>
			</header>

			<div class="grid">
				{#each PILLARS as pillar (pillar)}
					{@const items = toolsByPillar(pillar)}
					<section class="pillar">
						<header class="pillar-head">
							<span class="pillar-name">{pillar}</span>
							<span class="pillar-count">{items.length}</span>
						</header>
						{#if items.length === 0}
							<div class="empty">—</div>
						{:else}
							<ul class="tiles">
								{#each items as tool (tool.id)}
									<li><ToolsFlyoutTile {tool} onActivate={activate} /></li>
								{/each}
							</ul>
						{/if}
					</section>
				{/each}
			</div>

			<footer class="foot">
				<span class="kbd">⌘K</span>
				<span class="hint">to toggle</span>
				<span class="sep">·</span>
				<span class="kbd">Esc</span>
				<span class="hint">to close</span>
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
		background: rgb(0 0 0 / 60%);
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
		display: flex;
		flex-direction: column;
		background: var(--mk2-bg-1);
		border: 1px solid var(--mk2-line);
		font-family: var(--mk2-f-mono);
		color: var(--mk2-ink-2);
	}

	.head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--mk2-line);
	}

	.brand {
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		color: var(--mk2-accent);
		text-transform: uppercase;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		background: var(--mk2-bg-2);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
	}

	.search input {
		flex: 1;
		background: transparent;
		border: 0;
		color: var(--mk2-ink-1);
		font: inherit;
		outline: none;
	}

	.close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		cursor: pointer;
	}

	.close:hover {
		color: var(--mk2-ink-1);
		border-color: var(--mk2-accent);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0;
		overflow-y: auto;
	}

	.pillar {
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--mk2-line);
	}

	.pillar:last-child {
		border-right: 0;
	}

	.pillar-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		font-size: var(--mk2-fs-2);
		letter-spacing: 0.12em;
		color: var(--mk2-ink-4);
		text-transform: uppercase;
		border-bottom: 1px solid var(--mk2-line);
	}

	.pillar-count {
		color: var(--mk2-ink-3);
	}

	.empty {
		padding: 20px 14px;
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-3);
	}

	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		border-top: 1px solid var(--mk2-line);
	}

	.kbd {
		padding: 1px 6px;
		background: var(--mk2-bg-2);
		border: 1px solid var(--mk2-line);
		color: var(--mk2-ink-2);
	}

	.sep {
		opacity: 0.5;
	}
</style>
