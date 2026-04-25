<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';

	import {
		DRAWER_TABS,
		drawerActiveStore,
		drawerHeightStore,
		drawerOpenStore,
		type DrawerTab
	} from '$lib/state/ui.svelte';

	import { clampDrawerHeight } from './drawer-clamp';
	import BluetoothTab from './drawer-tabs/BluetoothTab.svelte';
	import CapturesTab from './drawer-tabs/CapturesTab.svelte';
	import LogsTab from './drawer-tabs/LogsTab.svelte';
	import TerminalTab from './drawer-tabs/TerminalTab.svelte';
	import UasTab from './drawer-tabs/UasTab.svelte';
	import WifiTab from './drawer-tabs/WifiTab.svelte';

	// spec-024 PR3 T019 — Mk II bottom drawer.
	// Six fixed-order tabs (drag-reorder deferred to PR9 / T051). Click an
	// inactive tab to switch; click the already-active tab to collapse the
	// drawer. Drag the top edge to resize. Height clamps to
	// max(120, innerHeight - 200) so the main stage always keeps ≥ 200 px and
	// the tab strip itself can never be smaller than the 120-px floor.

	const COLLAPSED_HEIGHT = 30;

	const TAB_LABEL: Record<DrawerTab, string> = {
		terminal: 'TERMINAL',
		logs: 'LOGS',
		captures: 'CAPTURES',
		wifi: 'WI-FI',
		bluetooth: 'BLUETOOTH',
		uas: 'UAS'
	};

	$effect(() => {
		if (typeof window === 'undefined') return;
		const apply = () => {
			drawerHeightStore.value = clampDrawerHeight(drawerHeightStore.value, window.innerHeight);
		};
		apply();
		window.addEventListener('resize', apply);
		return () => window.removeEventListener('resize', apply);
	});

	function onTabClick(tab: DrawerTab): void {
		if (!drawerOpenStore.value) {
			drawerOpenStore.value = true;
			drawerActiveStore.value = tab;
			return;
		}
		if (drawerActiveStore.value === tab) {
			drawerOpenStore.value = false;
		} else {
			drawerActiveStore.value = tab;
		}
	}

	function onChevronClick(): void {
		drawerOpenStore.value = !drawerOpenStore.value;
	}

	// Resize: pointer-driven drag on the top handle. Clamps live to the same
	// formula as the persisted clamp so the drag feel matches the floor.
	function startResize(e: PointerEvent): void {
		e.preventDefault();
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';

		const onMove = (ev: PointerEvent) => {
			const proposed = window.innerHeight - ev.clientY - 22;
			drawerHeightStore.value = clampDrawerHeight(proposed, window.innerHeight);
		};
		const onUp = () => {
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}
</script>

<div
	class="drawer"
	class:open={drawerOpenStore.value}
	style:height={drawerOpenStore.value
		? `${drawerHeightStore.value}px`
		: `${COLLAPSED_HEIGHT}px`}
>
	{#if drawerOpenStore.value}
		<div
			class="handle"
			role="separator"
			aria-orientation="horizontal"
			aria-label="Resize drawer"
			tabindex="-1"
			onpointerdown={startResize}
		>
			<div class="grip" aria-hidden="true"></div>
		</div>
	{/if}

	<div class="tabs">
		{#each DRAWER_TABS as tab, i (tab)}
			{@const isActive = drawerOpenStore.value && drawerActiveStore.value === tab}
			<button
				type="button"
				class="tab"
				class:active={isActive}
				aria-pressed={isActive}
				onclick={() => onTabClick(tab)}
			>
				<span class="num">{String(i + 1).padStart(2, '0')}</span>
				<span class="label">{TAB_LABEL[tab]}</span>
			</button>
		{/each}
		<div class="spacer"></div>
		<button
			type="button"
			class="chev"
			aria-label={drawerOpenStore.value ? 'Collapse drawer' : 'Expand drawer'}
			title={drawerOpenStore.value ? 'Collapse' : 'Expand'}
			onclick={onChevronClick}
		>
			{#if drawerOpenStore.value}
				<ChevronDown size={12} />
			{:else}
				<ChevronUp size={12} />
			{/if}
		</button>
	</div>

	{#if drawerOpenStore.value}
		<div class="body">
			{#if drawerActiveStore.value === 'terminal'}
				<TerminalTab />
			{:else if drawerActiveStore.value === 'logs'}
				<LogsTab />
			{:else if drawerActiveStore.value === 'captures'}
				<CapturesTab />
			{:else if drawerActiveStore.value === 'wifi'}
				<WifiTab />
			{:else if drawerActiveStore.value === 'bluetooth'}
				<BluetoothTab />
			{:else if drawerActiveStore.value === 'uas'}
				<UasTab />
			{/if}
		</div>
	{/if}
</div>

<style>
	.drawer {
		border-top: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		display: flex;
		flex-direction: column;
		min-height: 30px;
		position: relative;
		flex: 0 0 auto;
	}

	.handle {
		position: absolute;
		left: 0;
		right: 0;
		top: -6px;
		height: 12px;
		cursor: ns-resize;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
	}

	.grip {
		width: 48px;
		height: 4px;
		background: var(--mk2-line-hi);
		border-top: 1px solid var(--mk2-line-2);
		border-bottom: 1px solid var(--mk2-line-2);
		opacity: 0.55;
		transition:
			opacity var(--mk2-mo-2),
			background var(--mk2-mo-2),
			width var(--mk2-mo-2);
	}

	.handle:hover .grip,
	.handle:active .grip {
		opacity: 1;
		background: var(--mk2-accent);
		width: 64px;
	}

	.tabs {
		display: flex;
		align-items: stretch;
		height: 30px;
		min-height: 30px;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.tab {
		appearance: none;
		background: transparent;
		color: var(--mk2-ink-3);
		border: 0;
		border-right: 1px solid var(--mk2-line);
		padding: 0 14px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		position: relative;
		user-select: none;
		font: inherit;
	}

	.tab:hover {
		color: var(--mk2-ink);
		background: var(--mk2-bg);
	}

	.tab.active {
		color: var(--mk2-ink);
		background: var(--mk2-bg);
	}

	.tab.active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: -1px;
		height: 1px;
		background: var(--mk2-accent);
	}

	.tab .num {
		color: var(--mk2-ink-4);
		font-weight: 400;
	}

	.tab.active .num {
		color: var(--mk2-accent);
	}

	.tab:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: -2px;
	}

	.spacer {
		flex: 1;
	}

	.chev {
		appearance: none;
		background: transparent;
		border: 0;
		border-left: 1px solid var(--mk2-line);
		color: var(--mk2-ink-3);
		cursor: pointer;
		padding: 0 12px;
		display: grid;
		place-items: center;
	}

	.chev:hover {
		color: var(--mk2-ink);
		background: var(--mk2-bg);
	}

	.chev:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: -2px;
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--mk2-bg);
		display: flex;
		flex-direction: column;
	}
</style>
