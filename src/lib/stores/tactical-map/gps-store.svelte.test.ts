import { describe, expect, it } from 'vitest';

import { gpsStore, updateGPSPosition } from './gps-store.svelte';

describe('gps-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('defaults to no-fix at origin', () => {
		expect(gpsStore.current.position).toEqual({ lat: 0, lon: 0 });
		expect(gpsStore.current.status.hasGPSFix).toBe(false);
	});

	it('updateGPSPosition applies a valid position', () => {
		updateGPSPosition({ lat: 50.01, lon: 8.28 });
		expect(gpsStore.current.position.lat).toBeCloseTo(50.01);
		expect(gpsStore.current.position.lon).toBeCloseTo(8.28);
	});

	it('set replaces the whole state', () => {
		const next = {
			position: { lat: 1, lon: 2 },
			status: { ...gpsStore.current.status, hasGPSFix: true, satellites: 7 }
		};
		gpsStore.set(next);
		expect(gpsStore.current.status.hasGPSFix).toBe(true);
		expect(gpsStore.current.status.satellites).toBe(7);
	});
});
