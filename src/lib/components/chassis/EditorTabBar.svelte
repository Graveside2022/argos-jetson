<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface EditorTab {
		id: string;
		title: string;
		icon?: Snippet;
	}
</script>

<script lang="ts">
	import Close from 'carbon-icons-svelte/lib/Close.svelte';
	import { tick } from 'svelte';

	import {
		buildItems,
		clampCursor,
		closeItemIdx,
		computeNextCursor,
		type RovingItem,
		tabItemIdx
	} from './editor-tab-bar-roving';

	interface Props {
		tabs: EditorTab[];
		activeId: string;
		onActivate: (id: string) => void;
		onClose?: (id: string) => void;
		ariaLabel?: string;
		trailing?: Snippet;
		class?: string;
	}

	let {
		tabs,
		activeId,
		onActivate,
		onClose,
		ariaLabel = 'Editor tabs',
		trailing,
		class: extraClass = ''
	}: Props = $props();

	let tabRefs: HTMLButtonElement[] = $state([]);
	let closeRefs: HTMLButtonElement[] = $state([]);
	let cursorIdx = $state(0);
	let userMoved = $state(false);

	const hasClose = $derived(typeof onClose === 'function');

	const items = $derived<RovingItem[]>(buildItems(tabs.length, hasClose));

	const activeItemIdx = $derived.by(() => {
		const idx = tabs.findIndex((t) => t.id === activeId);
		if (idx < 0) return 0;
		return tabItemIdx(idx, hasClose);
	});

	const effectiveCursor = $derived(userMoved ? cursorIdx : activeItemIdx);

	$effect(() => {
		const clamped = clampCursor(cursorIdx, items.length);
		if (clamped !== cursorIdx) cursorIdx = clamped;
	});

	function focusItem(idx: number): void {
		const item = items[idx];
		if (!item) return;
		const el = item.kind === 'tab' ? tabRefs[item.tabIdx] : closeRefs[item.tabIdx];
		el?.focus();
	}

	function moveCursor(next: number): void {
		userMoved = true;
		cursorIdx = next;
		void tick().then(() => focusItem(next));
	}

	function onToolbarKey(e: KeyboardEvent): void {
		const result = computeNextCursor(effectiveCursor, items.length, e.key);
		if (!result.handled) return;
		e.preventDefault();
		moveCursor(result.next);
	}

	function onTabKey(e: KeyboardEvent, id: string): void {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		onActivate(id);
	}

	function onCloseKey(e: KeyboardEvent, id: string): void {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		onClose?.(id);
	}

	function onTabClick(id: string, itemIdx: number): void {
		userMoved = true;
		cursorIdx = itemIdx;
		onActivate(id);
	}

	function onCloseClick(id: string, itemIdx: number): void {
		userMoved = true;
		cursorIdx = itemIdx;
		onClose?.(id);
	}
</script>

<div
	class="editor-tab-bar {extraClass}"
	role="toolbar"
	aria-label={ariaLabel}
	aria-orientation="horizontal"
	tabindex={-1}
	onkeydown={onToolbarKey}
>
	<div class="editor-tab-bar__roving">
		{#each tabs as tab, i (tab.id)}
			{@const tIdx = tabItemIdx(i, hasClose)}
			{@const cIdx = closeItemIdx(i, hasClose)}
			<button
				bind:this={tabRefs[i]}
				type="button"
				role="tab"
				aria-selected={tab.id === activeId}
				tabindex={tIdx === effectiveCursor ? 0 : -1}
				class="editor-tab-bar__tab"
				class:active={tab.id === activeId}
				onclick={() => onTabClick(tab.id, tIdx)}
				onkeydown={(e) => onTabKey(e, tab.id)}
			>
				{#if tab.icon}
					<span class="editor-tab-bar__icon" aria-hidden="true">{@render tab.icon()}</span
					>
				{/if}
				<span class="editor-tab-bar__title">{tab.title}</span>
			</button>
			{#if hasClose}
				<button
					bind:this={closeRefs[i]}
					type="button"
					tabindex={cIdx === effectiveCursor ? 0 : -1}
					aria-label={`Close ${tab.title}`}
					class="editor-tab-bar__close"
					onclick={() => onCloseClick(tab.id, cIdx)}
					onkeydown={(e) => onCloseKey(e, tab.id)}
				>
					<Close size={16} />
				</button>
			{/if}
		{/each}
	</div>
	{#if trailing}
		<div class="editor-tab-bar__trailing">
			{@render trailing()}
		</div>
	{/if}
</div>

<style>
	.editor-tab-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 32px;
		width: 100%;
	}

	.editor-tab-bar__roving {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.editor-tab-bar__tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 12px;
		background: transparent;
		color: var(--cds-text-helper);
		border: 0;
		border-radius: 4px 4px 0 0;
		font-weight: 500;
		font-size: var(--cds-label-01-font-size);
		line-height: 1;
		cursor: pointer;
	}

	.editor-tab-bar__tab:hover,
	.editor-tab-bar__tab.active {
		background: var(--cds-layer);
		color: var(--cds-text-primary);
	}

	.editor-tab-bar__tab:focus-visible,
	.editor-tab-bar__close:focus-visible {
		outline: 2px solid var(--cds-border-strong);
		outline-offset: -2px;
	}

	.editor-tab-bar__icon {
		display: inline-flex;
	}

	.editor-tab-bar__title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}

	.editor-tab-bar__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 2px;
		margin-left: -4px;
		background: transparent;
		color: var(--cds-text-helper);
		border: 0;
		border-radius: 4px;
		cursor: pointer;
	}

	.editor-tab-bar__close:hover {
		background: var(--cds-layer);
		color: var(--cds-text-primary);
	}

	.editor-tab-bar__trailing {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}
</style>
