<script lang="ts">
	import DrawerTable, { type Column } from './DrawerTable.svelte';

	// spec-024 PR3 T021 — Wi-Fi drawer tab. Reorderable + sortable via DrawerTable.
	// Real wiring to /api/kismet/devices lands per-screen in PR5+.

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
		{
			mac: 'A4:2B:B0:18:3F:91',
			ssid: 'NATO-GUEST',
			vendor: 'Ubiquiti',
			ch: 36,
			rssi: -42,
			enc: 'WPA2'
		},
		{
			mac: 'E8:48:B8:2E:07:AA',
			ssid: 'kaserne-mesh',
			vendor: 'TP-Link',
			ch: 6,
			rssi: -48,
			enc: 'WPA3'
		},
		{
			mac: '9C:DA:3E:12:91:00',
			ssid: 'USAG-CORP',
			vendor: 'Cisco Meraki',
			ch: 149,
			rssi: -54,
			enc: 'WPA2-ENT'
		},
		{
			mac: '00:1C:B3:00:FF:12',
			ssid: 'HIDDEN',
			vendor: 'Unknown',
			ch: 11,
			rssi: -69,
			enc: 'WEP',
			hidden: true
		}
	];

	const columns: readonly Column<Row>[] = [
		{ id: 'mac', label: 'MAC', accessor: (r) => r.mac },
		{ id: 'ssid', label: 'SSID', accessor: (r) => r.ssid },
		{ id: 'vendor', label: 'VENDOR', accessor: (r) => r.vendor },
		{ id: 'ch', label: 'CH', accessor: (r) => r.ch, isNum: true },
		{ id: 'rssi', label: 'RSSI', accessor: (r) => r.rssi, isNum: true },
		{ id: 'enc', label: 'ENC', accessor: (r) => r.enc }
	];

	function rssiColor(rssi: number): string {
		if (rssi >= -50) return 'var(--mk2-accent)';
		return 'var(--mk2-ink)';
	}
</script>

<div class="drw-scroll">
	<div class="header">
		214 DEVICES · 42 APs · 172 STAs · 6 ALERTS — live feed from wlan1 monitor
	</div>
	<DrawerTable storageKey="argos.drawer.wifi.cols" {columns} {rows} rowKey={(r) => r.mac}>
		{#snippet cell(r, col)}
			{#if col.id === 'mac'}
				<span class:hidden-mac={r.hidden}>{r.mac}</span>
			{:else if col.id === 'ssid' || col.id === 'vendor' || col.id === 'enc'}
				<span class="dim">{col.accessor(r) ?? ''}</span>
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
		color: var(--mk2-ink-3);
		font: 500 var(--mk2-fs-3) / 1 var(--mk2-f-mono);
		letter-spacing: 0.06em;
	}

	.dim {
		color: var(--mk2-ink-3);
	}

	.hidden-mac {
		color: var(--mk2-red);
	}
</style>
