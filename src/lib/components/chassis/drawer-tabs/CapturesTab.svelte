<script lang="ts">
	import { Download } from '@lucide/svelte';

	import IconBtn from '$lib/components/mk2/IconBtn.svelte';

	import DrawerTable, { type Column } from './DrawerTable.svelte';

	// spec-024 PR3 T021 — Captures drawer tab. Reorderable + sortable via DrawerTable.

	interface Row {
		file: string;
		tool: string;
		size: string;
		packets: string;
		start: string;
		dur: string;
	}

	const rows: readonly Row[] = [
		{
			file: 'recon-sweep-202024.pcap',
			tool: 'tcpdump',
			size: '412 MB',
			packets: '1,482,921',
			start: '202024Z',
			dur: '4m 31s'
		},
		{
			file: 'gsm-harvest-202140.pcap',
			tool: 'grgsm',
			size: '28 MB',
			packets: '94,210',
			start: '202140Z',
			dur: '3m 12s'
		},
		{
			file: 'kismet-live.kismet',
			tool: 'kismet',
			size: '1.2 GB',
			packets: '—',
			start: '192033Z',
			dur: '54m'
		},
		{
			file: 'imsi-catalog-20240422.csv',
			tool: 'gsm-evil',
			size: '184 KB',
			packets: '412 rows',
			start: '202455Z',
			dur: '14m 38s'
		}
	];

	const columns: readonly Column<Row>[] = [
		{ id: 'start', label: 'TIME STAMP', accessor: (r) => r.start, isNum: true },
		{ id: 'file', label: 'FILE', accessor: (r) => r.file },
		{ id: 'tool', label: 'TOOL', accessor: (r) => r.tool },
		{ id: 'size', label: 'SIZE', accessor: (r) => r.size, isNum: true },
		{ id: 'packets', label: 'PACKETS', accessor: (r) => r.packets, isNum: true },
		{ id: 'dur', label: 'DUR', accessor: (r) => r.dur, isNum: true },
		{ id: 'actions', label: '', accessor: () => null }
	];
</script>

<div class="drw-scroll">
	<DrawerTable storageKey="argos.drawer.captures.cols" {columns} {rows} rowKey={(r) => r.file}>
		{#snippet cell(r, col)}
			{#if col.id === 'start'}
				<span class="dim">{r.start}</span>
			{:else if col.id === 'tool'}
				<span class="dim">{r.tool}</span>
			{:else if col.id === 'dur'}
				<span class="dim">{r.dur}</span>
			{:else if col.id === 'actions'}
				<IconBtn ariaLabel={`Download ${r.file}`} variant="ghost">
					<Download size={12} />
				</IconBtn>
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
