<script lang="ts">
	import DrawerTable, { type Column } from './DrawerTableCarbon.svelte';

	// spec-024 PR3 T021 — Bluetooth drawer tab. Reorderable + sortable via DrawerTable.
	// Real wiring (/api/bluedragon/*) per memory `project_bluetooth_e2e_done.md` lands in PR5+.

	interface Row {
		mac: string;
		name: string;
		type: string;
		rssi: number;
		last: string;
	}

	const rows: readonly Row[] = [
		{
			mac: '7C:2E:BD:01:AA:F0',
			name: 'AirPods Pro',
			type: 'LE · audio',
			rssi: -58,
			last: '202451Z'
		},
		{ mac: 'A8:1B:5A:23:42:11', name: '—', type: 'LE · beacon', rssi: -72, last: '202448Z' },
		{
			mac: 'F0:08:D1:92:84:37',
			name: 'TILE-E0F8',
			type: 'LE · tracker',
			rssi: -81,
			last: '202440Z'
		},
		{
			mac: 'C8:69:CD:11:02:93',
			name: 'Garmin-InReach',
			type: 'CLASSIC',
			rssi: -76,
			last: '202430Z'
		}
	];

	const columns: readonly Column<Row>[] = [
		{ id: 'last', label: 'TIME STAMP', accessor: (r) => r.last, kind: 'time' },
		{ id: 'mac', label: 'MAC', accessor: (r) => r.mac, kind: 'id' },
		{ id: 'name', label: 'NAME', accessor: (r) => r.name, kind: 'text' },
		{ id: 'type', label: 'TYPE', accessor: (r) => r.type, kind: 'tag' },
		{ id: 'rssi', label: 'RSSI', accessor: (r) => r.rssi, kind: 'num' }
	];
</script>

<div class="drw-scroll">
	<DrawerTable storageKey="argos.drawer.bluetooth.cols" {columns} {rows} rowKey={(r) => r.mac}>
		{#snippet cell(r, col)}
			{#if col.id === 'last' || col.id === 'name' || col.id === 'type'}
				<span class="dim">{col.accessor(r) ?? ''}</span>
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

	.dim {
		color: var(--mk2-ink-3);
	}
</style>
