<!--
	PR-5 DeviceDrillPanel — Flying-Squirrel device drill-down.
	Renders whenever rfVisualization.selectedDeviceId is set. Shows obs count,
	RSSI range + mean, first/last seen, and ellipse dimensions.
-->
<script lang="ts">
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';

	interface ObsStats {
		count: number;
		minDbm: number;
		maxDbm: number;
		meanDbm: number;
		firstSeenTs: number;
		lastSeenTs: number;
	}

	type FeatProps = { dbm?: number | null; timestamp?: number | null };
	interface Acc {
		min: number;
		max: number;
		sum: number;
		dbmCount: number;
		firstTs: number;
		lastTs: number;
	}

	/**
	 * Skip observations whose `dbm` is missing/non-finite — defaulting them
	 * to 0 would bias `min`, `max`, and the mean. Timestamps are folded
	 * independently so an observation with a valid `ts` but no `dbm` still
	 * contributes to firstSeen/lastSeen.
	 */
	function foldProps(acc: Acc, props: FeatProps): Acc {
		const rawDbm = props.dbm;
		const rawTs = props.timestamp;
		const next: Acc = { ...acc };

		if (typeof rawDbm === 'number' && Number.isFinite(rawDbm)) {
			next.min = Math.min(acc.min, rawDbm);
			next.max = Math.max(acc.max, rawDbm);
			next.sum = acc.sum + rawDbm;
			next.dbmCount = acc.dbmCount + 1;
		}
		if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
			next.firstTs = Math.min(acc.firstTs, rawTs);
			next.lastTs = Math.max(acc.lastTs, rawTs);
		}
		return next;
	}

	function statsFromFeatures(): ObsStats | null {
		const feats = rfVisualization.selectedObservations.features;
		if (feats.length === 0) return null;
		const seed: Acc = {
			min: Infinity,
			max: -Infinity,
			sum: 0,
			dbmCount: 0,
			firstTs: Infinity,
			lastTs: -Infinity
		};
		const a = feats.reduce((acc, f) => foldProps(acc, (f.properties ?? {}) as FeatProps), seed);
		const meanDbm = a.dbmCount > 0 ? a.sum / a.dbmCount : Number.NaN;
		return {
			count: feats.length,
			minDbm: a.min,
			maxDbm: a.max,
			meanDbm,
			firstSeenTs: a.firstTs,
			lastSeenTs: a.lastTs
		};
	}

	const stats = $derived(statsFromFeatures());
	const ellipse = $derived(rfVisualization.selectedEllipse);

	function fmtTs(ts: number): string {
		if (!Number.isFinite(ts)) return '—';
		return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
	}

	function fmtM(m: number): string {
		if (!Number.isFinite(m)) return '—';
		return m < 1000 ? `${m.toFixed(1)}m` : `${(m / 1000).toFixed(2)}km`;
	}

	function clearSelection(): void {
		rfVisualization.setSelectedDevice(null);
	}
</script>

{#if rfVisualization.selectedDeviceId}
	<div class="drill-panel">
		<div class="dp-head">
			<span class="dp-label">DEVICE</span>
			<button type="button" class="dp-close" onclick={clearSelection} aria-label="close"
				>×</button
			>
		</div>
		<div class="dp-id">{rfVisualization.selectedDeviceId}</div>

		{#if stats}
			<div class="dp-grid">
				<div class="dp-cell">
					<span class="k">obs</span><span class="v">{stats.count}</span>
				</div>
				<div class="dp-cell">
					<span class="k">RSSI</span>
					<span class="v">
						{stats.minDbm.toFixed(0)} / {stats.meanDbm.toFixed(0)} / {stats.maxDbm.toFixed(
							0
						)} dBm
					</span>
				</div>
				<div class="dp-cell">
					<span class="k">first</span>
					<span class="v">{fmtTs(stats.firstSeenTs)}</span>
				</div>
				<div class="dp-cell">
					<span class="k">last</span>
					<span class="v">{fmtTs(stats.lastSeenTs)}</span>
				</div>
			</div>
		{:else}
			<div class="dp-empty">no observations loaded</div>
		{/if}

		{#if ellipse}
			<div class="dp-grid">
				<div class="dp-cell">
					<span class="k">ellipse</span>
					<span class="v">{fmtM(ellipse.semiMajorM)} × {fmtM(ellipse.semiMinorM)}</span>
				</div>
				<div class="dp-cell">
					<span class="k">rotation</span>
					<span class="v">{ellipse.rotationDeg.toFixed(0)}°</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.drill-panel {
		display: flex;
		flex-direction: column;
		gap: 0.4em;
		padding: 0.55em 0.75em;
		font-family: 'Fira Code', ui-monospace, monospace;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.dp-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.dp-label {
		font-size: 0.68em;
		letter-spacing: 0.1em;
		color: var(--muted-foreground);
	}
	.dp-close {
		background: transparent;
		color: var(--muted-foreground);
		border: none;
		font-size: 1.1em;
		cursor: pointer;
		padding: 0 0.3em;
	}
	.dp-close:hover {
		color: var(--foreground);
	}
	.dp-id {
		font-size: 0.82em;
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dp-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.3em 0.55em;
	}
	.dp-cell {
		display: flex;
		flex-direction: column;
		gap: 0.05em;
	}
	.k {
		font-size: 0.62em;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
	}
	.v {
		font-size: 0.76em;
		color: var(--foreground);
	}
	.dp-empty {
		font-size: 0.72em;
		color: var(--muted-foreground);
	}
</style>
