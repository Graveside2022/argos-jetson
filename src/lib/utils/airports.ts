import { haversineKm } from './geo';

// spec-024 PR1 T013 — nearest-station lookup for the topbar Weather button.
// Consumers fetch /airports.json once at startup, then call findNearest()
// on each GPS update. Pure functions; no side effects.

export interface Airport {
	icao: string;
	name: string;
	lat: number;
	lon: number;
}

export interface NearestAirport extends Airport {
	distanceKm: number;
}

export function findNearest(
	airports: readonly Airport[],
	lat: number,
	lon: number
): NearestAirport | null {
	if (airports.length === 0) return null;
	let best: Airport = airports[0];
	let bestKm = haversineKm(lat, lon, best.lat, best.lon);
	for (let i = 1; i < airports.length; i++) {
		const a = airports[i];
		const km = haversineKm(lat, lon, a.lat, a.lon);
		if (km < bestKm) {
			best = a;
			bestKm = km;
		}
	}
	return { ...best, distanceKm: bestKm };
}

export async function loadAirports(fetchFn: typeof fetch = fetch): Promise<Airport[]> {
	const res = await fetchFn('/airports.json');
	if (!res.ok) throw new Error(`airports.json HTTP ${res.status}`);
	return (await res.json()) as Airport[];
}
