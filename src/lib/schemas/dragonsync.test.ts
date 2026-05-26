import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { DragonSyncDronesResponseSchema, DragonSyncFpvSignalsResponseSchema } from './dragonsync';

/**
 * Helper: minimal valid drone payload (everything else defaults).
 */
function validDrone(overrides: Record<string, unknown> = {}) {
	return {
		id: 'test-drone',
		...overrides
	};
}

function validFpvSignal(overrides: Record<string, unknown> = {}) {
	return {
		uid: 'test-fpv',
		...overrides
	};
}

describe('DragonSyncDroneSchema — physical bounds (regression for BUG-2)', () => {
	test('accepts in-range coordinates', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ lat: 47.5, lon: 8.5, alt: 1000, direction: 180 })]
		});
		expect(r.success).toBe(true);
	});

	test('rejects latitude > 90', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ lat: 91 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects latitude < -90', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ lat: -90.01 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects longitude > 180', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ lon: 200 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects longitude < -180', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ lon: -180.01 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects altitude > 50km', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ alt: 60_000 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects altitude < -500m', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ alt: -1000 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects negative height (height-above-ground is non-negative)', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ height: -5 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects speed > 300 m/s (faster than any drone or small aircraft)', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ speed: 500 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects negative speed', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ speed: -1 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects vspeed outside ±200 m/s', () => {
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ vspeed: 300 })] })
				.success
		).toBe(false);
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ vspeed: -300 })] })
				.success
		).toBe(false);
	});

	test('rejects direction outside [0, 360]', () => {
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ direction: -1 })] })
				.success
		).toBe(false);
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ direction: 361 })] })
				.success
		).toBe(false);
	});

	test('accepts direction = null (sensor unable to report)', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ direction: null })]
		});
		expect(r.success).toBe(true);
	});

	test('rejects pilot_lat / pilot_lon / home_lat / home_lon out of range', () => {
		for (const field of ['pilot_lat', 'home_lat'] as const) {
			expect(
				DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ [field]: 91 })] })
					.success
			).toBe(false);
		}
		for (const field of ['pilot_lon', 'home_lon'] as const) {
			expect(
				DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ [field]: 181 })] })
					.success
			).toBe(false);
		}
	});

	test('rejects rssi > 0 (positive dBm is unphysical)', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ rssi: 10 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects rssi < -150 (well below thermal noise floor)', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ rssi: -200 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects frequency outside [1, 100000] MHz', () => {
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ freq: 0 })] }).success
		).toBe(false);
		expect(
			DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ freq: 200_000 })] })
				.success
		).toBe(false);
	});

	test('rejects negative last_update_time', () => {
		const r = DragonSyncDronesResponseSchema.safeParse({
			drones: [validDrone({ last_update_time: -1 })]
		});
		expect(r.success).toBe(false);
	});

	test('property: any in-range lat ∈ [-90, 90] is accepted', () => {
		fc.assert(
			fc.property(fc.double({ min: -90, max: 90, noNaN: true }), (lat) => {
				return DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ lat })] })
					.success;
			})
		);
	});

	test('property: any out-of-range lat is rejected', () => {
		fc.assert(
			fc.property(fc.double({ min: 90.01, max: 1e6, noNaN: true }), (lat) => {
				return !DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ lat })] })
					.success;
			})
		);
	});

	test('property: any out-of-range lon is rejected', () => {
		fc.assert(
			fc.property(fc.double({ min: 180.01, max: 1e6, noNaN: true }), (lon) => {
				return !DragonSyncDronesResponseSchema.safeParse({ drones: [validDrone({ lon })] })
					.success;
			})
		);
	});
});

describe('DragonSyncFpvSignalSchema — physical bounds', () => {
	test('rejects sensor coordinates out of range', () => {
		expect(
			DragonSyncFpvSignalsResponseSchema.safeParse({
				signals: [validFpvSignal({ sensor_lat: 100 })]
			}).success
		).toBe(false);
		expect(
			DragonSyncFpvSignalsResponseSchema.safeParse({
				signals: [validFpvSignal({ sensor_lon: 200 })]
			}).success
		).toBe(false);
	});

	test('rejects negative center_hz (frequency must be positive)', () => {
		const r = DragonSyncFpvSignalsResponseSchema.safeParse({
			signals: [validFpvSignal({ center_hz: -100 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects negative bandwidth_hz', () => {
		const r = DragonSyncFpvSignalsResponseSchema.safeParse({
			signals: [validFpvSignal({ bandwidth_hz: -1 })]
		});
		expect(r.success).toBe(false);
	});

	test('rejects pal_conf outside [0, 1] (confidence is a probability)', () => {
		expect(
			DragonSyncFpvSignalsResponseSchema.safeParse({
				signals: [validFpvSignal({ pal_conf: 1.5 })]
			}).success
		).toBe(false);
		expect(
			DragonSyncFpvSignalsResponseSchema.safeParse({
				signals: [validFpvSignal({ pal_conf: -0.1 })]
			}).success
		).toBe(false);
	});

	test('rejects radius_m <= 0', () => {
		const r = DragonSyncFpvSignalsResponseSchema.safeParse({
			signals: [validFpvSignal({ radius_m: 0 })]
		});
		expect(r.success).toBe(false);
	});

	test('accepts valid FPV signal payload', () => {
		const r = DragonSyncFpvSignalsResponseSchema.safeParse({
			signals: [
				validFpvSignal({
					sensor_lat: 47.5,
					sensor_lon: 8.5,
					sensor_alt: 100,
					lat: 47.51,
					lon: 8.51,
					alt: 200,
					center_hz: 2_400_000_000,
					bandwidth_hz: 20_000_000,
					rssi: -75,
					pal_conf: 0.85,
					ntsc_conf: 0.1,
					radius_m: 50
				})
			]
		});
		expect(r.success).toBe(true);
	});
});
