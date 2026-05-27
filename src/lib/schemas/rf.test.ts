/**
 * Property-based tests for rf.ts — DeviceType, FrequencyRange, sweep schemas.
 */
import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
	DeviceTypeSchema,
	EmergencyStopRequestSchema,
	GPSApiResponseSchema,
	KismetControlResponseSchema,
	KismetDevicesResponseSchema,
	KismetRawDeviceSchema,
	StartSweepRequestSchema,
	StopSweepRequestSchema
} from './rf';

describe('DeviceTypeSchema', () => {
	test('accepts known device types', () => {
		expect(DeviceTypeSchema.safeParse('hackrf').success).toBe(true);
		expect(DeviceTypeSchema.safeParse('b205').success).toBe(true);
		expect(DeviceTypeSchema.safeParse('auto').success).toBe(true);
	});
	test('defaults to hackrf on undefined input', () => {
		expect(DeviceTypeSchema.parse(undefined)).toBe('hackrf');
	});
	test('rejects unknown device types', () => {
		expect(DeviceTypeSchema.safeParse('usrp').success).toBe(false);
		expect(DeviceTypeSchema.safeParse('rtlsdr').success).toBe(false);
	});
});

describe('StartSweepRequestSchema — frequency range bounds', () => {
	const valid = {
		frequencies: [{ start: 2400, stop: 2500 }],
		cycleTime: 10
	};

	test('accepts valid request', () => {
		expect(StartSweepRequestSchema.safeParse(valid).success).toBe(true);
	});

	test('accepts start/end format', () => {
		const r = StartSweepRequestSchema.safeParse({
			...valid,
			frequencies: [{ start: 100, end: 200 }]
		});
		expect(r.success).toBe(true);
	});

	test('accepts plain number center frequency', () => {
		const r = StartSweepRequestSchema.safeParse({ ...valid, frequencies: [2400] });
		expect(r.success).toBe(true);
	});

	test('rejects start frequency below 1 MHz', () => {
		const r = StartSweepRequestSchema.safeParse({
			...valid,
			frequencies: [{ start: 0, stop: 100 }]
		});
		expect(r.success).toBe(false);
	});

	test('rejects stop frequency above 6000 MHz', () => {
		const r = StartSweepRequestSchema.safeParse({
			...valid,
			frequencies: [{ start: 100, stop: 6001 }]
		});
		expect(r.success).toBe(false);
	});

	test('rejects stop <= start', () => {
		const r = StartSweepRequestSchema.safeParse({
			...valid,
			frequencies: [{ start: 100, stop: 100 }]
		});
		expect(r.success).toBe(false);
	});

	test('rejects cycleTime outside [1, 300]', () => {
		expect(StartSweepRequestSchema.safeParse({ ...valid, cycleTime: 0 }).success).toBe(false);
		expect(StartSweepRequestSchema.safeParse({ ...valid, cycleTime: 301 }).success).toBe(false);
	});

	test('rejects > 50 frequency ranges', () => {
		const r = StartSweepRequestSchema.safeParse({
			...valid,
			frequencies: Array(51).fill({ start: 100, stop: 200 })
		});
		expect(r.success).toBe(false);
	});

	test('rejects empty frequencies array', () => {
		expect(
			StartSweepRequestSchema.safeParse({ ...valid, frequencies: [] }).success
		).toBe(false);
	});

	test('property: any in-range start < stop accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: 1, max: 2000, noNaN: true }),
				fc.double({ min: 4000, max: 6000, noNaN: true }),
				(start, stop) =>
					StartSweepRequestSchema.safeParse({
						...valid,
						frequencies: [{ start, stop }]
					}).success
			)
		);
	});
});

describe('StopSweepRequestSchema / EmergencyStopRequestSchema', () => {
	test('accepts minimal payload (deviceType defaults to hackrf)', () => {
		expect(StopSweepRequestSchema.safeParse({}).success).toBe(true);
		expect(EmergencyStopRequestSchema.safeParse({}).success).toBe(true);
	});
});

describe('GPSApiResponseSchema', () => {
	test('accepts a valid GPS response', () => {
		const r = GPSApiResponseSchema.safeParse({
			success: true,
			data: { latitude: 47.5, longitude: 8.5, accuracy: 2.5, satellites: 9 }
		});
		expect(r.success).toBe(true);
	});
	test('rejects lat/lon out of range', () => {
		expect(
			GPSApiResponseSchema.safeParse({
				success: true,
				data: { latitude: 91, longitude: 0 }
			}).success
		).toBe(false);
		expect(
			GPSApiResponseSchema.safeParse({
				success: true,
				data: { latitude: 0, longitude: 181 }
			}).success
		).toBe(false);
	});
});

describe('Kismet response schemas', () => {
	test('KismetDevicesResponseSchema accepts empty / error', () => {
		expect(KismetDevicesResponseSchema.safeParse({}).success).toBe(true);
		expect(KismetDevicesResponseSchema.safeParse({ error: 'down' }).success).toBe(true);
		expect(KismetDevicesResponseSchema.safeParse({ devices: [] }).success).toBe(true);
	});

	test('KismetControlResponseSchema requires success boolean', () => {
		expect(KismetControlResponseSchema.safeParse({ success: true }).success).toBe(true);
		expect(KismetControlResponseSchema.safeParse({}).success).toBe(false);
	});

	test('KismetRawDeviceSchema enforces RssiDbmBounds on last_signal (F6)', () => {
		const ok = KismetRawDeviceSchema.safeParse({
			'kismet.device.base.key': 'k',
			'kismet.device.base.macaddr': 'aa:bb:cc:dd:ee:ff',
			'kismet.device.base.signal': { 'kismet.common.signal.last_signal': -75 }
		});
		expect(ok.success).toBe(true);

		const bad = KismetRawDeviceSchema.safeParse({
			'kismet.device.base.key': 'k',
			'kismet.device.base.macaddr': 'aa:bb:cc:dd:ee:ff',
			'kismet.device.base.signal': { 'kismet.common.signal.last_signal': 10 }
		});
		expect(bad.success).toBe(false);

		const tooLow = KismetRawDeviceSchema.safeParse({
			'kismet.device.base.key': 'k',
			'kismet.device.base.macaddr': 'aa:bb:cc:dd:ee:ff',
			'kismet.device.base.signal': { 'kismet.common.signal.last_signal': -200 }
		});
		expect(tooLow.success).toBe(false);
	});
});
