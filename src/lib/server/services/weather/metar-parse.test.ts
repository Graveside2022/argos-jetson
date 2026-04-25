import { describe, expect, it } from 'vitest';

import type { AviationMetar } from './aviationweather-schema';
import { __test, parseAviationWeather } from './metar-parse';

const { classifyCategory, parseVisibility, lowestCeiling, relativeHumidity, buildOps, fmtObs } =
	__test;

function metar(overrides: Partial<AviationMetar>): AviationMetar {
	return {
		icaoId: 'TEST',
		rawOb: 'TEST 010000Z 18010KT 10SM CLR 15/05 Q1013',
		obsTime: 1729713300,
		temp: 15,
		dewp: 5,
		wdir: 180,
		wspd: 10,
		wgst: null,
		visib: '10',
		altim: 1013,
		clouds: [],
		wxString: '',
		...overrides
	};
}

describe('classifyCategory', () => {
	it('returns VFR when ceiling and visibility clear minima', () => {
		expect(classifyCategory(5000, 16)).toBe('VFR');
	});

	it('returns MVFR when ceiling between 1000-3000 ft', () => {
		expect(classifyCategory(2000, 16)).toBe('MVFR');
	});

	it('returns IFR when ceiling between 500-1000 ft', () => {
		expect(classifyCategory(800, 16)).toBe('IFR');
	});

	it('returns LIFR when ceiling below 500 ft', () => {
		expect(classifyCategory(300, 16)).toBe('LIFR');
	});

	it('uses statute-mile visibility ladder when ceiling is null', () => {
		expect(classifyCategory(null, 0.5)).toBe('LIFR');
		expect(classifyCategory(null, 4)).toBe('IFR');
	});
});

describe('parseVisibility', () => {
	it('parses integer statute miles to km', () => {
		expect(parseVisibility('10')).toBeCloseTo(16.09, 2);
	});

	it('strips a trailing plus marker', () => {
		expect(parseVisibility('10+')).toBeCloseTo(16.09, 2);
	});

	it('parses fractional values (3/4 sm)', () => {
		expect(parseVisibility('3/4')).toBeCloseTo(0.75 * 1.609344, 3);
	});

	it('parses mixed numbers (1 1/2 sm)', () => {
		expect(parseVisibility('1 1/2')).toBeCloseTo(1.5 * 1.609344, 3);
	});

	it('returns 0 for nullish or unparseable input', () => {
		expect(parseVisibility(null)).toBe(0);
		expect(parseVisibility('garbage')).toBe(0);
	});

	it('treats numeric input as statute miles', () => {
		expect(parseVisibility(5)).toBeCloseTo(8.05, 2);
	});
});

describe('lowestCeiling', () => {
	it('returns null when there are no BKN/OVC layers', () => {
		expect(lowestCeiling([{ cover: 'FEW', base: 4000 }])).toBeNull();
		expect(lowestCeiling([])).toBeNull();
		expect(lowestCeiling(undefined)).toBeNull();
	});

	it('returns the lowest BKN/OVC base', () => {
		expect(
			lowestCeiling([
				{ cover: 'BKN', base: 2500 },
				{ cover: 'OVC', base: 1200 },
				{ cover: 'SCT', base: 800 }
			])
		).toBe(1200);
	});

	it('skips clouds without a numeric base', () => {
		expect(
			lowestCeiling([
				{ cover: 'BKN', base: null },
				{ cover: 'OVC', base: 3000 }
			])
		).toBe(3000);
	});
});

describe('relativeHumidity', () => {
	it('returns 100 when dew point equals temperature', () => {
		expect(relativeHumidity(20, 20)).toBe(100);
	});

	it('decreases monotonically as the dew-point gap widens', () => {
		expect(relativeHumidity(20, 10)).toBeLessThan(relativeHumidity(20, 15));
	});

	it('returns 0 for non-finite input', () => {
		expect(relativeHumidity(NaN, 10)).toBe(0);
	});
});

describe('fmtObs', () => {
	it('formats a unix timestamp as DD/HHMMZ', () => {
		// 2024-10-23 20:55:00 UTC
		const ts = Date.UTC(2024, 9, 23, 20, 55, 0) / 1000;
		expect(fmtObs(ts)).toBe('23/2055Z');
	});
});

describe('buildOps', () => {
	it('marks all ops GO under VFR + light winds', () => {
		const ops = buildOps('VFR', { dir: 180, spd: 5, gust: null, variable: null }, 16);
		expect(ops.manned.ok).toBe(true);
		expect(ops.uas.ok).toBe(true);
		expect(ops.balloon.ok).toBe(true);
		expect(ops.radio.ok).toBe(true);
	});

	it('downgrades UAS + balloon when gust exceeds limits', () => {
		const ops = buildOps('VFR', { dir: 180, spd: 18, gust: 25, variable: null }, 16);
		expect(ops.uas.ok).toBe(false);
		expect(ops.balloon.ok).toBe(false);
	});

	it('forces manned NO-GO under IFR cat', () => {
		const ops = buildOps('IFR', { dir: 180, spd: 10, gust: null, variable: null }, 8);
		expect(ops.manned.ok).toBe(false);
	});
});

describe('parseAviationWeather', () => {
	it('preserves VRB wind direction semantics', () => {
		const wx = parseAviationWeather({
			metar: metar({ wdir: 'VRB', wspd: 4 }),
			stationName: 'TEST FIELD'
		});
		expect(wx.wind.variable).toBe('VRB');
		expect(wx.wind.dir).toBe(0);
		expect(wx.wind.spd).toBe(4);
	});

	it('rolls up cat / vis / temp / pressure into a WeatherReport', () => {
		const wx = parseAviationWeather({
			metar: metar({
				visib: '10',
				clouds: [{ cover: 'SCT', base: 4000 }],
				temp: 14,
				dewp: 8,
				altim: 1018
			}),
			stationName: 'WIESBADEN AAF'
		});
		expect(wx.cat).toBe('VFR');
		expect(wx.station).toBe('TEST');
		expect(wx.stationName).toBe('WIESBADEN AAF');
		expect(wx.pressure).toBe(1018);
		expect(wx.humidity).toBeGreaterThan(50);
		expect(wx.humidity).toBeLessThan(80);
	});

	it('emits LIFR cat for low ceiling + low visibility', () => {
		const wx = parseAviationWeather({
			metar: metar({
				visib: '1/2',
				clouds: [{ cover: 'OVC', base: 200 }]
			}),
			stationName: 'IFR FIELD'
		});
		expect(wx.cat).toBe('LIFR');
	});
});
