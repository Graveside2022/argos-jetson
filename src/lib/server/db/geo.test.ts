import { describe, expect, it, vi } from 'vitest';

import {
	calculateDistance,
	convertRadiusToGrid,
	dbSignalToMarker,
	detectDeviceType,
	generateDeviceId,
	hasValidGpsCoords,
	validateGpsCoords
} from './geo';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('detectDeviceType — FREQUENCY_BANDS ordering (FINDING-PHASE5-DB-6)', () => {
	it('returns bluetooth for 2440 MHz (inside 2400-2485 subrange)', () => {
		// Pre-fix bug: wifi was listed first, so find() returned 'wifi' here.
		expect(detectDeviceType(2440)).toBe('bluetooth');
	});

	it('returns wifi for 2490 MHz (in wifi 2400-2500, outside bluetooth 2400-2485)', () => {
		expect(detectDeviceType(2490)).toBe('wifi');
	});

	it('returns wifi for 5500 MHz (5GHz wifi band)', () => {
		expect(detectDeviceType(5500)).toBe('wifi');
	});

	it('returns cellular for 850 MHz', () => {
		expect(detectDeviceType(850)).toBe('cellular');
	});

	it('returns cellular for 1850 MHz', () => {
		expect(detectDeviceType(1850)).toBe('cellular');
	});

	it('returns unknown for out-of-band frequency', () => {
		expect(detectDeviceType(10000)).toBe('unknown');
		expect(detectDeviceType(100)).toBe('unknown');
	});

	it('boundary: 2400 MHz returns bluetooth (start of both bluetooth and wifi)', () => {
		expect(detectDeviceType(2400)).toBe('bluetooth');
	});

	it('boundary: 2485 MHz returns bluetooth (end of bluetooth)', () => {
		expect(detectDeviceType(2485)).toBe('bluetooth');
	});

	it('boundary: 2486 MHz returns wifi (past bluetooth, inside wifi)', () => {
		expect(detectDeviceType(2486)).toBe('wifi');
	});
});

describe('hasValidGpsCoords', () => {
	it('rejects (0,0)', () => expect(hasValidGpsCoords(0, 0)).toBe(false));
	it('rejects null lat', () => expect(hasValidGpsCoords(null, 1)).toBe(false));
	it('rejects null lon', () => expect(hasValidGpsCoords(1, null)).toBe(false));
	it('rejects undefined both', () => expect(hasValidGpsCoords(undefined, undefined)).toBe(false));
	it('accepts (37.7, -122.4)', () => expect(hasValidGpsCoords(37.7, -122.4)).toBe(true));
	it('accepts (0, 1)', () => expect(hasValidGpsCoords(0, 1)).toBe(true));
	it('accepts (1, 0)', () => expect(hasValidGpsCoords(1, 0)).toBe(true));
});

describe('validateGpsCoords', () => {
	it('returns object on valid coords', () => {
		expect(validateGpsCoords(37.7, -122.4)).toEqual({ lat: 37.7, lon: -122.4 });
	});
	it('returns null on (0,0)', () => expect(validateGpsCoords(0, 0)).toBeNull());
	it('returns null on null lat', () => expect(validateGpsCoords(null, 1)).toBeNull());
	it('returns null on undefined lon', () =>
		expect(validateGpsCoords(1, undefined)).toBeNull());
});

describe('calculateDistance — Haversine delegation', () => {
	it('returns 0 for same point', () => {
		expect(calculateDistance(37.7, -122.4, 37.7, -122.4)).toBe(0);
	});

	it('returns positive for distinct points', () => {
		const d = calculateDistance(37.7, -122.4, 37.8, -122.4);
		expect(d).toBeGreaterThan(10_000); // ~11km lat-degree
		expect(d).toBeLessThan(12_000);
	});
});

describe('convertRadiusToGrid', () => {
	it('produces grid bounds containing center', () => {
		const grid = convertRadiusToGrid(37.7, -122.4, 1000);
		expect(grid.lat_min).toBeLessThan(37.7 * 10000);
		expect(grid.lat_max).toBeGreaterThan(37.7 * 10000);
		expect(grid.lon_min).toBeLessThan(-122.4 * 10000);
		expect(grid.lon_max).toBeGreaterThan(-122.4 * 10000);
	});

	it('floor/ceil applied to bounds (integer grid keys)', () => {
		const grid = convertRadiusToGrid(37.7, -122.4, 1000);
		expect(Number.isInteger(grid.lat_min)).toBe(true);
		expect(Number.isInteger(grid.lat_max)).toBe(true);
		expect(Number.isInteger(grid.lon_min)).toBe(true);
		expect(Number.isInteger(grid.lon_max)).toBe(true);
	});

	it('larger radius produces wider grid', () => {
		const small = convertRadiusToGrid(37.7, -122.4, 100);
		const large = convertRadiusToGrid(37.7, -122.4, 10_000);
		expect(large.lat_max - large.lat_min).toBeGreaterThan(small.lat_max - small.lat_min);
	});
});

describe('generateDeviceId', () => {
	it('composes signalType_freq_powerband', () => {
		const id = generateDeviceId({
			id: 's1',
			lat: 37.7,
			lon: -122.4,
			position: { lat: 37.7, lon: -122.4 },
			power: -55,
			frequency: 2440.7,
			timestamp: 1000,
			source: 'kismet',
			metadata: { signalType: 'wifi' }
		});
		expect(id).toBe('wifi_2440_-60'); // floor(2440.7), floor(-55/10)*10 = -60
	});

	it('falls back to metadata.type', () => {
		const id = generateDeviceId({
			id: 's2',
			lat: 0,
			lon: 0,
			position: { lat: 0, lon: 0 },
			power: -50,
			frequency: 5500,
			timestamp: 1,
			source: 'kismet',
			metadata: { type: 'cellular' }
		});
		expect(id.startsWith('cellular_')).toBe(true);
	});

	it('falls back to "unknown" when no type', () => {
		const id = generateDeviceId({
			id: 's3',
			lat: 0,
			lon: 0,
			position: { lat: 0, lon: 0 },
			power: -50,
			frequency: 2440,
			timestamp: 1,
			source: 'kismet',
			metadata: undefined
		});
		expect(id.startsWith('unknown_')).toBe(true);
	});

	it('handles string metadata (JSON-parsed)', () => {
		const id = generateDeviceId({
			id: 's4',
			lat: 0,
			lon: 0,
			position: { lat: 0, lon: 0 },
			power: -50,
			frequency: 2440,
			timestamp: 1,
			source: 'kismet',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			metadata: JSON.stringify({ signalType: 'wifi' }) as any
		});
		expect(id.startsWith('wifi_')).toBe(true);
	});
});

describe('dbSignalToMarker', () => {
	it('maps required fields', () => {
		const marker = dbSignalToMarker({
			id: 1,
			signal_id: 's1',
			device_id: 'd1',
			timestamp: 1000,
			latitude: 37.7,
			longitude: -122.4,
			altitude: 10,
			power: -55,
			frequency: 2440,
			bandwidth: null,
			modulation: null,
			source: 'kismet',
			metadata: undefined,
			session_id: null
		});
		expect(marker.id).toBe('s1');
		expect(marker.lat).toBe(37.7);
		expect(marker.lon).toBe(-122.4);
		expect(marker.power).toBe(-55);
		expect(marker.frequency).toBe(2440);
		expect(marker.timestamp).toBe(1000);
	});

	it('parses metadata JSON safely', () => {
		const marker = dbSignalToMarker({
			id: 1,
			signal_id: 's1',
			device_id: 'd1',
			timestamp: 1000,
			latitude: 37.7,
			longitude: -122.4,
			altitude: 0,
			power: -55,
			frequency: 2440,
			bandwidth: null,
			modulation: null,
			source: 'kismet',
			metadata: JSON.stringify({ ssid: 'guest' }),
			session_id: null
		});
		expect((marker.metadata as { ssid?: string })?.ssid).toBe('guest');
	});

	it('handles invalid metadata JSON without throwing', () => {
		const marker = dbSignalToMarker({
			id: 1,
			signal_id: 's1',
			device_id: 'd1',
			timestamp: 1000,
			latitude: 37.7,
			longitude: -122.4,
			altitude: 0,
			power: -55,
			frequency: 2440,
			bandwidth: null,
			modulation: null,
			source: 'kismet',
			metadata: '{ not json',
			session_id: null
		});
		expect(marker.metadata).toEqual({});
	});
});
