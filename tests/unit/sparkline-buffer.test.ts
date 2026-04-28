import { describe, expect, it } from 'vitest';

import { bytesPerSecond, METRIC_WINDOW, pushSample } from '../../src/lib/utils/sparkline-buffer';

describe('pushSample', () => {
	it('appends to an empty buffer', () => {
		expect(pushSample([], 1)).toEqual([1]);
	});

	it('appends without evicting until the cap is reached', () => {
		const seed = [1, 2, 3];
		expect(pushSample(seed, 4, 5)).toEqual([1, 2, 3, 4]);
	});

	it('evicts the oldest entry when at the cap', () => {
		const seed = [1, 2, 3, 4, 5];
		expect(pushSample(seed, 6, 5)).toEqual([2, 3, 4, 5, 6]);
	});

	it('evicts multiple entries when buffer length exceeds cap', () => {
		// Defensive against a caller passing in a stale longer-than-cap buffer
		// (e.g. lsState restored from a previous METRIC_WINDOW value).
		const oversized = [1, 2, 3, 4, 5, 6, 7, 8];
		expect(pushSample(oversized, 9, 5)).toEqual([5, 6, 7, 8, 9]);
	});

	it('returns an empty array when max is 0 or negative', () => {
		expect(pushSample([1, 2, 3], 4, 0)).toEqual([]);
		expect(pushSample([], 1, -10)).toEqual([]);
	});

	it('does not mutate the input buffer', () => {
		const seed = [1, 2, 3];
		pushSample(seed, 4, 3);
		expect(seed).toEqual([1, 2, 3]);
	});

	it('defaults max to METRIC_WINDOW', () => {
		const full = Array.from({ length: METRIC_WINDOW }, (_, i) => i);
		const next = pushSample(full, 999);
		expect(next.length).toBe(METRIC_WINDOW);
		expect(next[next.length - 1]).toBe(999);
		expect(next[0]).toBe(1);
	});
});

describe('bytesPerSecond', () => {
	it('returns 0 on the first sample (no baseline)', () => {
		expect(bytesPerSecond(null, { bytes: 1024, t: 1000 })).toBe(0);
	});

	it('computes MB/s from a positive byte delta over a positive time delta', () => {
		// 1 MiB transferred over 1s → 1 MB/s
		const oneMiB = 1024 * 1024;
		const result = bytesPerSecond({ bytes: 0, t: 0 }, { bytes: oneMiB, t: 1000 });
		expect(result).toBeCloseTo(1, 5);
	});

	it('halves throughput when time delta doubles', () => {
		const oneMiB = 1024 * 1024;
		const result = bytesPerSecond({ bytes: 0, t: 0 }, { bytes: oneMiB, t: 2000 });
		expect(result).toBeCloseTo(0.5, 5);
	});

	it('returns 0 when timestamps are identical (no division by zero)', () => {
		expect(bytesPerSecond({ bytes: 0, t: 1000 }, { bytes: 1024, t: 1000 })).toBe(0);
	});

	it('returns 0 on negative time delta (clock skew / reorder)', () => {
		expect(bytesPerSecond({ bytes: 0, t: 2000 }, { bytes: 1024, t: 1000 })).toBe(0);
	});

	it('returns 0 on negative byte delta (counter wrap / iface restart)', () => {
		// Counter restart: prev sample was 5 MiB into a session, curr is mid-1 MiB
		// after reset. Don't surface a phantom negative MB/s.
		const fiveMiB = 5 * 1024 * 1024;
		const oneMiB = 1024 * 1024;
		expect(bytesPerSecond({ bytes: fiveMiB, t: 0 }, { bytes: oneMiB, t: 1000 })).toBe(0);
	});
});
