import type { WeatherReport } from '$lib/types/weather';

import { AviationMetarListSchema } from './aviationweather-schema';
import * as cache from './metar-cache';
import { parseAviationWeather } from './metar-parse';

// spec-024 PR1 T012 — METAR fetch orchestration.
// Memory-first → disk-on-fail → upstream. Upstream goes to
// aviationweather.gov which is free, no key, no rate-limit on light use.

const ENDPOINT = 'https://aviationweather.gov/api/data/metar';
const FETCH_TIMEOUT_MS = 8000;

interface UpstreamOpts {
	station: string;
	stationName?: string;
}

async function callUpstream(station: string): Promise<unknown> {
	const url = `${ENDPOINT}?ids=${encodeURIComponent(station)}&format=json`;
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: ac.signal,
			headers: { accept: 'application/json' }
		});
		if (!res.ok) throw new Error(`upstream ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

async function fetchAndParse(opts: UpstreamOpts): Promise<WeatherReport | null> {
	const raw = await callUpstream(opts.station);
	const parsed = AviationMetarListSchema.safeParse(raw);
	if (!parsed.success || parsed.data.length === 0) return null;
	const wx = parseAviationWeather({
		metar: parsed.data[0],
		stationName: opts.stationName ?? opts.station
	});
	await cache.set(opts.station, wx);
	return wx;
}

export interface MetarLookup {
	wx: WeatherReport;
	stale: boolean;
}

export async function getMetar(opts: UpstreamOpts): Promise<MetarLookup | null> {
	const fresh = cache.getFresh(opts.station);
	if (fresh) return { wx: fresh, stale: false };

	try {
		const live = await fetchAndParse(opts);
		if (live) return { wx: live, stale: false };
	} catch {
		// fall through to disk cache for offline-mode resilience
	}

	const stale = await cache.getStale(opts.station);
	return stale ? { wx: stale, stale: true } : null;
}
