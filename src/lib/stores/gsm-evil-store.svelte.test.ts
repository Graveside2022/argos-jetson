import { describe, expect, it } from 'vitest';

import { gsmEvilStore } from './gsm-evil-store.svelte';

describe('gsm-evil-store (Phase 3 / ADR-0003 runes migration)', () => {
	it('current exposes default state', () => {
		gsmEvilStore.reset();
		expect(gsmEvilStore.current.isScanning).toBe(false);
		expect(gsmEvilStore.current.scanResults).toEqual([]);
		expect(gsmEvilStore.current.selectedFrequency).toBe('947.2');
	});

	it('action methods mutate state; getSnapshot mirrors current', () => {
		gsmEvilStore.setSelectedFrequency('900.0');
		gsmEvilStore.setIsScanning(true);
		expect(gsmEvilStore.current.selectedFrequency).toBe('900.0');
		expect(gsmEvilStore.current.isScanning).toBe(true);
		expect(gsmEvilStore.getSnapshot()).toBe(gsmEvilStore.current);
	});

	it('addScanProgress appends and caps progress log', () => {
		gsmEvilStore.reset();
		gsmEvilStore.addScanProgress('line A');
		gsmEvilStore.addScanProgress('line B');
		expect(gsmEvilStore.current.scanProgress).toEqual(['line A', 'line B']);
	});

	it('reset restores defaults', () => {
		gsmEvilStore.setIsScanning(true);
		gsmEvilStore.reset();
		expect(gsmEvilStore.current.isScanning).toBe(false);
	});
});
