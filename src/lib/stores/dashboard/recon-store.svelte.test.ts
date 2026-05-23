import { describe, expect, it } from 'vitest';

import {
	busyAPs,
	gpsTracked,
	hiddenNetworks,
	reconAlerts,
	reconStatus,
	reconTargets,
	weakSecurityTargets,
	wpsTargets
} from './recon-store.svelte';

describe('recon-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('reconStatus defaults to idle and is settable', () => {
		expect(reconStatus.current).toBe('idle');
		reconStatus.set('ready');
		expect(reconStatus.current).toBe('ready');
		reconStatus.set('idle');
	});

	it('derived views return empty arrays before any data fetch', () => {
		expect(reconTargets.current).toEqual([]);
		expect(reconAlerts.current).toEqual([]);
		expect(weakSecurityTargets.current).toEqual([]);
		expect(wpsTargets.current).toEqual([]);
		expect(hiddenNetworks.current).toEqual([]);
		expect(busyAPs.current).toEqual([]);
		expect(gpsTracked.current).toEqual([]);
	});
});
