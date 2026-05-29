<!--
  Captures panel — bottom panel tab content showing captured RF signals.
  Displays a minimal table with Frequency, Power, Location, Time, Duration columns.
  Data fetched from /api/signals endpoint.
-->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Custom table layout tightly coupled to signal data shape; shadcn Table component incompatible with fixed-width column spec -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import PanelEmptyState from '$lib/components/ui/PanelEmptyState.svelte';
	import { fetchJSON } from '$lib/utils/fetch-json';

	let gsmStatus: 'stopped' | 'starting' | 'running' | 'stopping' = $state('stopped');
	let gsmBusy = $state(false);

	function gsmControlRequest(action: 'start' | 'stop' | 'status'): globalThis.RequestInit {
		return {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ action })
		};
	}

	// fetchJSON returns null on network/HTTP/parse failure (it checks res.ok), so
	// an error body is never read as a valid status (F6).
	async function fetchGsmStatus(): Promise<void> {
		const data = await fetchJSON<{ isRunning?: boolean }>(
			'/api/gsm-evil/control',
			gsmControlRequest('status')
		);
		gsmStatus = data?.isRunning ? 'running' : 'stopped';
	}

	// fallow-ignore-next-line complexity
	async function sendGsmControl(action: 'start' | 'stop'): Promise<void> {
		gsmBusy = true;
		gsmStatus = action === 'start' ? 'starting' : 'stopping';
		const data = await fetchJSON<{ success?: boolean }>(
			'/api/gsm-evil/control',
			gsmControlRequest(action)
		);
		gsmStatus = data?.success ? (action === 'start' ? 'running' : 'stopped') : 'stopped';
		gsmBusy = false;
	}

	interface Signal {
		id: string;
		frequency: number;
		power: number;
		lat: number;
		lon: number;
		timestamp: number;
		source: string;
	}

	let signals: Signal[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	// fallow-ignore-next-line complexity
	async function fetchSignals(): Promise<void> {
		try {
			const res = await fetch('/api/signals?limit=100', { credentials: 'same-origin' });
			if (!res.ok) {
				error = `Failed to fetch signals: ${res.status}`;
				return;
			}
			const data = await res.json();
			signals = data.signals ?? [];
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	function formatFrequency(hz: number): string {
		if (hz >= 1_000_000_000) return `${(hz / 1_000_000_000).toFixed(3)} GHz`;
		if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(3)} MHz`;
		if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
		return `${hz} Hz`;
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
	}

	function formatCoords(lat: number, lon: number): string {
		if (!lat && !lon) return '—';
		return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}

	function powerClass(dbm: number): string {
		if (dbm >= -30) return 'power-strong';
		if (dbm >= -60) return 'power-moderate';
		if (dbm >= -80) return 'power-weak';
		return 'power-none';
	}

	onMount(() => {
		if (!browser) return;
		void fetchSignals();
		void fetchGsmStatus();
		const interval = setInterval(() => void fetchSignals(), 10_000);
		return () => clearInterval(interval);
	});
</script>

<div class="captures-panel">
	<div class="captures-toolbar">
		<span class="captures-title">IMSI CAPTURE</span>
		<span
			class="gsm-chip"
			class:chip-running={gsmStatus === 'running'}
			class:chip-transition={gsmStatus === 'starting' || gsmStatus === 'stopping'}
			>{gsmStatus.toUpperCase()}</span
		>
		<span class="europe-tag">Europe only</span>
		<span class="spacer"></span>
		<span class="captures-count">{signals.length} signals</span>
		{#if gsmStatus === 'running'}
			<button
				class="scan-btn scan-stop"
				onclick={() => sendGsmControl('stop')}
				disabled={gsmBusy}
			>
				{gsmBusy ? 'Stopping…' : 'Stop'}
			</button>
		{:else}
			<button
				class="scan-btn scan-start"
				onclick={() => sendGsmControl('start')}
				disabled={gsmBusy}
			>
				{gsmBusy ? 'Starting…' : 'Start'}
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="captures-empty">
			<p class="empty-title">Loading captures...</p>
		</div>
	{:else if error}
		<div class="captures-empty">
			<p class="empty-title">Error loading captures</p>
			<p class="empty-sub">{error}</p>
		</div>
	{:else if signals.length === 0}
		<PanelEmptyState
			title="No captures recorded"
			description="Start a scan to begin capturing signals"
		/>
	{:else}
		<div class="captures-table">
			<div class="table-header">
				<span class="col col-freq">FREQUENCY</span>
				<span class="col col-power">POWER</span>
				<span class="col col-loc">LOCATION</span>
				<span class="col col-time">TIME</span>
				<span class="col col-source">SOURCE</span>
			</div>
			<div class="table-body">
				{#each signals as signal (signal.id)}
					<div class="table-row">
						<span class="col col-freq">{formatFrequency(signal.frequency)}</span>
						<span class="col col-power {powerClass(signal.power)}"
							>{signal.power.toFixed(1)} dBm</span
						>
						<span class="col col-loc">{formatCoords(signal.lat, signal.lon)}</span>
						<span class="col col-time">{formatTime(signal.timestamp)}</span>
						<span class="col col-source">{signal.source}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.captures-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		font-family: var(--cds-code-01-font-family);
	}

	.captures-toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 12px;
		height: 36px;
		min-height: 36px;
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.captures-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--cds-text-helper);
		letter-spacing: 1.5px;
	}

	.spacer {
		flex: 1;
	}

	.captures-count {
		font-size: 14px;
		color: var(--cds-text-helper);
	}

	.captures-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 4px;
	}

	.empty-title {
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 14px;
		color: var(--cds-text-helper);
		margin: 0;
	}

	.empty-sub {
		font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
		font-size: 12px;
		color: var(--cds-text-helper);
		margin: 0;
	}

	.captures-table {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
	}

	.table-header {
		display: flex;
		align-items: center;
		padding: 6px 12px;
		background: var(--cds-background);
		border-bottom: 1px solid var(--cds-border-subtle);
		font-size: 13px;
		font-weight: 600;
		color: var(--cds-text-helper);
	}

	.table-body {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.table-row {
		display: flex;
		align-items: center;
		padding: 5px 12px;
		font-size: 16px;
		color: var(--cds-text-primary);
		border-bottom: 1px solid var(--cds-border-subtle);
	}

	.table-row:hover {
		background: var(--cds-layer-hover);
	}

	.col-freq {
		width: 120px;
		flex-shrink: 0;
	}

	.col-power {
		width: 80px;
		flex-shrink: 0;
	}

	.col-loc {
		width: 160px;
		flex-shrink: 0;
	}

	.col-time {
		width: 100px;
		flex-shrink: 0;
		color: var(--cds-text-helper);
	}

	.col-source {
		width: 80px;
		flex-shrink: 0;
		color: var(--cds-text-helper);
	}

	.power-strong {
		color: var(--cds-support-success);
	}

	.power-moderate {
		color: var(--cds-link-primary);
	}

	.power-weak {
		color: var(--cds-support-warning);
	}

	.power-none {
		color: var(--cds-text-helper);
	}

	.gsm-chip {
		padding: 2px 8px;
		border-radius: 3px;
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.8px;
		background: var(--cds-layer-hover);
		color: var(--cds-text-helper);
	}

	.gsm-chip.chip-running {
		background: var(--cds-support-success);
		color: var(--cds-background);
	}

	.gsm-chip.chip-transition {
		background: var(--cds-support-warning);
		color: var(--cds-background);
	}

	.europe-tag {
		font-family: var(--cds-code-01-font-family);
		font-size: 12px;
		color: var(--cds-text-helper);
		letter-spacing: 0.5px;
		opacity: 0.7;
	}

	.scan-btn {
		padding: 4px 14px;
		font-family: var(--cds-code-01-font-family);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.8px;
		border: 1px solid var(--cds-border-subtle);
		border-radius: 3px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.scan-start {
		background: color-mix(in srgb, var(--cds-support-success) 20%, var(--cds-layer));
		color: var(--cds-support-success);
		border-color: color-mix(in srgb, var(--cds-support-success) 40%, var(--cds-border-subtle));
	}

	.scan-start:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-support-success) 30%, var(--cds-layer));
	}

	.scan-stop {
		background: color-mix(in srgb, var(--cds-support-error) 20%, var(--cds-layer));
		color: var(--cds-support-error);
		border-color: color-mix(in srgb, var(--cds-support-error) 40%, var(--cds-border-subtle));
	}

	.scan-stop:hover:not(:disabled) {
		background: color-mix(in srgb, var(--cds-support-error) 30%, var(--cds-layer));
	}

	.scan-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
