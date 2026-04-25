import { error } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getMetar } from '$lib/server/services/weather/metar-fetch';

import type { RequestHandler } from './$types';

// spec-024 PR1 T012 — METAR proxy.
// GET /api/weather/metar?station=ICAO
// 15-min TTL memory cache → upstream aviationweather.gov → disk fallback.
// ARGOS_API_KEY auth is enforced upstream by hooks.server.ts; nothing extra here.

const ICAO_RE = /^[A-Z0-9]{4}$/;

function resolveStation(url: URL): string {
	const raw = url.searchParams.get('station');
	if (!raw) throw error(400, 'station=ICAO query parameter required (4 alphanumerics)');
	const station = raw.trim().toUpperCase();
	if (!ICAO_RE.test(station)) throw error(400, 'station must be 4 alphanumeric characters');
	return station;
}

export const GET: RequestHandler = createHandler(async ({ url }) => {
	const station = resolveStation(url);
	const stationName = url.searchParams.get('stationName') ?? undefined;
	const result = await getMetar({ station, stationName });
	if (!result) throw error(503, 'METAR unavailable — upstream failed and no disk cache');
	return { wx: result.wx, stale: result.stale };
});
