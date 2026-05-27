/**
 * Property-based tests for database.ts — DbSignal + DbDevice physical bounds.
 */
import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { DbDeviceSchema, DbSignalSchema } from './database';

function validSignal(overrides: Record<string, unknown> = {}) {
	return {
		signal_id: 'sig-1',
		timestamp: 1_700_000_000_000,
		latitude: 47.5,
		longitude: 8.5,
		power: -75,
		frequency: 2412,
		source: 'hackrf',
		...overrides
	};
}

function validDevice(overrides: Record<string, unknown> = {}) {
	return {
		device_id: 'dev-1',
		type: 'wifi',
		first_seen: 1_700_000_000_000,
		last_seen: 1_700_000_001_000,
		...overrides
	};
}

describe('DbSignalSchema — bounds regressions', () => {
	test('accepts a valid signal', () => {
		expect(DbSignalSchema.safeParse(validSignal()).success).toBe(true);
	});

	test('rejects altitude outside [-500, 50_000]', () => {
		expect(DbSignalSchema.safeParse(validSignal({ altitude: -501 })).success).toBe(false);
		expect(DbSignalSchema.safeParse(validSignal({ altitude: 50_001 })).success).toBe(false);
		expect(DbSignalSchema.safeParse(validSignal({ altitude: Infinity })).success).toBe(false);
	});

	test('accepts altitude at boundaries', () => {
		expect(DbSignalSchema.safeParse(validSignal({ altitude: -500 })).success).toBe(true);
		expect(DbSignalSchema.safeParse(validSignal({ altitude: 50_000 })).success).toBe(true);
	});

	test('rejects power outside [-150, 0] (relaxed from -120)', () => {
		expect(DbSignalSchema.safeParse(validSignal({ power: -151 })).success).toBe(false);
		expect(DbSignalSchema.safeParse(validSignal({ power: 1 })).success).toBe(false);
	});

	test('accepts power between -150 and -120 (new range, was rejected pre-F1)', () => {
		expect(DbSignalSchema.safeParse(validSignal({ power: -149 })).success).toBe(true);
		expect(DbSignalSchema.safeParse(validSignal({ power: -130 })).success).toBe(true);
	});

	test('rejects frequency outside [1, 6000] MHz', () => {
		expect(DbSignalSchema.safeParse(validSignal({ frequency: 0 })).success).toBe(false);
		expect(DbSignalSchema.safeParse(validSignal({ frequency: 6001 })).success).toBe(false);
	});

	test('property: any in-range power is accepted', () => {
		fc.assert(
			fc.property(fc.double({ min: -150, max: 0, noNaN: true }), (power) =>
				DbSignalSchema.safeParse(validSignal({ power })).success
			)
		);
	});
});

describe('DbDeviceSchema — bounds regressions', () => {
	test('accepts a valid device', () => {
		expect(DbDeviceSchema.safeParse(validDevice()).success).toBe(true);
	});

	test('rejects avg_power outside [-150, 0]', () => {
		expect(DbDeviceSchema.safeParse(validDevice({ avg_power: -151 })).success).toBe(false);
		expect(DbDeviceSchema.safeParse(validDevice({ avg_power: 1 })).success).toBe(false);
	});

	test('accepts avg_power between -150 and 0', () => {
		expect(DbDeviceSchema.safeParse(validDevice({ avg_power: -75 })).success).toBe(true);
	});

	test('rejects freq_min/freq_max outside [1, 6000]', () => {
		expect(DbDeviceSchema.safeParse(validDevice({ freq_min: 0 })).success).toBe(false);
		expect(DbDeviceSchema.safeParse(validDevice({ freq_max: 6001 })).success).toBe(false);
		expect(DbDeviceSchema.safeParse(validDevice({ freq_min: 1e18 })).success).toBe(false);
	});

	test('accepts freq_min/freq_max at boundaries', () => {
		expect(DbDeviceSchema.safeParse(validDevice({ freq_min: 1, freq_max: 6000 })).success).toBe(
			true
		);
	});
});
