import { describe, expect, it } from 'vitest';

import {
	type DeviceForVisibility,
	filterByVisibility,
	promotedDevices,
	visibilityMode
} from './visibility-engine.svelte';

const dev = (mac: string, rssi: number, lastSeen: number): DeviceForVisibility => ({
	mac,
	rssi,
	lastSeen
});

describe('visibility-engine (Phase 3 / ADR-0003 runes migration)', () => {
	it('defaults: mode "all", no promoted devices', () => {
		expect(visibilityMode.current).toBe('all');
		expect(promotedDevices.current.size).toBe(0);
	});

	it('"all" mode returns every device', () => {
		const devs = [dev('a', -50, 0), dev('b', -90, 0)];
		expect(filterByVisibility(devs, 'all', new Set())).toHaveLength(2);
	});

	it('"manual" mode returns only promoted devices', () => {
		const devs = [dev('a', -50, 0), dev('b', -50, 0)];
		expect(filterByVisibility(devs, 'manual', new Set(['a']))).toEqual([devs[0]]);
	});

	it('"dynamic" mode squelches weak signals but keeps promoted', () => {
		const now = 1000;
		const out = filterByVisibility(
			[dev('a', -50, now), dev('b', -90, now), dev('c', -95, now)],
			'dynamic',
			new Set(['c']),
			now
		);
		expect(out.map((d) => d.mac).sort()).toEqual(['a', 'c']);
	});
});
