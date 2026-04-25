<script lang="ts">
	import { Download } from '@lucide/svelte';

	import IconBtn from '$lib/components/mk2/IconBtn.svelte';

	// spec-024 PR3 T021 — Captures drawer tab (static stub).
	// Hardcoded mock rows matching prototype. Real wiring lands in PR5+.

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
</script>

<div class="drw-scroll">
	<table class="tbl">
		<thead>
			<tr>
				<th>FILE</th>
				<th>TOOL</th>
				<th class="num">SIZE</th>
				<th class="num">PACKETS</th>
				<th class="num">START</th>
				<th class="num">DUR</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i (`${r.file}-${i}`)}
				<tr>
					<td>{r.file}</td>
					<td class="dim">{r.tool}</td>
					<td class="num">{r.size}</td>
					<td class="num">{r.packets}</td>
					<td class="num dim">{r.start}</td>
					<td class="num dim">{r.dur}</td>
					<td>
						<IconBtn ariaLabel={`Download ${r.file}`} variant="ghost">
							<Download size={12} />
						</IconBtn>
					</td>
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
		vertical-align: middle;
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
