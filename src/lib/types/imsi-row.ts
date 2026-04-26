// spec-024 PR10b T052 — Mk II GSM screen IMSI table row.
//
// Subset of /api/gsm-evil/imsi-data response with optional tower
// fields populated lazily via /api/gsm-evil/tower-location lookup
// keyed on (mcc, mnc, lac, ci). Decoupling from the API wire format
// means a future gsm-evil schema rev only touches the normalize()
// helper in state/gsm.svelte.ts, not every column reference in the
// screen.

export interface ImsiRow {
	id: number;
	imsi: string;
	tmsi: string | null;
	mcc: string | null;
	mnc: string | null;
	lac: string | null;
	ci: string | null;
	datetime: number | null;
}

export interface CellLocation {
	lat: number;
	lon: number;
	rangeM: number | null;
	city: string | null;
}

export type ImsiSortKey = 'imsi' | 'tmsi' | 'mcc' | 'mnc' | 'lac' | 'ci' | 'datetime';
export type ImsiSortDir = 'asc' | 'desc';
