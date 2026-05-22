<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import '$lib/styles/dashboard.css';

	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import AgentChatPanel from '$lib/components/dashboard/AgentChatPanel.svelte';
	import DashboardShell from '$lib/components/dashboard/DashboardShell.svelte';
	import GpConfigView from '$lib/components/dashboard/globalprotect/GpConfigView.svelte';
	import LogsPanel from '$lib/components/dashboard/LogsPanel.svelte';
	import PanelContainer from '$lib/components/dashboard/PanelContainer.svelte';
	import BluetoothPanel from '$lib/components/dashboard/panels/BluetoothPanel.svelte';
	import CapturesPanel from '$lib/components/dashboard/panels/CapturesPanel.svelte';
	import DevicesPanel from '$lib/components/dashboard/panels/DevicesPanel.svelte';
	import UASPanel from '$lib/components/dashboard/panels/UASPanel.svelte';
	import ResizableBottomPanel from '$lib/components/dashboard/ResizableBottomPanel.svelte';
	import TakConfigView from '$lib/components/dashboard/tak/TakConfigView.svelte';
	import TerminalPanel from '$lib/components/dashboard/TerminalPanel.svelte';
	import ReportsView from '$lib/components/dashboard/views/ReportsView.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import {
		activeBottomTab,
		activePanel,
		activeView,
		bottomPanelHeight,
		isBottomPanelOpen,
		openBottomPanel,
		setBottomPanelHeight
	} from '$lib/stores/dashboard/dashboard-store';
	import { uasStore } from '$lib/stores/dragonsync/uas-store';

	import BottomPanelTabs from './BottomPanelTabs.svelte';
	import { createDashboardServices } from './dashboard-services';
	import { handleDashboardKeydown } from './dashboard-shortcuts';
	import DashboardViewRouter from './DashboardViewRouter.svelte';
	import { createScanAutoSwap } from './scan-auto-swap';

	// spec-024 PR6 — Mk II is now its own URL space at /dashboard/mk2/*.
	// `?ui=mk2` redirects in +page.ts so this file is the legacy shell only.

	const FULL_WIDTH_VIEWS = new Set(['tak-config', 'globalprotect', 'gsm-evil']);
	let shellMode = $derived(
		$activePanel === 'reports' || FULL_WIDTH_VIEWS.has($activeView)
			? ('full-width' as const)
			: ('sidebar' as const)
	);

	const services = createDashboardServices();

	let mountedTabs = $state(new Set<string>());

	$effect(() => {
		const tab = $activeBottomTab;
		if (tab && !mountedTabs.has(tab)) {
			mountedTabs = new Set([...mountedTabs, tab]);
		}
	});

	// UAS scan auto-swap: starts→swap center to the UAS live-log view; stops→revert
	// to the last non-scan view. State machine + transitions live in the module;
	// only the reactive wiring stays here.
	const scanSwap = createScanAutoSwap();
	$effect(() => scanSwap.reconcile($uasStore.status, $activeView));

	function goBackToMap() {
		activeView.set('map');
	}

	onMount(() => {
		if (!browser) return;
		services.start();
	});

	onDestroy(() => services.stop());
</script>

<svelte:window onkeydown={handleDashboardKeydown} />

<DashboardShell mode={shellMode}>
	{#snippet sidebar()}
		{#if $activeView === 'map' && $activePanel !== 'reports'}
			<PanelContainer />
		{/if}
	{/snippet}

	{#snippet content()}
		<div class="dashboard-content">
			<DashboardViewRouter activeView={$activeView} onBackToMap={goBackToMap} />
		</div>
	{/snippet}

	{#snippet fullWidth()}
		{#if $activePanel === 'reports'}
			<ReportsView />
		{:else if $activeView === 'tak-config'}
			<TakConfigView />
		{:else if $activeView === 'globalprotect'}
			<GpConfigView />
		{:else if $activeView === 'gsm-evil'}
			<ToolViewWrapper title="GSM Evil" onBack={goBackToMap}>
				<iframe src="/gsm-evil" title="GSM Evil" class="tool-iframe"></iframe>
			</ToolViewWrapper>
		{/if}
	{/snippet}

	{#snippet bottomPanel()}
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
	{/snippet}
</DashboardShell>

<style>
	@import './dashboard-page.css';
</style>
