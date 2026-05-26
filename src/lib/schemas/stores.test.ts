/**
 * Property-based tests for stores.ts — GPS + SimplifiedSignal store validation.
 */
import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { GPSPositionSchema, GPSStatusSchema, SimplifiedSignalSchema } from './stores';

describe('GPSPositionSchema', () => {
	test('accepts in-range coords', () => {
		expect(GPSPositionSchema.safeParse({ lat: 47.5, lon: 8.5 }).success).toBe(true);
	});
	test('rejects lat out of range', () => {
		expect(GPSPositionSchema.safeParse({ lat: 91, lon: 0 }).success).toBe(false);
		expect(GPSPositionSchema.safeParse({ lat: -91, lon: 0 }).success).toBe(false);
	});
	test('rejects lon out of range', () => {
		expect(GPSPositionSchema.safeParse({ lat: 0, lon: 181 }).success).toBe(false);
		expect(GPSPositionSchema.safeParse({ lat: 0, lon: -181 }).success).toBe(false);
	});
});

describe('GPSStatusSchema', () => {
	const valid = {
		hasGPSFix: true,
		gpsStatus: 'fix-3d',
		accuracy: 2.5,
		satellites: 9,
		fixType: '3D',
		heading: 180,
		speed: 5,
		altitude: 50,
		currentCountry: { name: 'Switzerland', flag: 'CH' },
		formattedCoords: { lat: '47.5', lon: '8.5' },
		mgrsCoord: '32TLT0000000000'
	};

	test('accepts a valid status', () => {
		expect(GPSStatusSchema.safeParse(valid).success).toBe(true);
	});

	test('rejects heading outside [0, 360]', () => {
		expect(GPSStatusSchema.safeParse({ ...valid, heading: -1 }).success).toBe(false);
		expect(GPSStatusSchema.safeParse({ ...valid, heading: 361 }).success).toBe(false);
	});

	test('accepts heading = null (sensor unable to report)', () => {
		expect(GPSStatusSchema.safeParse({ ...valid, heading: null }).success).toBe(true);
	});

	test('rejects negative speed / accuracy / satellites', () => {
		expect(GPSStatusSchema.safeParse({ ...valid, speed: -1 }).success).toBe(false);
		expect(GPSStatusSchema.safeParse({ ...valid, accuracy: -0.1 }).success).toBe(false);
		expect(GPSStatusSchema.safeParse({ ...valid, satellites: -1 }).success).toBe(false);
	});
});

describe('SimplifiedSignalSchema — bounds via common-bounds', () => {
	function valid(overrides: Record<string, unknown> = {}) {
		return {
			id: 'sig-1',
			frequency: 2412,
			power: -75,
			lat: 47.5,
			lon: 8.5,
			timestamp: 1_700_000_000_000,
			count: 1,
			...overrides
		};
	}

	test('accepts valid signal', () => {
		expect(SimplifiedSignalSchema.safeParse(valid()).success).toBe(true);
	});

	test('accepts power between -150 and -120 (new range)', () => {
		expect(SimplifiedSignalSchema.safeParse(valid({ power: -140 })).success).toBe(true);
	});

	test('rejects power > 0', () => {
		expect(SimplifiedSignalSchema.safeParse(valid({ power: 1 })).success).toBe(false);
	});

	test('rejects frequency outside [1, 6000] MHz', () => {
		expect(SimplifiedSignalSchema.safeParse(valid({ frequency: 0 })).success).toBe(false);
		expect(SimplifiedSignalSchema.safeParse(valid({ frequency: 6001 })).success).toBe(false);
	});

	test('property: any in-range frequency accepted', () => {
		fc.assert(
			fc.property(fc.double({ min: 1, max: 6000, noNaN: true }), (frequency) =>
				SimplifiedSignalSchema.safeParse(valid({ frequency })).success
			)
		);
	});
});
