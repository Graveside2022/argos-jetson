// Weather model — feeds the METAR proxy `/api/weather/metar`.

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface WindReport {
	dir: number;
	spd: number;
	gust: number | null;
	variable: string | null;
}

export interface OperationsAssessment {
	manned: { ok: boolean; note: string };
	uas: { ok: boolean; note: string };
	balloon: { ok: boolean; note: string };
	radio: { ok: boolean; note: string };
}

export interface WeatherReport {
	station: string;
	stationName: string;
	raw: string;
	obs: string;
	cat: FlightCategory;
	conds: string;
	temp: number;
	dew: number;
	wind: WindReport;
	vis: number;
	ceiling: number | null;
	pressure: number;
	humidity: number;
	sunset: string;
	moon: string;
	densityAlt: number;
	ops: OperationsAssessment;
	rfNote: string;
	fetchedAt: string;
	nextUpdateAt: string;
	source: string;
}
