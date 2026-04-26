<script lang="ts">
	import { onMount } from 'svelte';

	import Dot from '$lib/components/mk2/Dot.svelte';
	import { type SystemsTab,systemsTabStore } from '$lib/state/systems.svelte';
	import type { SystemInfo } from '$lib/types/system';

	import HardwareTab from './systems/HardwareTab.svelte';
	import HostMetricsTab from './systems/HostMetricsTab.svelte';
	import NetworkTab from './systems/NetworkTab.svelte';
	import ProcessesTab from './systems/ProcessesTab.svelte';
	import ServicesTab from './systems/ServicesTab.svelte';

	// spec-024 PR4 T023 + T026 — Mk II SYSTEMS screen.
	//
	// Owns the host-overview header (hostname / kernel / uptime / load avg /
	// service health counts) and the 5-tab strip. The active tab persists via
	// `systemsTabStore` (lsState — see PR1 ui.svelte.ts) so reload restores
	// the operator's prior selection.
	//
	// Mounting strategy: this component is consumed by the chassis main slot
	// when `view === 'systems'`. The chassis itself is wired in PR5 (T034) —
	// PR4 ships the dormant component so the rail's bottom button has a real
	// destination once chassis mounts. Verified by file-scoped tooling +
	// mounted-into-test-render checks; live mount is PR5 surface.

	const POLL_HEADER_MS = 5000;

	interface ServicesResponse {
		healthy_count: number;
		total_count: number;
	}

	let info = $state<SystemInfo | null>(null);
	let healthyCount = $state(0);
	let totalCount = $state(0);

	const TABS: ReadonlyArray<{ id: SystemsTab; label: string }> = [
		{ id: 'host', label: 'HOST METRICS' },
		{ id: 'hw', label: 'HARDWARE' },
		{ id: 'proc', label: 'PROCESSES' },
		{ id: 'svc', label: 'SERVICES' },
		{ id: 'net', label: 'NETWORK' }
	];

	function fmtUptime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
	}

	function fmtLoad(load: [number, number, number] | undefined): string {
		if (!load) return '—';
		return load.map((n) => n.toFixed(2)).join(' / ');
	}

	const warnCount = $derived(Math.max(0, totalCount - healthyCount));

	async function fetchHeader(): Promise<void> {
		try {
			const [infoRes, svcRes] = await Promise.all([
				fetch('/api/system/info'),
				fetch('/api/system/services')
			]);
			if (infoRes.ok) info = (await infoRes.json()) as SystemInfo;
			if (svcRes.ok) {
				const json: ServicesResponse = await svcRes.json();
				healthyCount = json.healthy_count;
				totalCount = json.total_count;
			}
		} catch {
			// header is best-effort; per-tab components surface their own errors
		}
	}

	onMount(() => {
		void fetchHeader();
		const id = window.setInterval(fetchHeader, POLL_HEADER_MS);
		return () => window.clearInterval(id);
	});

	function selectTab(id: SystemsTab): void {
		systemsTabStore.value = id;
	}
</script>

<div class="sys-screen">
	<header class="sys-head">
		<div class="sys-head-left">
			<div class="eyebrow mono">SYSTEMS OVERVIEW</div>
			<div class="host">
				<span class="host-name">{info?.hostname ?? 'argos-host'}</span>
				<span class="host-meta mono">
					{info?.kernel ? `kernel ${info.kernel}` : '—'}
				</span>
			</div>
		</div>
		<div class="sys-head-right">
			<span class="stat mono"><Dot kind="ok" label="uptime" /> UPTIME {info ? fmtUptime(info.uptime) : '—'}</span>
			<span class="stat mono"><Dot kind="ok" label="load" /> LOAD {fmtLoad(info?.loadAvg)}</span>
			<span class="stat mono"><Dot kind="ok" label="ok services" /> {healthyCount} OK</span>
			<span class="stat mono">
				<Dot kind={warnCount > 0 ? 'warn' : 'inactive'} label="warn services" /> {warnCount} WARN
			</span>
		</div>
	</header>

	<nav class="sys-tabs" aria-label="Systems sections">
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				class="sys-tab"
				class:active={systemsTabStore.value === tab.id}
				aria-current={systemsTabStore.value === tab.id ? 'page' : undefined}
				onclick={() => selectTab(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="sys-body">
		{#if systemsTabStore.value === 'host'}<HostMetricsTab />{/if}
		{#if systemsTabStore.value === 'hw'}<HardwareTab />{/if}
		{#if systemsTabStore.value === 'proc'}<ProcessesTab />{/if}
		{#if systemsTabStore.value === 'svc'}<ServicesTab />{/if}
		{#if systemsTabStore.value === 'net'}<NetworkTab />{/if}
	</div>
</div>

<style>
	.sys-screen {
		height: 100%;
		background: var(--mk2-panel);
		display: flex;
		flex-direction: column;
		color: var(--mk2-ink);
		font-size: var(--mk2-fs-4);
		overflow: hidden;
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.sys-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 18px;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg-2);
		gap: 16px;
	}

	.sys-head-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.eyebrow {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.host {
		display: flex;
		gap: 8px;
		align-items: baseline;
		min-width: 0;
	}

	.host-name {
		font: 600 var(--mk2-fs-6) / 1.2 var(--mk2-f-sans);
		color: var(--mk2-ink);
	}

	.host-meta {
		font-size: var(--mk2-fs-4);
		color: var(--mk2-ink-4);
		font-weight: 400;
	}

	.sys-head-right {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.stat {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--mk2-fs-3);
		color: var(--mk2-ink-2);
		letter-spacing: 0.08em;
	}

	.sys-tabs {
		display: flex;
		border-bottom: 1px solid var(--mk2-line);
		background: var(--mk2-bg);
	}

	.sys-tab {
		padding: 10px 16px;
		background: transparent;
		border: 0;
		color: var(--mk2-ink-3);
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.14em;
		cursor: pointer;
		position: relative;
	}

	.sys-tab:hover {
		color: var(--mk2-ink);
	}

	.sys-tab.active {
		color: var(--mk2-accent);
	}

	.sys-tab.active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 1px;
		background: var(--mk2-accent);
	}

	.sys-tab:focus-visible {
		outline: 1px solid var(--mk2-accent);
		outline-offset: -2px;
	}

	.sys-body {
		overflow: auto;
		flex: 1;
	}
</style>
