// spec-024 PR10a T053 — Mk II ScreenKismet table row shape.
//
// Subset of /api/kismet/devices SimplifiedKismetDevice (src/lib/schemas/
// kismet.ts) projected to the columns the operator triage table actually
// renders. Decoupling from the wire format means a future Kismet schema
// rev (or fusion-controller change) only touches the normalize() helper
// in state/kismet.svelte.ts, not every column reference in the screen.

export interface KismetDevice {
	mac: string;
	vendor: string | null;
	ssid: string | null;
	channel: number | null;
	rssiDbm: number | null;
	lastSeen: number | null;
}

export type KismetSortKey = 'mac' | 'vendor' | 'ssid' | 'channel' | 'rssiDbm' | 'lastSeen';
export type KismetSortDir = 'asc' | 'desc';
