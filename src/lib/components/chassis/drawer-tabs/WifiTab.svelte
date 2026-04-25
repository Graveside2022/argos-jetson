<script lang="ts">
	// spec-024 PR3 T021 — Wi-Fi drawer tab (static stub).
	// Hardcoded mock rows matching prototype. Real wiring to /api/kismet/devices
	// lands per-screen in PR5+.

	interface Row {
		mac: string;
		ssid: string;
		vendor: string;
		ch: number;
		rssi: number;
		enc: string;
		hidden?: boolean;
	}

	const rows: readonly Row[] = [
		{ mac: 'A4:2B:B0:18:3F:91', ssid: 'NATO-GUEST', vendor: 'Ubiquiti', ch: 36, rssi: -42, enc: 'WPA2' },
		{ mac: 'E8:48:B8:2E:07:AA', ssid: 'kaserne-mesh', vendor: 'TP-Link', ch: 6, rssi: -48, enc: 'WPA3' },
		{ mac: '9C:DA:3E:12:91:00', ssid: 'USAG-CORP', vendor: 'Cisco Meraki', ch: 149, rssi: -54, enc: 'WPA2-ENT' },
		{ mac: '00:1C:B3:00:FF:12', ssid: 'HIDDEN', vendor: 'Unknown', ch: 11, rssi: -69, enc: 'WEP', hidden: true }
	];

	function rssiColor(rssi: number): string {
		if (rssi >= -50) return 'var(--mk2-accent)';
		return 'var(--mk2-ink)';
	}
</script>

<div class="drw-scroll">
	<div class="header">214 DEVICES · 42 APs · 172 STAs · 6 ALERTS — live feed from wlan1 monitor</div>
	<table class="tbl">
		<thead>
			<tr>
				<th>MAC</th>
				<th>SSID</th>
				<th>VENDOR</th>
				<th class="num">CH</th>
				<th class="num">RSSI</th>
				<th>ENC</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r, i (`${r.mac}-${i}`)}
				<tr class:hidden-ap={r.hidden}>
					<td class="mac">{r.mac}</td>
					<td class="dim">{r.ssid}</td>
					<td class="dim">{r.vendor}</td>
					<td class="num">{r.ch}</td>
					<td class="num" style:color={rssiColor(r.rssi)}>{r.rssi}</td>
					<td class="dim">{r.enc}</td>
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
		color: var(--mk2-ink-3);
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
		letter-spacing: 0.06em;
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

	.tbl tr.hidden-ap td.mac {
		color: var(--mk2-red);
	}

	.tbl tr:hover td {
		background: var(--mk2-bg-2);
	}
</style>
