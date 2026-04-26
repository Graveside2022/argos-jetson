/**
 * Spec-024 PR9a — Zod schemas for /api/spectrum/* request bodies.
 *
 * Reuses `DeviceTypeSchema` from src/lib/schemas/rf.ts:16 — currently
 * `z.enum(['hackrf', 'auto'])`. PR9b extends that enum to include
 * 'b205' (one-character non-breaking change). PR9a's spectrum schemas
 * automatically pick up the extension when it lands; no edits required
 * here.
 *
 * Frequency / bin-width / gain ranges come from the official vendor
 * docs:
 *   - HackRF: https://hackrf.readthedocs.io/en/latest/hackrf_tools.html
 *     (1 MHz – 6 GHz operating range, 2445–5_000_000 Hz bin width)
 *   - B205mini: https://files.ettus.com/manual/page_usrp_b200.html
 *     (70 MHz – 6 GHz, 200 ksps – 61.44 Msps sample rate, 0–76 dB gain)
 *
 * @module
 */

import { z } from 'zod';

import { DeviceTypeSchema } from '$lib/schemas/rf';

// ─── GainConfig — discriminated by device family ──────────────────────────

const HackRFGainSchema = z.object({
	kind: z.literal('hackrf'),
	amp: z.union([z.literal(0), z.literal(1)]).describe('RX RF amplifier on/off'),
	lna: z.number().int().min(0).max(40).describe('RX LNA / IF gain (dB), 8 dB steps'),
	vga: z.number().int().min(0).max(62).describe('RX VGA / baseband gain (dB), 2 dB steps')
});

const B205GainSchema = z.object({
	kind: z.literal('b205'),
	rxGain: z.number().min(0).max(76).describe('AD9364 RX gain (dB)'),
	bandwidth: z.number().positive().optional().describe('Analog filter bandwidth (Hz)')
});

export const GainConfigSchema = z.discriminatedUnion('kind', [HackRFGainSchema, B205GainSchema]);

// ─── Sweep config — per-source `start()` payload ──────────────────────────

export const SpectrumConfigSchema = z
	.object({
		startFreq: z
			.number()
			.min(1_000_000)
			.max(6_000_000_000)
			.describe('Start frequency in Hz (1 MHz – 6 GHz)'),
		endFreq: z
			.number()
			.min(1_000_000)
			.max(6_000_000_000)
			.describe('End frequency in Hz (1 MHz – 6 GHz)'),
		binWidth: z
			.number()
			.min(2_445)
			.max(5_000_000)
			.describe('FFT bin width in Hz (hackrf_sweep -w range: 2445 – 5_000_000)'),
		gain: GainConfigSchema,
		sampleRate: z
			.number()
			.positive()
			.optional()
			.describe('Sample rate in Hz (B205 only; HackRF derives from binWidth)')
	})
	.refine((data) => data.endFreq > data.startFreq, {
		message: 'endFreq must be greater than startFreq',
		path: ['endFreq']
	});

// ─── Request bodies for /api/spectrum/* ──────────────────────────────────

export const StartSpectrumRequestSchema = z.object({
	device: DeviceTypeSchema.optional(),
	config: SpectrumConfigSchema
});

export const StopSpectrumRequestSchema = z.object({
	device: DeviceTypeSchema.optional()
});

export type SpectrumConfigInput = z.infer<typeof SpectrumConfigSchema>;
export type StartSpectrumRequest = z.infer<typeof StartSpectrumRequestSchema>;
export type StopSpectrumRequest = z.infer<typeof StopSpectrumRequestSchema>;
export type GainConfigInput = z.infer<typeof GainConfigSchema>;
