/**
 * Property-based tests for spectrum.ts — /api/spectrum/* sweep config.
 */
import { describe, expect, test } from 'vitest';

import { StartSpectrumRequestSchema } from './spectrum';

const validHackrfConfig = {
	startFreq: 2_400_000_000,
	endFreq: 2_500_000_000,
	binWidth: 25_000,
	gain: { kind: 'hackrf' as const, amp: 0 as 0 | 1, lna: 16, vga: 20 }
};

const validB205Config = {
	startFreq: 2_400_000_000,
	endFreq: 2_500_000_000,
	binWidth: 25_000,
	gain: { kind: 'b205' as const, rxGain: 40 },
	sampleRate: 20_000_000
};

describe('StartSpectrumRequestSchema (HackRF)', () => {
	test('accepts a valid HackRF config', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: validHackrfConfig
		});
		expect(r.success).toBe(true);
	});

	test('accepts payload without device (default fires)', () => {
		expect(StartSpectrumRequestSchema.safeParse({ config: validHackrfConfig }).success).toBe(true);
	});

	test('rejects startFreq below 1 MHz', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: { ...validHackrfConfig, startFreq: 999_999 }
		});
		expect(r.success).toBe(false);
	});

	test('rejects endFreq above 6 GHz', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: { ...validHackrfConfig, endFreq: 6_000_000_001 }
		});
		expect(r.success).toBe(false);
	});

	test('rejects endFreq <= startFreq', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: { ...validHackrfConfig, endFreq: validHackrfConfig.startFreq }
		});
		expect(r.success).toBe(false);
	});

	test('rejects binWidth outside [2445, 5_000_000]', () => {
		expect(
			StartSpectrumRequestSchema.safeParse({
				device: 'hackrf',
				config: { ...validHackrfConfig, binWidth: 2444 }
			}).success
		).toBe(false);
		expect(
			StartSpectrumRequestSchema.safeParse({
				device: 'hackrf',
				config: { ...validHackrfConfig, binWidth: 5_000_001 }
			}).success
		).toBe(false);
	});

	test('rejects HackRF lna outside [0, 40]', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: { ...validHackrfConfig, gain: { ...validHackrfConfig.gain, lna: 41 } }
		});
		expect(r.success).toBe(false);
	});

	test('rejects HackRF vga outside [0, 62]', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: { ...validHackrfConfig, gain: { ...validHackrfConfig.gain, vga: 63 } }
		});
		expect(r.success).toBe(false);
	});

	test('rejects HackRF amp not 0/1', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'hackrf',
			config: {
				...validHackrfConfig,
				gain: { ...validHackrfConfig.gain, amp: 2 as unknown as 0 | 1 }
			}
		});
		expect(r.success).toBe(false);
	});
});

describe('StartSpectrumRequestSchema (B205)', () => {
	test('accepts a valid B205 config', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'b205',
			config: validB205Config
		});
		expect(r.success).toBe(true);
	});

	test('rejects B205 rxGain outside [0, 76]', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'b205',
			config: { ...validB205Config, gain: { kind: 'b205' as const, rxGain: 77 } }
		});
		expect(r.success).toBe(false);
	});

	test('discriminated union — HackRF kind cannot use rxGain field', () => {
		const r = StartSpectrumRequestSchema.safeParse({
			device: 'b205',
			config: { ...validB205Config, gain: { kind: 'hackrf', rxGain: 40 } }
		});
		expect(r.success).toBe(false);
	});
});
