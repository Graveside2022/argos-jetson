<!--
	Dashboard bottom panel. Extracted from +page.svelte so the page orchestrator
	no longer owns the resizable-panel wrapper, tab bar, lazy tab-mount tracking,
	and per-tab content rendering.

	Tabs are mounted lazily and kept alive once seen (mountedTabs): a tab's pane
	stays in the DOM after first activation so its state (terminal session, chat
	history) survives switching away — only `.tab-active` toggles visibility.
-->
<script lang="ts">
	import AgentChatPanel from '$lib/components/dashboard/AgentChatPanel.svelte';
	import LogsPanel from '$lib/components/dashboard/LogsPanel.svelte';
	import BluetoothPanel from '$lib/components/dashboard/panels/BluetoothPanel.svelte';
	import CapturesPanel from '$lib/components/dashboard/panels/CapturesPanel.svelte';
	import DevicesPanel from '$lib/components/dashboard/panels/DevicesPanel.svelte';
	import UASPanel from '$lib/components/dashboard/panels/UASPanel.svelte';
	import ResizableBottomPanel from '$lib/components/dashboard/ResizableBottomPanel.svelte';
	import TerminalPanel from '$lib/components/dashboard/TerminalPanel.svelte';
	import {
		activeBottomTab,
		bottomPanelHeight,
		isBottomPanelOpen,
		openBottomPanel,
		setBottomPanelHeight
	} from '$lib/stores/dashboard/dashboard-store';

	import BottomPanelTabs from './BottomPanelTabs.svelte';

	let mountedTabs = $state(new Set<string>());

	$effect(() => {
		const tab = $activeBottomTab;
		if (tab && !mountedTabs.has(tab)) {
			mountedTabs = new Set([...mountedTabs, tab]);
		}
	});
</script>

<!--
	ResizableBottomPanel wraps EVERYTHING (tab bar + content).
	- Drag handle is at the very top edge — intuitive "grab top to resize"
	- When collapsed: panel height = 0, but tab bar inside still shows via min-height
	- Tab bar always visible; chevron rotates ▼/▲ to show collapse state
-->
<ResizableBottomPanel
	isOpen={$isBottomPanelOpen}
	height={$bottomPanelHeight}
	onHeightChange={setBottomPanelHeight}
	onOpen={openBottomPanel}
>
	<!-- Tab bar sits inside the resizable panel, always rendered -->
	<BottomPanelTabs activeTab={$activeBottomTab} />

	<!-- Content area shown only when open -->
	<div class="bottom-panel-content">
		{#if mountedTabs.has('terminal')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'terminal'}>
				<TerminalPanel />
			</div>
		{/if}
		{#if mountedTabs.has('chat')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'chat'}>
				<AgentChatPanel />
			</div>
		{/if}
		{#if mountedTabs.has('logs')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'logs'}>
				<LogsPanel />
			</div>
		{/if}
		{#if mountedTabs.has('captures')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'captures'}>
				<CapturesPanel />
			</div>
		{/if}
		{#if mountedTabs.has('dashboard')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'dashboard'}>
				<DevicesPanel />
			</div>
		{/if}
		{#if mountedTabs.has('bluetooth')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'bluetooth'}>
				<BluetoothPanel />
			</div>
		{/if}
		{#if mountedTabs.has('uas')}
			<div class="tab-pane" class:tab-active={$activeBottomTab === 'uas'}>
				<UASPanel />
			</div>
		{/if}
	</div>
</ResizableBottomPanel>

<style>
	.bottom-panel-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.tab-pane {
		display: none;
		flex: 1;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}

	.tab-pane.tab-active {
		display: flex;
	}
</style>
