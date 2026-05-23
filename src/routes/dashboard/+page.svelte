<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import '$lib/styles/dashboard.css';

	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import DashboardShell from '$lib/components/dashboard/DashboardShell.svelte';
	import GpConfigView from '$lib/components/dashboard/globalprotect/GpConfigView.svelte';
	import PanelContainer from '$lib/components/dashboard/PanelContainer.svelte';
	import TakConfigView from '$lib/components/dashboard/tak/TakConfigView.svelte';
	import ReportsView from '$lib/components/dashboard/views/ReportsView.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import { activePanel, activeView } from '$lib/stores/dashboard/dashboard-store.svelte';
	import { uasStore } from '$lib/stores/dragonsync/uas-store.svelte';

	import { createDashboardServices } from './dashboard-services';
	import { handleDashboardKeydown } from './dashboard-shortcuts';
	import DashboardBottomPanel from './DashboardBottomPanel.svelte';
	import DashboardViewRouter from './DashboardViewRouter.svelte';
	import { createScanAutoSwap } from './scan-auto-swap';

	const FULL_WIDTH_VIEWS = new Set(['tak-config', 'globalprotect', 'gsm-evil']);
	let shellMode = $derived(
		activePanel.current === 'reports' || FULL_WIDTH_VIEWS.has(activeView.current)
			? ('full-width' as const)
			: ('sidebar' as const)
	);

	const services = createDashboardServices();

	// UAS scan auto-swap: starts→swap center to the UAS live-log view; stops→revert
	// to the last non-scan view. State machine + transitions live in the module;
	// only the reactive wiring stays here.
	const scanSwap = createScanAutoSwap();
	$effect(() => scanSwap.reconcile(uasStore.current.status, activeView.current));

	function goBackToMap() {
		activeView.set('map');
	}

	onMount(() => {
		if (!browser) return;
		void services.start();
	});

	onDestroy(() => services.stop());
</script>

<svelte:window onkeydown={handleDashboardKeydown} />

<DashboardShell mode={shellMode}>
	{#snippet sidebar()}
		{#if activeView.current === 'map' && activePanel.current !== 'reports'}
			<PanelContainer />
		{/if}
	{/snippet}

	{#snippet content()}
		<div class="dashboard-content">
			<DashboardViewRouter activeView={activeView.current} onBackToMap={goBackToMap} />
		</div>
	{/snippet}

	{#snippet fullWidth()}
		{#if activePanel.current === 'reports'}
			<ReportsView />
		{:else if activeView.current === 'tak-config'}
			<TakConfigView />
		{:else if activeView.current === 'globalprotect'}
			<GpConfigView />
		{:else if activeView.current === 'gsm-evil'}
			<ToolViewWrapper title="GSM Evil" onBack={goBackToMap}>
				<iframe src="/gsm-evil" title="GSM Evil" class="tool-iframe"></iframe>
			</ToolViewWrapper>
		{/if}
	{/snippet}

	{#snippet bottomPanel()}
		<DashboardBottomPanel />
	{/snippet}
</DashboardShell>

<style>
	@import './dashboard-page.css';
</style>
