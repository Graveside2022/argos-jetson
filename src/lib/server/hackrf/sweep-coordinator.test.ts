import { describe, expect, it } from 'vitest';

import { sweepArgsFromCenter } from './sweep-coordinator';

describe('sweepArgsFromCenter', () => {
	it('returns ±10 MHz window around the center frequency', () => {
		const args = sweepArgsFromCenter({ value: 100, unit: 'MHz' });
		expect(args.startMHz).toBe(90);
		expect(args.endMHz).toBe(110);
	});

	it('uses 100 kHz default bin width — verified to produce stdout on /usr/bin/hackrf_sweep', () => {
		const args = sweepArgsFromCenter({ value: 100, unit: 'MHz' });
		expect(args.binWidthHz).toBe(100_000);
	});

	it('converts non-MHz units via convertToMHz', () => {
		const argsHz = sweepArgsFromCenter({ value: 100_000_000, unit: 'Hz' });
		expect(argsHz.startMHz).toBeCloseTo(90);
		expect(argsHz.endMHz).toBeCloseTo(110);
	});

	it('does NOT pre-populate lnaGain or vgaGain — buildHackrfArgs derives them per-band', () => {
		const args = sweepArgsFromCenter({ value: 100, unit: 'MHz' });
		expect(args.lnaGain).toBeUndefined();
		expect(args.vgaGain).toBeUndefined();
	});
});
