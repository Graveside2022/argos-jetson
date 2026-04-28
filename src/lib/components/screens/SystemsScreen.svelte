<script lang="ts">
	import Dot from '$lib/components/mk2/Dot.svelte';
	import { type SystemsTab, systemsTabStore } from '$lib/state/systems.svelte';
	import type { SystemInfo } from '$lib/types/system';

	import HardwareTab from './systems/HardwareTab.svelte';
	import HostMetricsTab from './systems/HostMetricsTab.svelte';
	import NetworkTab from './systems/NetworkTab.svelte';
	import ProcessesTab from './systems/ProcessesTab.svelte';
	import ServicesTab from './systems/ServicesTab.svelte';

	const POLL_HEADER_MS = 5000;

	interface ServicesResponse {
		healthy_count: number;
		total_count: number;
	}

	let info = $state<SystemInfo | null>(null);
	let healthyCount = $state(0);
	let totalCount = $state(0);
	let headerError = $state<string | null>(null);
	let firstHeaderSampleArrived = $state(false);
	let seq = 0;

	type ScreenState = 'loading' | 'default' | 'error';
	const screenState = $derived<ScreenState>(
		!firstHeaderSampleArrived ? 'loading' : headerError !== null ? 'error' : 'default'
	);

	const TABS: ReadonlyArray<{ id: SystemsTab; label: string }> = [
		{ id: 'host', label: 'HOST METRICS' },
		{ id: 'hw', label: 'HARDWARE' },
		{ id: 'proc', label: 'PROCESSES' },
		{ id: 'svc', label: 'SERVICES' },
		{ id: 'net', label: 'NETWORK' }
	];

	function svcCount(): number | string {
		return totalCount > 0 ? totalCount : '—';
	}

	function netCount(): number | string {
		const wifi = info?.wifiInterfaces;
		return wifi ? wifi.length : '—';
	}

	function tabCount(id: SystemsTab): number | string {
		if (id === 'host') return 4;
		if (id === 'svc') return svcCount();
		if (id === 'net') return netCount();
		return '—';
	}

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

	async function applyHeader(infoRes: Response, svcRes: Response): Promise<void> {
		info = (await infoRes.json()) as SystemInfo;
		const json: ServicesResponse = await svcRes.json();
		healthyCount = json.healthy_count;
		totalCount = json.total_count;
		headerError = null;
	}

	function recordHeaderError(err: unknown): void {
		if (err instanceof Error && err.name === 'AbortError') return;
		headerError = err instanceof Error ? err.message : String(err);
		console.warn('[SystemsScreen] header poll failed:', headerError);
	}

	async function fetchHeader(signal: AbortSignal): Promise<void> {
		const mySeq = ++seq;
		try {
			const [infoRes, svcRes] = await Promise.all([
				fetch('/api/system/info', { signal }),
				fetch('/api/system/services', { signal })
			]);
			if (!infoRes.ok) throw new Error(`info ${infoRes.status}`);
			if (!svcRes.ok) throw new Error(`services ${svcRes.status}`);
			if (mySeq === seq) await applyHeader(infoRes, svcRes);
		} catch (err) {
			recordHeaderError(err);
		} finally {
			firstHeaderSampleArrived = true;
		}
	}

	$effect(() => {
		const ctrl = new AbortController();
		void fetchHeader(ctrl.signal);
		const id = window.setInterval(() => void fetchHeader(ctrl.signal), POLL_HEADER_MS);
		return () => {
			window.clearInterval(id);
			ctrl.abort();
		};
	});

	function selectTab(id: SystemsTab): void {
		systemsTabStore.value = id;
	}
</script>

<div class="sys-screen" data-state={screenState}>
	<header class="sys-head">
		<div class="sys-head-left">
			<div class="eyebrow mono">SYSTEMS OVERVIEW</div>
			<div class="host">
				<span class="host-name">{info?.hostname ?? 'argos-host'}</span>
				<span class="host-meta mono">
					{#if info?.distro && info?.kernel}
						{info.distro} · kernel {info.kernel}
					{:else if info?.kernel}
						kernel {info.kernel}
					{:else}
						—
					{/if}
				</span>
			</div>
		</div>
		<div class="sys-head-right">
			{#if screenState === 'loading'}
				<span class="stat mono" aria-live="polite">
					<Dot kind="inactive" label="loading" /> LOADING…
				</span>
			{:else if screenState === 'error'}
				<span class="stat mono" role="alert">
					<Dot kind="err" label="header stale" /> HEADER STALE — {headerError}
				</span>
			{:else}
				<span class="stat mono"
					><Dot kind="ok" label="uptime" /> UPTIME {info
						? fmtUptime(info.uptime)
						: '—'}</span
				>
				<span class="stat mono"
					><Dot kind="ok" label="load" /> LOAD {fmtLoad(info?.loadAvg)}</span
				>
				<span class="stat mono"
					><Dot kind="ok" label="ok services" /> {healthyCount} OK</span
				>
				<span class="stat mono">
					<Dot kind={warnCount > 0 ? 'warn' : 'inactive'} label="warn services" />
					{warnCount} WARN
				</span>
			{/if}
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
				<span class="sys-tab-count mono">{tabCount(tab.id)}</span>
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

	.sys-tab-count {
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-1);
		padding: 2px 5px;
		border: 1px solid var(--mk2-line-2);
		letter-spacing: 0.04em;
	}

	.sys-tab.active .sys-tab-count {
		color: var(--mk2-accent);
		border-color: var(--mk2-accent);
	}

	.sys-body {
		overflow: auto;
		flex: 1;
	}
</style>
