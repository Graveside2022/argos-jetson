// spec-024 — chassis live data wiring (Topbar + Statusbar + WeatherButton).
//
// The Mk II chassis (`src/routes/dashboard/mk2/+layout.svelte`) was wired in
// PR1/PR2 with prop-based components but the layout never instantiated the
// pollers, so Topbar/Statusbar showed `—` placeholders forever even though
// /api/system/metrics + /api/gps/position + /api/weather/metar all return
// live data. This module owns all chassis-level pollers in one place; the
// layout reads from `chassisState` and passes props to its children.
//
// Pollers run only in the browser; SSR sees the initial empty state.

import { onDestroy } from 'svelte';

import { browser } from '$app/environment';

import type { WeatherReport } from '$lib/types/weather';
import { type Airport, findNearest, loadAirports } from '$lib/utils/airports';

// Intentionally slower than per-screen pollers (HostMetricsTab @1.2s,
// SensorTile @1.2s) — the chassis Statusbar is glanceable furniture, not a
// trend chart. Polling at 1-2s rate would compound with screen-level pollers
// and exhaust the /api/* 200 req/min rate limit on cold-load. A future PR
// can consolidate system/metrics into a single shared store.
const METRICS_INTERVAL_MS = 5_000;
const GPS_INTERVAL_MS = 5_000;
const WEATHER_INTERVAL_MS = 15 * 60 * 1_000; // 15 min — METAR endpoint cache TTL

interface SystemMetrics {
	cpu?: { usage: number; temperature: number };
	memory?: { total: number; used: number; percentage: number };
	disk?: { available: number; percentage: number };
	network?: { rx: number; tx: number };
}

interface GpsPosition {
	latitude: number;
	longitude: number;
	satellites?: number;
	fix?: number;
}

interface ChassisState {
	system: {
		cpuPct?: number;
		memUsedGb?: number;
		memTotalGb?: number;
		tempC?: number;
		nvmeFreeGb?: number;
	};
	link: { state?: 'up' | 'down' | 'degraded'; throughput?: string };
	gps: { lat?: number; lon?: number; satellites?: number; fix?: number };
	station: { icao?: string; name?: string };
	weather: { wx: WeatherReport | null; loading: boolean; error: string | null };
	session: string;
}

const BYTES_PER_GB = 1024 ** 3;

function gb(bytes: number | undefined): number | undefined {
	return bytes == null ? undefined : bytes / BYTES_PER_GB;
}

async function fetchJson<T>(path: string): Promise<T | null> {
	try {
		const r = await fetch(path);
		if (!r.ok) return null;
		return (await r.json()) as T;
	} catch {
		return null;
	}
}

/**
 * Reactive chassis state. Created on first call from a component context;
 * pollers run for the lifetime of that component (cleaned up via `onDestroy`).
 *
 * Call from inside `+layout.svelte`'s component initialisation so the
 * `onDestroy` hook is registered correctly.
 */
export function createChassisState(): ChassisState {
	const state = $state<ChassisState>({
		system: {},
		link: {},
		gps: {},
		station: {},
		weather: { wx: null, loading: false, error: null },
		session: '—'
	});

	if (!browser) return state;

	// Lazy-loaded airport table (T013) — used to map GPS coords → nearest ICAO
	// for the METAR endpoint, which expects a `?station=ICAO` query param.
	let airports: Airport[] | null = null;
	async function ensureAirports(): Promise<Airport[]> {
		if (airports == null) {
			try {
				airports = await loadAirports(globalThis.fetch);
			} catch {
				airports = [];
			}
		}
		return airports;
	}

	async function pollMetrics(): Promise<void> {
		const data = await fetchJson<SystemMetrics>('/api/system/metrics');
		if (!data) return;
		state.system = {
			cpuPct: data.cpu?.usage,
			memUsedGb: gb(data.memory?.used),
			memTotalGb: gb(data.memory?.total),
			tempC: data.cpu?.temperature,
			nvmeFreeGb: gb(data.disk?.available)
		};
	}

	async function pollGps(): Promise<void> {
		const r = await fetchJson<{ success: boolean; data: GpsPosition }>('/api/gps/position');
		if (!r?.success || !r.data) return;
		state.gps = {
			lat: r.data.latitude,
			lon: r.data.longitude,
			satellites: r.data.satellites,
			fix: r.data.fix
		};
		const list = await ensureAirports();
		const nearest = findNearest(list, r.data.latitude, r.data.longitude);
		if (nearest) state.station = { icao: nearest.icao, name: nearest.name };
	}

	async function pollWeather(): Promise<void> {
		const icao = state.station.icao;
		if (!icao) return;
		state.weather.loading = true;
		// Endpoint shape: `{wx, stale}` on success, `{success: false, error}` on
		// failure — mirror that here instead of re-keying behind a `data` field.
		const r = await fetchJson<{
			wx?: WeatherReport;
			stale?: boolean;
			success?: boolean;
			error?: string;
		}>(`/api/weather/metar?station=${icao}`);
		state.weather.loading = false;
		if (!r) {
			state.weather.error = 'METAR fetch failed';
			return;
		}
		if (r.wx) {
			state.weather.wx = r.wx;
			state.weather.error = null;
		} else if (r.error) {
			state.weather.error = r.error;
		}
	}

	void pollMetrics();
	void pollGps().then(() => void pollWeather());

	const metricsId = setInterval(() => void pollMetrics(), METRICS_INTERVAL_MS);
	const gpsId = setInterval(() => void pollGps(), GPS_INTERVAL_MS);
	const weatherId = setInterval(() => void pollWeather(), WEATHER_INTERVAL_MS);

	onDestroy(() => {
		clearInterval(metricsId);
		clearInterval(gpsId);
		clearInterval(weatherId);
	});

	return state;
}
