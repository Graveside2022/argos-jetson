<script lang="ts">
	import { onMount } from 'svelte';

	import type { SystemInfo } from '$lib/types/system';

	import MetricCard from './MetricCard.svelte';
	import { bytesPerSecond, METRIC_WINDOW, pushSample } from './system-metrics-buffer';

	// spec-024 PR4 T024 + T025 — Mk II SYSTEMS host metrics tab.
	//
	// Polls /api/system/metrics on a 1.2 s cadence (matches prototype
	// `useRollingSeries` interval) for CPU%, MEMORY%, NETWORK MB/s, CORE TEMP°C
	// gauges, and /api/system/info on a 5 s cadence for the disk row (storage
	// + battery shape changes slowly so a fast poll is wasted bandwidth).
	//
	// Network throughput is derived client-side from cumulative byte counters
	// (the endpoint surfaces /proc/net/dev raw counts) — see
	// `bytesPerSecond()` in `system-metrics-buffer.ts`.
	//
	// PR4 ships single-root-mount disk display; multi-mount expansion lives in
	// PR5+ when /api/system/info gains a mounts[] field. The endpoint cap is
	// the constraint — not a UI shortcut.

	const POLL_METRICS_MS = 1200;
	const POLL_INFO_MS = 5000;
	const TEMP_ALARM_C = 85;
	const CPU_ALARM_PCT = 80;
	const DISK_HOT_PCT = 75;
	const BYTES_PER_GB = 1024 * 1024 * 1024;

	interface MetricsResponse {
		cpu: { usage: number; temperature?: number };
		memory: { percentage: number; used: number; total: number };
		disk: { percentage: number; used: number; total: number };
		network: { rx: number; tx: number; errors: number };
		timestamp: number;
	}

	let cpuSeries = $state<readonly number[]>([]);
	let memSeries = $state<readonly number[]>([]);
	let netSeries = $state<readonly number[]>([]);
	let tempSeries = $state<readonly number[]>([]);
	let lastNet = $state<{ rx: number; tx: number; t: number } | null>(null);
	let info = $state<SystemInfo | null>(null);
	let lastError = $state<string | null>(null);

	const cpuLast = $derived(cpuSeries.at(-1) ?? 0);
	const memLast = $derived(memSeries.at(-1) ?? 0);
	const netLast = $derived(netSeries.at(-1) ?? 0);
	const tempLast = $derived(tempSeries.at(-1) ?? 0);

	function deriveMbps(prev: typeof lastNet, curr: { rx: number; tx: number; t: number }): number {
		const prevSample = prev ? { bytes: prev.rx + prev.tx, t: prev.t } : null;
		return bytesPerSecond(prevSample, { bytes: curr.rx + curr.tx, t: curr.t });
	}

	async function fetchMetrics(): Promise<void> {
		try {
			const res = await fetch('/api/system/metrics');
			if (!res.ok) throw new Error(`metrics ${res.status}`);
			const m: MetricsResponse = await res.json();

			cpuSeries = pushSample(cpuSeries, m.cpu.usage, METRIC_WINDOW);
			memSeries = pushSample(memSeries, m.memory.percentage, METRIC_WINDOW);
			tempSeries = pushSample(tempSeries, m.cpu.temperature ?? 0, METRIC_WINDOW);

			const sample = { rx: m.network.rx, tx: m.network.tx, t: m.timestamp };
			netSeries = pushSample(netSeries, deriveMbps(lastNet, sample), METRIC_WINDOW);
			lastNet = sample;
			lastError = null;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
	}

	async function fetchInfo(): Promise<void> {
		try {
			const res = await fetch('/api/system/info');
			if (!res.ok) throw new Error(`info ${res.status}`);
			info = (await res.json()) as SystemInfo;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
	}

	onMount(() => {
		void fetchMetrics();
		void fetchInfo();
		const a = window.setInterval(fetchMetrics, POLL_METRICS_MS);
		const b = window.setInterval(fetchInfo, POLL_INFO_MS);
		return () => {
			window.clearInterval(a);
			window.clearInterval(b);
		};
	});

	function fmtPct(v: number): string {
		return `${v.toFixed(1)}%`;
	}

	function fmtMbps(v: number): string {
		return `${v.toFixed(1)} MB/s`;
	}

	function fmtTemp(v: number): string {
		return `${v.toFixed(1)}°C`;
	}

	function fmtGb(bytes: number): string {
		return `${(bytes / BYTES_PER_GB).toFixed(1)}`;
	}

	const cpuAlarm = $derived(cpuLast > CPU_ALARM_PCT);
	const tempAlarm = $derived(tempLast > TEMP_ALARM_C);
</script>

<div class="host-tab">
	<div class="metric-grid">
		<MetricCard
			label="CPU"
			value={fmtPct(cpuLast)}
			sub="{info?.cpu.model ?? '—'} · {info?.cpu.cores ?? '—'} cores"
			series={cpuSeries}
			color={cpuAlarm ? 'var(--mk2-red)' : 'var(--mk2-accent)'}
			alarm={cpuAlarm}
			ariaLabel="CPU usage trend"
		/>
		<MetricCard
			label="MEMORY"
			value={fmtPct(memLast)}
			sub={info ? `${fmtGb(info.memory.used)} / ${fmtGb(info.memory.total)} GB` : '—'}
			series={memSeries}
			color="var(--mk2-cyan)"
			ariaLabel="Memory usage trend"
		/>
		<MetricCard
			label="NETWORK"
			value={fmtMbps(netLast)}
			sub="rx+tx primary iface · errors {lastNet ? '0' : '—'}"
			series={netSeries}
			color="var(--mk2-green)"
			ariaLabel="Network throughput trend"
		/>
		<MetricCard
			label="CORE TEMP"
			value={fmtTemp(tempLast)}
			sub="thermal_zone0"
			series={tempSeries}
			color={tempAlarm ? 'var(--mk2-red)' : 'var(--mk2-amber)'}
			alarm={tempAlarm}
			ariaLabel="Core temperature trend"
		/>
	</div>

	<section class="disk-section">
		<header class="section-h">DISK USAGE</header>
		{#if info}
			{@const pct = info.storage.percentage}
			{@const hot = pct > DISK_HOT_PCT}
			<div class="disk-row">
				<div class="disk-label">
					<span class="mono name">/</span>
					<span class="mono meta">root mount · ext4</span>
				</div>
				<div class="disk-bar"><div class="disk-fill" class:hot style:width={`${pct}%`}></div></div>
				<div class="disk-vals mono">
					<span class:hot>{fmtGb(info.storage.used)} GB</span>
					<span class="meta"> / {fmtGb(info.storage.total)} GB</span>
					<span class="meta pct">{pct.toFixed(1)}%</span>
				</div>
			</div>
		{:else}
			<p class="empty mono">awaiting first sample…</p>
		{/if}
	</section>

	{#if lastError}
		<p class="err mono" role="alert">last poll error: {lastError}</p>
	{/if}
</div>

<style>
	.host-tab {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 14px;
		font: 500 var(--mk2-fs-3) / 1.3 var(--mk2-f-sans);
		color: var(--mk2-ink);
	}

	.mono {
		font-family: var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--mk2-line);
		border-top: 1px solid var(--mk2-line);
		border-bottom: 1px solid var(--mk2-line);
	}

	.disk-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section-h {
		font: 500 var(--mk2-fs-2) / 1 var(--mk2-f-mono);
		letter-spacing: 0.14em;
		color: var(--mk2-ink-4);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--mk2-line);
		text-transform: uppercase;
	}

	.disk-row {
		display: grid;
		grid-template-columns: 220px 1fr 200px;
		gap: 12px;
		align-items: center;
	}

	.disk-label {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.disk-label .name {
		color: var(--mk2-ink);
	}

	.disk-label .meta {
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-2);
	}

	.disk-bar {
		height: 6px;
		background: var(--mk2-bg);
		border: 1px solid var(--mk2-line);
		position: relative;
		overflow: hidden;
	}

	.disk-fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: var(--mk2-accent);
	}

	.disk-fill.hot {
		background: var(--mk2-red);
	}

	.disk-vals {
		font-size: var(--mk2-fs-3);
		text-align: right;
		color: var(--mk2-ink-2);
	}

	.disk-vals .hot {
		color: var(--mk2-red);
	}

	.disk-vals .meta {
		color: var(--mk2-ink-4);
	}

	.disk-vals .pct {
		margin-left: 8px;
	}

	.empty {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-ink-4);
	}

	.err {
		font-size: var(--mk2-fs-2);
		color: var(--mk2-red);
	}
</style>
