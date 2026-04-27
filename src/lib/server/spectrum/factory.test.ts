import { describe, expect, it } from 'vitest';

import { HardwareDevice } from '$lib/server/hardware/types';

import { B205SpectrumSource } from './b205-source';
import { createSpectrumSource, resolveDeviceType } from './factory';
import { HackRFSpectrumSource } from './hackrf-source';

describe('spectrum factory — createSpectrumSource', () => {
	it('returns a HackRFSpectrumSource for HACKRF', () => {
		const source = createSpectrumSource(HardwareDevice.HACKRF);
		expect(source).toBeInstanceOf(HackRFSpectrumSource);
		expect(source.device).toBe(HardwareDevice.HACKRF);
	});

	it('returns a B205SpectrumSource for B205 (PR9b T050)', () => {
		const source = createSpectrumSource(HardwareDevice.B205);
		expect(source).toBeInstanceOf(B205SpectrumSource);
		expect(source.device).toBe(HardwareDevice.B205);
	});

	it('throws for unsupported devices (ALFA, BLUETOOTH)', () => {
		expect(() => createSpectrumSource(HardwareDevice.ALFA)).toThrow(/No SpectrumSource/);
		expect(() => createSpectrumSource(HardwareDevice.BLUETOOTH)).toThrow(/No SpectrumSource/);
	});
});

describe('spectrum factory — resolveDeviceType', () => {
	it('maps undefined → HACKRF', () => {
		expect(resolveDeviceType(undefined)).toBe(HardwareDevice.HACKRF);
	});

	it("maps 'hackrf' → HACKRF", () => {
		expect(resolveDeviceType('hackrf')).toBe(HardwareDevice.HACKRF);
	});

	it("maps 'auto' → HACKRF (PR9a default; PR9b may diversify)", () => {
		expect(resolveDeviceType('auto')).toBe(HardwareDevice.HACKRF);
	});

	it("maps 'b205' → B205", () => {
		expect(resolveDeviceType('b205')).toBe(HardwareDevice.B205);
	});

	it('throws on unknown deviceType strings', () => {
		expect(() => resolveDeviceType('lime-sdr')).toThrow(/Unknown deviceType/);
	});
});
