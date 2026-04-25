<script lang="ts">
	// spec-024 PR3 T021 — Bluetooth drawer tab (static stub).
	// Hardcoded mock rows matching prototype. Real wiring (/api/bluedragon/*)
	// per memory `project_bluetooth_e2e_done.md` lands in PR5+.

	interface Row {
		mac: string;
		name: string;
		type: string;
		rssi: number;
		last: string;
	}

	const rows: readonly Row[] = [
		{ mac: '7C:2E:BD:01:AA:F0', name: 'AirPods Pro', type: 'LE · audio', rssi: -58, last: '202451Z' },
		{ mac: 'A8:1B:5A:23:42:11', name: '—', type: 'LE · beacon', rssi: -72, last: '202448Z' },
		{ mac: 'F0:08:D1:92:84:37', name: 'TILE-E0F8', type: 'LE · tracker', rssi: -81, last: '202440Z' },
		{ mac: 'C8:69:CD:11:02:93', name: 'Garmin-InReach', type: 'CLASSIC', rssi: -76, last: '202430Z' }
	];
</script>

<div class="drw-scroll">
	<table class="tbl">
		<thead>
			<tr>
				<th>MAC</th>
				<th>NAME</th>
				<th>TYPE</th>
				<th class="num">RSSI</th>
				<th class="num">LAST</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i (`${r.mac}-${i}`)}
				<tr>
					<td>{r.mac}</td>
					<td class="dim">{r.name}</td>
					<td class="dim">{r.type}</td>
					<td class="num">{r.rssi}</td>
					<td class="num dim">{r.last}</td>
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
