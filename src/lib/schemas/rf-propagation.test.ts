/**
 * Property-based tests for rf-propagation.ts — CloudRF coverage / P2P / route.
 */
import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
	CoverageRequestSchema,
	P2PRequestSchema,
	RouteRequestSchema
} from './rf-propagation';

const baseCoverage = {
	lat: 47.5,
	lon: 8.5,
	frequency: 2400,
	polarization: 1,
	txHeight: 30,
	rxHeight: 2,
	radius: 5
};

describe('CoverageRequestSchema', () => {
	test('accepts a minimal valid request', () => {
		expect(CoverageRequestSchema.safeParse(baseCoverage).success).toBe(true);
	});

	test('rejects lat out of range', () => {
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, lat: 91 }).success).toBe(false);
	});

	test('rejects frequency outside [1, 100000] MHz (CloudRF wide range)', () => {
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, frequency: 0 }).success).toBe(false);
		expect(
			CoverageRequestSchema.safeParse({ ...baseCoverage, frequency: 100_001 }).success
		).toBe(false);
	});

	test('rejects txHeight outside [0.5, 500] m', () => {
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, txHeight: 0.4 }).success).toBe(false);
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, txHeight: 501 }).success).toBe(false);
	});

	test('rejects polarization not 0/1', () => {
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, polarization: 2 }).success).toBe(
			false
		);
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, polarization: -1 }).success).toBe(
			false
		);
	});

	test('rejects rxSensitivity outside [-150, 0] (uses RssiDbmBounds)', () => {
		expect(
			CoverageRequestSchema.safeParse({ ...baseCoverage, rxSensitivity: 10 }).success
		).toBe(false);
		expect(
			CoverageRequestSchema.safeParse({ ...baseCoverage, rxSensitivity: -200 }).success
		).toBe(false);
	});

	test('accepts rxSensitivity at boundaries', () => {
		expect(
			CoverageRequestSchema.safeParse({ ...baseCoverage, rxSensitivity: -150 }).success
		).toBe(true);
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, rxSensitivity: 0 }).success).toBe(
			true
		);
	});

	test('rejects txPower outside [0.001, 100] W', () => {
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, txPower: 0 }).success).toBe(false);
		expect(CoverageRequestSchema.safeParse({ ...baseCoverage, txPower: 101 }).success).toBe(false);
	});

	test('property: in-range polarization (0 or 1) accepted', () => {
		fc.assert(
			fc.property(fc.constantFrom(0, 1), (pol) =>
				CoverageRequestSchema.safeParse({ ...baseCoverage, polarization: pol }).success
			)
		);
	});
});

describe('P2PRequestSchema', () => {
	const validP2P = {
		txLat: 47.5,
		txLon: 8.5,
		rxLat: 47.6,
		rxLon: 8.6,
		frequency: 2400,
		polarization: 1,
		txHeight: 30,
		rxHeight: 2
	};

	test('accepts a valid request', () => {
		expect(P2PRequestSchema.safeParse(validP2P).success).toBe(true);
	});

	test('rejects rxLat out of range', () => {
		expect(P2PRequestSchema.safeParse({ ...validP2P, rxLat: 91 }).success).toBe(false);
	});
});

describe('RouteRequestSchema', () => {
	const validRoute = {
		txLat: 47.5,
		txLon: 8.5,
		frequency: 2400,
		polarization: 1,
		txHeight: 30,
		rxHeight: 2,
		waypoints: [[47.6, 8.6]] as [number, number][]
	};

	test('accepts a valid request', () => {
		expect(RouteRequestSchema.safeParse(validRoute).success).toBe(true);
	});

	test('rejects > 50 waypoints', () => {
		const r = RouteRequestSchema.safeParse({
			...validRoute,
			waypoints: Array(51).fill([47.6, 8.6]) as [number, number][]
		});
		expect(r.success).toBe(false);
	});

	test('rejects empty waypoints', () => {
		expect(
			RouteRequestSchema.safeParse({ ...validRoute, waypoints: [] }).success
		).toBe(false);
	});
});
