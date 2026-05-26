import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { SignalBatchRequestSchema, SignalInputSchema } from './api';

/**
 * Helper: minimal valid signal payload — has required coords + frequency/power/timestamp.
 */
function validSignal(overrides: Record<string, unknown> = {}) {
	return {
		lat: 47.5,
		lon: 8.5,
		frequency: 2400,
		power: -70,
		timestamp: Date.now(),
		...overrides
	};
}

describe('SignalInputSchema — physical bounds (FINDING-13 regression)', () => {
	test('accepts a valid signal with in-range stats', () => {
		const r = SignalInputSchema.safeParse(
			validSignal({
				altitude: 500,
				noiseFloor: -100,
				snr: 25,
				peakPower: -45,
				averagePower: -75,
				standardDeviation: 5,
				skewness: 0.2,
				kurtosis: 3.1
			})
		);
		expect(r.success).toBe(true);
	});

	test('rejects altitude > 50km', () => {
		expect(SignalInputSchema.safeParse(validSignal({ altitude: 60_000 })).success).toBe(false);
	});

	test('rejects altitude < -500m', () => {
		expect(SignalInputSchema.safeParse(validSignal({ altitude: -1000 })).success).toBe(false);
	});

	test('rejects nested location.altitude out of range', () => {
		const r = SignalInputSchema.safeParse({
			location: { lat: 47, lon: 8, altitude: 100_000 },
			frequency: 2400,
			power: -70,
			timestamp: Date.now()
		});
		expect(r.success).toBe(false);
	});

	test('rejects noiseFloor > 0 (positive dBm noise floor is unphysical)', () => {
		expect(SignalInputSchema.safeParse(validSignal({ noiseFloor: 10 })).success).toBe(false);
	});

	test('rejects noiseFloor < -150', () => {
		expect(SignalInputSchema.safeParse(validSignal({ noiseFloor: -200 })).success).toBe(false);
	});

	test('rejects snr outside [-50, 200] dB', () => {
		expect(SignalInputSchema.safeParse(validSignal({ snr: -100 })).success).toBe(false);
		expect(SignalInputSchema.safeParse(validSignal({ snr: 500 })).success).toBe(false);
	});

	test('rejects peakPower outside [-150, 50] dBm', () => {
		expect(SignalInputSchema.safeParse(validSignal({ peakPower: 100 })).success).toBe(false);
		expect(SignalInputSchema.safeParse(validSignal({ peakPower: -200 })).success).toBe(false);
	});

	test('rejects averagePower outside [-150, 50] dBm', () => {
		expect(SignalInputSchema.safeParse(validSignal({ averagePower: -300 })).success).toBe(
			false
		);
	});

	test('rejects negative standardDeviation', () => {
		expect(SignalInputSchema.safeParse(validSignal({ standardDeviation: -1 })).success).toBe(
			false
		);
	});

	test('rejects standardDeviation > 1000', () => {
		expect(SignalInputSchema.safeParse(validSignal({ standardDeviation: 2000 })).success).toBe(
			false
		);
	});

	test('rejects skewness/kurtosis outside [-100, 100]', () => {
		expect(SignalInputSchema.safeParse(validSignal({ skewness: 200 })).success).toBe(false);
		expect(SignalInputSchema.safeParse(validSignal({ kurtosis: -150 })).success).toBe(false);
	});

	test('property: any in-range altitude ∈ [-500, 50000] is accepted', () => {
		fc.assert(
			fc.property(fc.double({ min: -500, max: 50_000, noNaN: true }), (altitude) => {
				return SignalInputSchema.safeParse(validSignal({ altitude })).success;
			})
		);
	});

	test('property: any out-of-range noiseFloor (> 0) is rejected', () => {
		fc.assert(
			fc.property(fc.double({ min: 0.01, max: 1e6, noNaN: true }), (noiseFloor) => {
				return !SignalInputSchema.safeParse(validSignal({ noiseFloor })).success;
			})
		);
	});

	test('property: any out-of-range snr (> 200) is rejected', () => {
		fc.assert(
			fc.property(fc.double({ min: 200.01, max: 1e6, noNaN: true }), (snr) => {
				return !SignalInputSchema.safeParse(validSignal({ snr })).success;
			})
		);
	});
});

describe('SignalBatchRequestSchema — composition', () => {
	test('accepts array of valid signals', () => {
		const r = SignalBatchRequestSchema.safeParse([validSignal(), validSignal({ lat: 30 })]);
		expect(r.success).toBe(true);
	});

	test('rejects array if any signal violates bounds', () => {
		const r = SignalBatchRequestSchema.safeParse([validSignal(), validSignal({ snr: 999 })]);
		expect(r.success).toBe(false);
	});
});
