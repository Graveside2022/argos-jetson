import {
	Activity,
	Bluetooth,
	Database,
	FileSearch,
	LayoutDashboard,
	Map as MapIcon,
	MonitorCog,
	Network,
	Radar,
	Radio,
	Wifi,
	Wrench
} from '@lucide/svelte';

import type { Mk2Tool } from '$lib/types/mk2-tool';

// spec-024 PR8 T047 — Mk II Tools catalog (hand-curated).
//
// Mapped to *actual* wired surfaces only:
//   - `route`    → existing /dashboard/mk2/{overview|systems|map|kismet|gsm}
//   - `drawer`   → opens the existing bottom drawer at a real tab (PR3)
//   - `external` → live separate web app (Wireshark VNC, OpenWebRX+ tile)
//   - `unwired`  → known tool, no UI surface in v1 — disabled in flyout
//
// No synthetic data, no fake links. If a tool isn't truly wired, it is
// either marked `unwired` (visible but disabled) or omitted entirely.
// PR9+ will replace `unwired` entries as their UIs ship.

export const mk2ToolsCatalog: readonly Mk2Tool[] = [
	// ───── OFFNET ───────────────────────────────────────────────────────────
	{
		id: 'hackrf-sweep',
		name: 'HackRF Sweep',
		description: 'RF spectrum sweep — heatmap on map',
		icon: Radio,
		pillar: 'OFFNET',
		action: { kind: 'route', href: '/dashboard/mk2/map' }
	},
	{
		id: 'kismet',
		name: 'Kismet',
		description: 'Wi-Fi device discovery + signal capture',
		icon: Wifi,
		pillar: 'OFFNET',
		action: { kind: 'route', href: '/dashboard/mk2/kismet' }
	},
	{
		id: 'gsm-evil',
		name: 'GSM Evil',
		description: 'GSM L3 IMSI capture + cell info',
		icon: Radar,
		pillar: 'OFFNET',
		action: { kind: 'route', href: '/dashboard/mk2/gsm' }
	},
	{
		id: 'dragonsync-uas',
		name: 'DragonSync UAS',
		description: 'Drone / UAS RF detection — UAS map layer',
		icon: Activity,
		pillar: 'OFFNET',
		action: { kind: 'route', href: '/dashboard/mk2/map' }
	},
	{
		id: 'bluetooth-discovery',
		name: 'Bluetooth (Blue Dragon)',
		description: 'BLE / classic device capture — drawer tab',
		icon: Bluetooth,
		pillar: 'OFFNET',
		action: { kind: 'drawer', tab: 'bluetooth' }
	},
	{
		id: 'openwebrx-plus',
		name: 'OpenWebRX+',
		description: 'Multi-band SDR receiver — separate tenant',
		icon: Radio,
		pillar: 'OFFNET',
		action: { kind: 'external', url: '/openwebrx-plus/' }
	},

	// ───── ONNET ────────────────────────────────────────────────────────────
	{
		id: 'wireshark',
		name: 'Wireshark',
		description: 'Packet capture + dissector — noVNC tenant',
		icon: Network,
		pillar: 'ONNET',
		action: { kind: 'external', url: '/wireshark/vnc/' }
	},
	{
		id: 'wifi-scan',
		name: 'Wi-Fi Scan',
		description: 'AP + client list — drawer tab',
		icon: Wifi,
		pillar: 'ONNET',
		action: { kind: 'drawer', tab: 'wifi' }
	},
	{
		id: 'system-info',
		name: 'System Info',
		description: 'Host metrics, services, processes',
		icon: MonitorCog,
		pillar: 'ONNET',
		action: { kind: 'route', href: '/dashboard/mk2/systems' }
	},

	// ───── OSINT ────────────────────────────────────────────────────────────
	{
		id: 'mission-overview',
		name: 'Mission Overview',
		description: 'Engagement / target / link budget',
		icon: LayoutDashboard,
		pillar: 'OSINT',
		action: { kind: 'route', href: '/dashboard/mk2/overview' }
	},
	{
		id: 'mission-map',
		name: 'Mission Map',
		description: 'Geospatial situation — RF + UAS + own-pos',
		icon: MapIcon,
		pillar: 'OSINT',
		action: { kind: 'route', href: '/dashboard/mk2/map' }
	},
	{
		id: 'rf-captures',
		name: 'RF Captures',
		description: 'Recorded sweeps + I/Q archive — drawer tab',
		icon: FileSearch,
		pillar: 'OSINT',
		action: { kind: 'drawer', tab: 'captures' }
	},
	{
		id: 'cell-tower-db',
		name: 'OpenCellID DB',
		description: '5.1M-row tower lookup — query tooling pending',
		icon: Database,
		pillar: 'OSINT',
		action: { kind: 'unwired' }
	},
	{
		id: 'tak-server',
		name: 'TAK Server',
		description: 'Cursor-on-Target broadcaster — UI pending',
		icon: Wrench,
		pillar: 'OSINT',
		action: { kind: 'unwired' }
	}
] as const;
