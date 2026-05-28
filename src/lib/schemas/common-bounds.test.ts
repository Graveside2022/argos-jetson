/**
 * Property-based tests for common-bounds.ts — canonical physical bounds.
 * Pattern source: dragonsync.test.ts (PR #245).
 */
import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
	AltMetersBounds,
	BandwidthHzBounds,
	FreqMhzBounds,
	LatBounds,
	LonBounds,
	RssiDbmBounds
} from './common-bounds';

describe('LatBounds [-90, 90]', () => {
	test('accepts boundary values', () => {
		expect(LatBounds.safeParse(-90).success).toBe(true);
		expect(LatBounds.safeParse(90).success).toBe(true);
		expect(LatBounds.safeParse(0).success).toBe(true);
	});
	test('rejects out of range', () => {
		expect(LatBounds.safeParse(-90.001).success).toBe(false);
		expect(LatBounds.safeParse(90.001).success).toBe(false);
	});
	test('property: any value in [-90, 90] is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: -90, max: 90, noNaN: true }),
				(v) => LatBounds.safeParse(v).success
			)
		);
	});
});

describe('LonBounds [-180, 180]', () => {
	test('accepts boundary values', () => {
		expect(LonBounds.safeParse(-180).success).toBe(true);
		expect(LonBounds.safeParse(180).success).toBe(true);
	});
	test('rejects out of range', () => {
		expect(LonBounds.safeParse(-180.001).success).toBe(false);
		expect(LonBounds.safeParse(180.001).success).toBe(false);
	});
	test('property: any value in [-180, 180] is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: -180, max: 180, noNaN: true }),
				(v) => LonBounds.safeParse(v).success
			)
		);
	});
});

describe('AltMetersBounds [-500, 50_000]', () => {
	test('accepts boundary values', () => {
		expect(AltMetersBounds.safeParse(-500).success).toBe(true);
		expect(AltMetersBounds.safeParse(50_000).success).toBe(true);
	});
	test('rejects out of range', () => {
		expect(AltMetersBounds.safeParse(-501).success).toBe(false);
		expect(AltMetersBounds.safeParse(50_001).success).toBe(false);
	});
	test('property: any value in [-500, 50_000] is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: -500, max: 50_000, noNaN: true }),
				(v) => AltMetersBounds.safeParse(v).success
			)
		);
	});
});

describe('RssiDbmBounds [-150, 0]', () => {
	test('accepts boundary values', () => {
		expect(RssiDbmBounds.safeParse(-150).success).toBe(true);
		expect(RssiDbmBounds.safeParse(0).success).toBe(true);
	});
	test('rejects positive dBm (unphysical)', () => {
		expect(RssiDbmBounds.safeParse(0.001).success).toBe(false);
		expect(RssiDbmBounds.safeParse(10).success).toBe(false);
	});
	test('rejects below thermal floor', () => {
		expect(RssiDbmBounds.safeParse(-150.001).success).toBe(false);
		expect(RssiDbmBounds.safeParse(-200).success).toBe(false);
	});
	test('property: any value in [-150, 0] is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: -150, max: 0, noNaN: true }),
				(v) => RssiDbmBounds.safeParse(v).success
			)
		);
	});
});

describe('FreqMhzBounds [1, 6000]', () => {
	test('accepts boundary values', () => {
		expect(FreqMhzBounds.safeParse(1).success).toBe(true);
		expect(FreqMhzBounds.safeParse(6000).success).toBe(true);
		expect(FreqMhzBounds.safeParse(2400).success).toBe(true);
		expect(FreqMhzBounds.safeParse(5800).success).toBe(true);
	});
	test('rejects out of range', () => {
		expect(FreqMhzBounds.safeParse(0.999).success).toBe(false);
		expect(FreqMhzBounds.safeParse(6000.001).success).toBe(false);
		expect(FreqMhzBounds.safeParse(0).success).toBe(false);
	});
	test('property: any value in [1, 6000] MHz is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: 1, max: 6000, noNaN: true }),
				(v) => FreqMhzBounds.safeParse(v).success
			)
		);
	});
});

describe('BandwidthHzBounds (0, 100_000_000]', () => {
	test('accepts boundary values', () => {
		expect(BandwidthHzBounds.safeParse(1).success).toBe(true);
		expect(BandwidthHzBounds.safeParse(20_000_000).success).toBe(true);
		expect(BandwidthHzBounds.safeParse(61_440_000).success).toBe(true);
		expect(BandwidthHzBounds.safeParse(100_000_000).success).toBe(true);
	});
	test('rejects non-positive', () => {
		expect(BandwidthHzBounds.safeParse(0).success).toBe(false);
		expect(BandwidthHzBounds.safeParse(-1).success).toBe(false);
	});
	test('rejects above 100 MHz', () => {
		expect(BandwidthHzBounds.safeParse(100_000_001).success).toBe(false);
		expect(BandwidthHzBounds.safeParse(1e12).success).toBe(false);
	});
	test('property: any value in (0, 100_000_000] is accepted', () => {
		fc.assert(
			fc.property(
				fc.double({ min: 0.001, max: 100_000_000, noNaN: true }),
				(v) => BandwidthHzBounds.safeParse(v).success
			)
		);
	});
});
