<script lang="ts">
	// spec-024 PR3 T021 — Logs drawer tab. Reorderable + sortable via DrawerTable.

	import DrawerTable, { type Column } from './DrawerTable.svelte';

	type Level = 'INFO' | 'WARN' | 'ERROR';

	interface Row {
		t: string;
		lvl: Level;
		src: string;
		m: string;
	}

	const rows: readonly Row[] = [
		{ t: '202455Z', lvl: 'INFO', src: 'kismet', m: 'wlan1 · 214 devices visible' },
		{ t: '202454Z', lvl: 'INFO', src: 'hackrf', m: 'sweep 24-1750 MHz · 80 Hz/bin' },
		{ t: '202453Z', lvl: 'WARN', src: 'gsm', m: 'ARFCN 62 drift +0.21 kHz · retune' },
		{ t: '202451Z', lvl: 'INFO', src: 'tak', m: 'CoT forwarded · 42 tracks' },
		{ t: '202450Z', lvl: 'INFO', src: 'gps', m: 'fix · 13 SV · PDOP 1.4' },
		{ t: '202449Z', lvl: 'ERROR', src: 'bettercap', m: 'arp.spoof module failed · iface busy' },
		{ t: '202448Z', lvl: 'INFO', src: 'agent', m: 'claude · recon-01 · tool call airodump-ng' },
		{
			t: '202447Z',
			lvl: 'INFO',
			src: 'kismet',
			m: 'new AP · E8:48:B8:2E:07:AA · kaserne-mesh'
		},
		{ t: '202446Z', lvl: 'WARN', src: 'thermal', m: 'jetson temp 54°C · fan ramp 62%' }
	];

	const lvlColor: Record<Level, string> = {
		INFO: 'var(--mk2-ink-3)',
		WARN: 'var(--mk2-amber)',
		ERROR: 'var(--mk2-red)'
	};

	const columns: readonly Column<Row>[] = [
		{ id: 't', label: 'TIME STAMP', accessor: (r) => r.t },
		{ id: 'm', label: 'MESSAGE', accessor: (r) => r.m },
		{ id: 'src', label: 'SOURCE', accessor: (r) => r.src },
		{ id: 'lvl', label: 'LEVEL', accessor: (r) => r.lvl }
	];
</script>

<div class="drw-scroll">
	<DrawerTable storageKey="argos.drawer.logs.cols" {columns} {rows} rowKey={(r) => r.t}>
		{#snippet cell(r, col)}
			{#if col.id === 'lvl'}
				<span class="lvl" style:color={lvlColor[r.lvl]}>{r.lvl}</span>
			{:else if col.id === 't'}
				<span class="dim-strong">{r.t}</span>
			{:else if col.id === 'src'}
				<span class="dim">{r.src}</span>
			{:else}
				<span class="ink">{r.m}</span>
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

	.lvl {
		font-weight: 600;
		letter-spacing: 0.06em;
	}

	.dim-strong {
		color: var(--mk2-ink-4);
		white-space: nowrap;
	}

	.dim {
		color: var(--mk2-ink-3);
		white-space: nowrap;
	}

	.ink {
		color: var(--mk2-ink);
	}
</style>
