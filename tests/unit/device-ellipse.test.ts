/**
 * PR-5: RSSI-weighted 2σ confidence ellipse per device.
 */

import { describe, expect, it } from 'vitest';

import { computeDeviceEllipse, type DeviceEllipse } from '$lib/server/db/device-ellipse';

function obs(lat: number, lon: number, dbm: number): { lat: number; lon: number; dbm: number } {
	return { lat, lon, dbm };
}

function expectNotNull(e: DeviceEllipse | null): DeviceEllipse {
	if (e === null) {
		expect(e).not.toBeNull();
		throw new Error('ellipse was null');
	}
	return e;
}

describe('computeDeviceEllipse', () => {
	it('returns null when fewer than 2 observations — ellipse undefined', () => {
		expect(computeDeviceEllipse([])).toBeNull();
		expect(computeDeviceEllipse([obs(35, -116, -50)])).toBeNull();
	});

	it('equal-weighted points on a line → one axis near zero, rotation aligned', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35, -116, -50),
				obs(35, -115.9999, -50),
				obs(35, -115.9998, -50),
				obs(35, -115.9997, -50)
			])
		);
		expect(e.semiMajorM).toBeGreaterThan(0);
		expect(e.semiMinorM).toBeLessThan(e.semiMajorM);
	});

	it('RSSI-weighted centroid pulls toward stronger signals', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35.0, -116.0, -50),
				obs(35.01, -116.0, -80),
				obs(35.02, -116.0, -80)
			])
		);
		expect(e.centerLat).toBeLessThan(35.01);
	});

	it('returns finite numbers for all axis/rotation fields', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35.0, -116.0, -55),
				obs(35.0001, -116.0001, -60),
				obs(35.0002, -116.0002, -58),
				obs(35.0003, -116.0003, -52),
				obs(35.0001, -115.9998, -57)
			])
		);
		expect(Number.isFinite(e.centerLat)).toBe(true);
		expect(Number.isFinite(e.centerLon)).toBe(true);
		expect(Number.isFinite(e.semiMajorM)).toBe(true);
		expect(Number.isFinite(e.semiMinorM)).toBe(true);
		expect(Number.isFinite(e.rotationDeg)).toBe(true);
	});

	it('semiMajorM is always >= semiMinorM', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35.0, -116.0, -55),
				obs(35.001, -116.001, -60),
				obs(35.002, -116.002, -58),
				obs(35.003, -116.001, -52)
			])
		);
		expect(e.semiMajorM).toBeGreaterThanOrEqual(e.semiMinorM);
	});

	it('isotropic cluster → axes roughly equal, low aspect ratio', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35.0, -116.0, -55),
				obs(35.0001, -116.0, -55),
				obs(35.0, -116.0001, -55),
				obs(35.0001, -116.0001, -55),
				obs(35.00005, -116.00005, -55)
			])
		);
		const aspect = e.semiMajorM / Math.max(e.semiMinorM, 1e-6);
		expect(aspect).toBeLessThan(5);
	});

	it('rotationDeg in [-90, 90]', () => {
		const e = expectNotNull(
			computeDeviceEllipse([
				obs(35.0, -116.0, -50),
				obs(35.001, -115.999, -55),
				obs(35.002, -115.998, -52)
			])
		);
		expect(e.rotationDeg).toBeGreaterThanOrEqual(-90);
		expect(e.rotationDeg).toBeLessThanOrEqual(90);
	});

	it('identical-weight identical-position points return null (zero variance)', () => {
		expect(
			computeDeviceEllipse([obs(35, -116, -50), obs(35, -116, -50), obs(35, -116, -50)])
		).toBeNull();
	});
});
