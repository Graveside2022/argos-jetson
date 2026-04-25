import type {
	FlightCategory,
	OperationsAssessment,
	WeatherReport,
	WindReport
} from '$lib/types/weather';

import type { AviationMetar } from './aviationweather-schema';

// spec-024 PR1 T012 — METAR JSON → WeatherReport mapper.
// Pure functions; no side effects, no I/O. Each helper is small enough
// to stay under ESLint complexity max (5).

const SM_TO_KM = 1.609344;
const HPA_TO_INHG = 0.02953;

interface CategoryThresholds {
	ceiling: number;
	visSm: number;
	cat: FlightCategory;
}

const CATEGORY_LADDER: CategoryThresholds[] = [
	{ ceiling: 500, visSm: 1, cat: 'LIFR' },
	{ ceiling: 1000, visSm: 3, cat: 'IFR' },
	{ ceiling: 3000, visSm: 5, cat: 'MVFR' }
];

function classifyCategory(ceilingFt: number | null, visKm: number): FlightCategory {
	const ceil = ceilingFt ?? Infinity;
	const visSm = visKm / SM_TO_KM;
	const hit = CATEGORY_LADDER.find((t) => ceil < t.ceiling || visSm < t.visSm);
	return hit ? hit.cat : 'VFR';
}

function parseVisibility(raw: AviationMetar['visib']): number {
	if (raw == null) return 0;
	if (typeof raw === 'number') return raw * SM_TO_KM;
	const trimmed = raw.replace('+', '').trim();
	const n = Number(trimmed);
	return Number.isFinite(n) ? n * SM_TO_KM : 0;
}

function parseWindDir(raw: AviationMetar['wdir']): number {
	if (typeof raw === 'number') return raw;
	const n = Number(raw);
	return Number.isFinite(n) ? n : 0;
}

function buildWind(metar: AviationMetar): WindReport {
	return {
		dir: parseWindDir(metar.wdir),
		spd: metar.wspd ?? 0,
		gust: metar.wgst ?? null,
		variable: null
	};
}

function isCeilingLayer(cover: string | undefined): boolean {
	return cover === 'BKN' || cover === 'OVC';
}

function ceilingBase(cloud: { cover?: string; base?: number | null }): number | null {
	if (!isCeilingLayer(cloud.cover)) return null;
	return typeof cloud.base === 'number' ? cloud.base : null;
}

function lowestCeiling(clouds: AviationMetar['clouds']): number | null {
	if (!clouds) return null;
	const bases = clouds.map(ceilingBase).filter((b): b is number => b !== null);
	return bases.length === 0 ? null : Math.min(...bases);
}

function summarizeClouds(clouds: AviationMetar['clouds']): string {
	if (!clouds || clouds.length === 0) return 'CLR';
	return (
		clouds
			.filter((c) => c.cover && c.cover !== 'CLR' && c.cover !== 'SKC')
			.map((c) => c.cover)
			.join(' · ') || 'CLR'
	);
}

function relativeHumidity(tempC: number, dewC: number): number {
	if (!Number.isFinite(tempC) || !Number.isFinite(dewC)) return 0;
	const t = (17.625 * tempC) / (243.04 + tempC);
	const d = (17.625 * dewC) / (243.04 + dewC);
	return Math.round(100 * Math.exp(d - t));
}

function fmtObs(obsTime: number): string {
	const d = new Date(obsTime * 1000);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${day}/${hh}${mm}Z`;
}

interface OpsCtx {
	cat: FlightCategory;
	gust: number;
	visKm: number;
}

function note(ok: boolean, yes: string, no: string): string {
	return ok ? yes : no;
}

function manned(ctx: OpsCtx) {
	const ok = ctx.cat !== 'LIFR' && ctx.cat !== 'IFR' && ctx.gust < 35;
	return { ok, note: note(ok, 'cat ok · winds within limits', 'cat or wind exceeds limits') };
}

function uasOps(ctx: OpsCtx) {
	const ok = ctx.cat === 'VFR' && ctx.gust < 15 && ctx.visKm >= 5;
	return {
		ok,
		note: note(ok, 'wind under 15 kt · daylight VFR', 'wind or vis below UAS minima')
	};
}

function balloonOps(ctx: OpsCtx) {
	const ok = ctx.gust < 20 && ctx.cat === 'VFR';
	return { ok, note: note(ok, 'surface winds light', 'winds aloft / surface too high') };
}

function buildOps(cat: FlightCategory, wind: WindReport, visKm: number): OperationsAssessment {
	const ctx: OpsCtx = { cat, gust: wind.gust ?? wind.spd, visKm };
	return {
		manned: manned(ctx),
		uas: uasOps(ctx),
		balloon: balloonOps(ctx),
		radio: { ok: true, note: 'atmosphere quiet · check propagation tools for HF' }
	};
}

export interface ParseInput {
	metar: AviationMetar;
	stationName: string;
	source?: string;
}

export function parseAviationWeather({
	metar,
	stationName,
	source = 'aviationweather.gov'
}: ParseInput): WeatherReport {
	const visKm = parseVisibility(metar.visib);
	const wind = buildWind(metar);
	const ceiling = lowestCeiling(metar.clouds);
	const cat = classifyCategory(ceiling, visKm);
	const temp = metar.temp ?? 0;
	const dew = metar.dewp ?? 0;
	const fetchedAt = new Date().toISOString();
	const nextUpdateAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
	return {
		station: metar.icaoId,
		stationName,
		raw: metar.rawOb,
		obs: fmtObs(metar.obsTime),
		cat,
		conds: summarizeClouds(metar.clouds),
		temp,
		dew,
		wind,
		vis: Math.round(visKm * 10) / 10,
		ceiling,
		pressure: metar.altim ?? 0,
		humidity: relativeHumidity(temp, dew),
		sunset: '—',
		moon: '—',
		densityAlt: 0,
		ops: buildOps(cat, wind, visKm),
		rfNote: '',
		fetchedAt,
		nextUpdateAt,
		source
	};
}

export const __test = {
	classifyCategory,
	parseVisibility,
	lowestCeiling,
	relativeHumidity,
	fmtObs,
	buildOps,
	HPA_TO_INHG
};
