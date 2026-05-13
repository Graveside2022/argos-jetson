import { describe, expect, it } from 'vitest';

import { buildHackrfArgs, sweepArgsFromCenter } from './sweep-coordinator';

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

describe('buildHackrfArgs — regression for invalid -P/-n flags', () => {
	const baseArgs = {
		startMHz: 88,
		endMHz: 108,
		binWidthHz: 100_000
	};

	it('NEVER emits -P (rejected by /usr/bin/hackrf_sweep with `invalid option -- "P"`)', () => {
		const args = buildHackrfArgs(baseArgs);
		expect(args).not.toContain('-P');
		expect(args).not.toContain('estimate');
	});

	it('NEVER emits -n (the python_hackrf bridge flag; not on standard binary)', () => {
		const args = buildHackrfArgs(baseArgs);
		expect(args).not.toContain('-n');
	});

	it('emits the documented hackrf_sweep CLI flag set: -f -g -l -w', () => {
		const args = buildHackrfArgs(baseArgs);
		expect(args).toContain('-f');
		expect(args).toContain('-g');
		expect(args).toContain('-l');
		expect(args).toContain('-w');
		// -f's value is "start:end" in MHz
		const fIdx = args.indexOf('-f');
		expect(args[fIdx + 1]).toBe('88:108');
		// -w's value is the bin width in Hz as string
		const wIdx = args.indexOf('-w');
		expect(args[wIdx + 1]).toBe('100000');
	});

	it('respects caller-supplied lnaGain / vgaGain overrides', () => {
		const args = buildHackrfArgs({ ...baseArgs, lnaGain: '40', vgaGain: '50' });
		const lIdx = args.indexOf('-l');
		const gIdx = args.indexOf('-g');
		expect(args[lIdx + 1]).toBe('40');
		expect(args[gIdx + 1]).toBe('50');
	});
});

describe('sweepArgsFromCenter — override merge (bug C2)', () => {
	const fm = { value: 100, unit: 'MHz' };

	it('without override uses 100 kHz default bin width', () => {
		const args = sweepArgsFromCenter(fm);
		expect(args.binWidthHz).toBe(100_000);
		expect(args.lnaGain).toBeUndefined();
		expect(args.vgaGain).toBeUndefined();
	});

	it('caller-supplied binWidthHz wins over default', () => {
		const args = sweepArgsFromCenter(fm, { binWidthHz: 50_000 });
		expect(args.binWidthHz).toBe(50_000);
	});

	it('caller-supplied lnaGain / vgaGain pass through', () => {
		const args = sweepArgsFromCenter(fm, { lnaGain: '24', vgaGain: '18' });
		expect(args.lnaGain).toBe('24');
		expect(args.vgaGain).toBe('18');
	});

	it('partial override leaves window from center, only patches supplied fields', () => {
		const args = sweepArgsFromCenter(fm, { binWidthHz: 500_000 });
		expect(args.startMHz).toBe(90);
		expect(args.endMHz).toBe(110);
		expect(args.binWidthHz).toBe(500_000);
	});

	it('empty override behaves as no override (defaults retained)', () => {
		const args = sweepArgsFromCenter(fm, {});
		expect(args.binWidthHz).toBe(100_000);
		expect(args.lnaGain).toBeUndefined();
	});
});
