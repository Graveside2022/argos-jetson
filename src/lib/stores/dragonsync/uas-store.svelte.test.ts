import { describe, expect, it } from 'vitest';

import type { UASState } from './uas-store.svelte';
import { uasStore } from './uas-store.svelte';

const base = (): UASState => ({
	status: 'stopped',
	drones: new Map(),
	fpvSignals: new Map(),
	c2Signals: new Map(),
	error: null,
	lastUpdated: null,
	droneidGoRunning: false,
	dragonSyncRunning: false,
	fpvScannerRunning: false,
	c2ScannerRunning: false,
	apiReachable: false
});

describe('uas-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('defaults to stopped with empty collections', () => {
		uasStore.set(base());
		expect(uasStore.current.status).toBe('stopped');
		expect(uasStore.current.drones.size).toBe(0);
	});

	it('set replaces the whole state reactively', () => {
		const drones = new Map([['d1', { id: 'd1' } as never]]);
		uasStore.set({ ...base(), status: 'running', drones });
		expect(uasStore.current.status).toBe('running');
		expect(uasStore.current.drones.get('d1')).toBeTruthy();
	});

	it('current reflects the latest set (raw reassignment)', () => {
		uasStore.set({ ...base(), error: 'boom' });
		expect(uasStore.current.error).toBe('boom');
		uasStore.set(base());
		expect(uasStore.current.error).toBeNull();
	});
});
