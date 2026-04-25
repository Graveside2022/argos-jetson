<script lang="ts">
	import Dot from '$lib/components/mk2/Dot.svelte';

	// spec-024 PR3 T021 — UAS drawer tab (static stub).
	// Hardcoded mock rows matching prototype. Real wiring to DragonSync SSE
	// (/api/dragonsync/*) lands per-screen in PR5+ — current UAS scan view
	// already exists at /uas (memory `project_uas_phase2_scan_view.md`).

	interface Row {
		id: string;
		make: string;
		lat: number;
		lon: number;
		alt: string;
		speed: string;
		rssi: number;
	}

	const rows: readonly Row[] = [
		{ id: '1581F6AFD204A0', make: 'DJI Mavic 3', lat: 50.04188, lon: 8.32712, alt: '128 m', speed: '11 m/s', rssi: -51 },
		{ id: '1581F6BB821E83', make: 'DJI Mini 3', lat: 50.04021, lon: 8.33094, alt: '62 m', speed: '4 m/s', rssi: -64 },
		{ id: '4E82AA01F3', make: 'Autel EVO II', lat: 50.04412, lon: 8.32201, alt: '204 m', speed: '18 m/s', rssi: -72 }
	];

	function rssiColor(rssi: number): string {
		if (rssi >= -55) return 'var(--mk2-accent)';
		return 'var(--mk2-ink)';
	}
</script>

<div class="drw-scroll">
	<div class="header">
		<Dot kind="warn" label="Scanning" pulse />
		<span class="status">SCANNING</span>
		<span class="meta">DJI · REMOTE-ID · 2.4/5.8 GHz</span>
		<span class="sep">·</span>
		<span class="meta">3 TRACKS</span>
	</div>
	<table class="tbl">
		<thead>
			<tr>
				<th>ID</th>
				<th>MAKE</th>
				<th>LAT</th>
				<th>LON</th>
				<th class="num">ALT</th>
				<th class="num">SPEED</th>
				<th class="num">RSSI</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i (`${r.id}-${i}`)}
				<tr>
					<td>{r.id}</td>
					<td class="dim">{r.make}</td>
					<td>{r.lat.toFixed(5)}</td>
					<td>{r.lon.toFixed(5)}</td>
					<td class="num">{r.alt}</td>
					<td class="num">{r.speed}</td>
					<td class="num" style:color={rssiColor(r.rssi)}>{r.rssi}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.drw-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.header {
		padding: 10px 14px;
		border-bottom: 1px solid var(--mk2-line);
		display: flex;
		gap: 12px;
		align-items: center;
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
	}

	.status {
		color: var(--mk2-ink);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.meta {
		color: var(--mk2-ink-3);
	}

	.sep {
		color: var(--mk2-ink-4);
	}

	.tbl {
		width: 100%;
		border-collapse: collapse;
		font: 500 var(--mk2-fs-3) / 1.4 var(--mk2-f-mono);
		font-variant-numeric: tabular-nums;
	}

	.tbl th {
		text-align: left;
		padding: 6px 12px;
		color: var(--mk2-ink-4);
		font-size: var(--mk2-fs-2);
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: var(--mk2-bg-2);
		border-bottom: 1px solid var(--mk2-line);
	}

	.tbl th.num {
		text-align: right;
	}

	.tbl td {
		padding: 6px 12px;
		border-bottom: 1px dashed var(--mk2-line);
		color: var(--mk2-ink);
	}

	.tbl td.num {
		text-align: right;
	}

	.tbl td.dim {
		color: var(--mk2-ink-3);
	}

	.tbl tr:hover td {
		background: var(--mk2-bg-2);
	}
</style>
