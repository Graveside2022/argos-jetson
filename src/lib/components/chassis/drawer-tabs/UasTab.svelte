<script lang="ts">
	import Dot from '$lib/components/mk2/Dot.svelte';

	import DrawerTable, { type Column } from './DrawerTable.svelte';

	// spec-024 PR3 T021 — UAS drawer tab. Reorderable + sortable via DrawerTable.
	// Real wiring to DragonSync SSE (/api/dragonsync/*) lands per-screen in PR5+.

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
		{
			id: '1581F6AFD204A0',
			make: 'DJI Mavic 3',
			lat: 50.04188,
			lon: 8.32712,
			alt: '128 m',
			speed: '11 m/s',
			rssi: -51
		},
		{
			id: '1581F6BB821E83',
			make: 'DJI Mini 3',
			lat: 50.04021,
			lon: 8.33094,
			alt: '62 m',
			speed: '4 m/s',
			rssi: -64
		},
		{
			id: '4E82AA01F3',
			make: 'Autel EVO II',
			lat: 50.04412,
			lon: 8.32201,
			alt: '204 m',
			speed: '18 m/s',
			rssi: -72
		}
	];

	const columns: readonly Column<Row>[] = [
		{ id: 'id', label: 'ID', accessor: (r) => r.id },
		{ id: 'make', label: 'MAKE', accessor: (r) => r.make },
		{ id: 'lat', label: 'LAT', accessor: (r) => r.lat, isNum: true },
		{ id: 'lon', label: 'LON', accessor: (r) => r.lon, isNum: true },
		{ id: 'alt', label: 'ALT', accessor: (r) => r.alt, isNum: true },
		{ id: 'speed', label: 'SPEED', accessor: (r) => r.speed, isNum: true },
		{ id: 'rssi', label: 'RSSI', accessor: (r) => r.rssi, isNum: true }
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
	<DrawerTable storageKey="argos.drawer.uas.cols" {columns} {rows} rowKey={(r) => r.id}>
		{#snippet cell(r, col)}
			{#if col.id === 'make'}
				<span class="dim">{r.make}</span>
			{:else if col.id === 'lat'}
				{r.lat.toFixed(5)}
			{:else if col.id === 'lon'}
				{r.lon.toFixed(5)}
			{:else if col.id === 'rssi'}
				<span style:color={rssiColor(r.rssi)}>{r.rssi}</span>
			{:else}
				{col.accessor(r) ?? ''}
			{/if}
		{/snippet}
	</DrawerTable>
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

	.dim {
		color: var(--mk2-ink-3);
	}
</style>
