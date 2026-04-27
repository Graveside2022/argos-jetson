import { describe, expect, it } from 'vitest';

import { HardwareDevice } from '$lib/server/hardware/types';

import { createSpectrumSource, resolveDeviceType } from './factory';
import { HackRFSpectrumSource } from './hackrf-source';

describe('spectrum factory — createSpectrumSource', () => {
	it('returns a HackRFSpectrumSource for HACKRF', () => {
		const source = createSpectrumSource(HardwareDevice.HACKRF);
		expect(source).toBeInstanceOf(HackRFSpectrumSource);
		expect(source.device).toBe(HardwareDevice.HACKRF);
	});

	it('throws for B205 in PR9a (lands in PR9b)', () => {
		expect(() => createSpectrumSource(HardwareDevice.B205)).toThrow(/PR9b/);
		// Lock exact deferred-feature anchor — guards against accidental
		// message drift before PR9b lands and updates this branch.
		expect(() => createSpectrumSource(HardwareDevice.B205)).toThrow(
			/B205SpectrumSource lands in spec-024 PR9b/
		);
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
