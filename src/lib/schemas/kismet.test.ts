import { describe, expect, test } from 'vitest';

import { RawKismetDeviceSchema, SimplifiedKismetDeviceSchema } from './kismet';

/**
 * Helper: minimal valid SimplifiedKismetDevice (mac + lastSeen are required).
 */
function validSimplifiedDevice(overrides: Record<string, unknown> = {}) {
	return {
		mac: 'aa:bb:cc:dd:ee:ff',
		lastSeen: Date.now(),
		...overrides
	};
}

describe('SimplifiedKismetDeviceSchema — physical bounds (FINDING-16 regression)', () => {
	test('accepts in-range coordinates and signal', () => {
		const r = SimplifiedKismetDeviceSchema.safeParse(
			validSimplifiedDevice({
				signal: -75,
				location: { lat: 47.5, lon: 8.5 }
			})
		);
		expect(r.success).toBe(true);
	});

	test('rejects location.lat > 90', () => {
		const r = SimplifiedKismetDeviceSchema.safeParse(
			validSimplifiedDevice({ location: { lat: 91, lon: 8 } })
		);
		expect(r.success).toBe(false);
	});

	test('rejects location.lon > 180', () => {
		const r = SimplifiedKismetDeviceSchema.safeParse(
			validSimplifiedDevice({ location: { lat: 47, lon: 181 } })
		);
		expect(r.success).toBe(false);
	});

	test('rejects positive dBm signal (unphysical)', () => {
		const r = SimplifiedKismetDeviceSchema.safeParse(validSimplifiedDevice({ signal: 5 }));
		expect(r.success).toBe(false);
	});

	test('rejects signal < -150', () => {
		const r = SimplifiedKismetDeviceSchema.safeParse(validSimplifiedDevice({ signal: -200 }));
		expect(r.success).toBe(false);
	});
});

describe('RawKismetDeviceSchema — physical bounds on nested kismet.common.* fields', () => {
	test('accepts valid raw payload', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.macaddr': 'aa:bb:cc:dd:ee:ff',
			'kismet.device.base.location': {
				'kismet.common.location.lat': 47.5,
				'kismet.common.location.lon': 8.5
			},
			'kismet.device.base.signal': {
				'kismet.common.signal.last_signal': -80,
				'kismet.common.signal.max_signal': -60
			}
		});
		expect(r.success).toBe(true);
	});

	test('rejects nested lat out of range', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.location': {
				'kismet.common.location.lat': 95,
				'kismet.common.location.lon': 8
			}
		});
		expect(r.success).toBe(false);
	});

	test('rejects nested lon out of range', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.location': {
				'kismet.common.location.lat': 47,
				'kismet.common.location.lon': -200
			}
		});
		expect(r.success).toBe(false);
	});

	test('rejects max_signal > 0 (positive dBm unphysical)', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.signal': {
				'kismet.common.signal.max_signal': 20
			}
		});
		expect(r.success).toBe(false);
	});

	test('rejects last_signal < -150', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.signal': {
				'kismet.common.signal.last_signal': -180
			}
		});
		expect(r.success).toBe(false);
	});

	test('still accepts numeric signal form (kept as RssiDbmBounds via union)', () => {
		const r = RawKismetDeviceSchema.safeParse({
			'kismet.device.base.signal': -75
		});
		expect(r.success).toBe(true);
	});
});
