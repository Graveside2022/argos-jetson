import { describe, expect, it } from 'vitest';

import type { TakStatus } from '$lib/types/tak';

import { createTakStore } from './tak-store.svelte';

describe('takStore (Phase 3 runes migration)', () => {
	it('seeds disconnected status + empty CoT feed', () => {
		const store = createTakStore();
		expect(store.status.status).toBe('disconnected');
		expect(store.cotMessages).toEqual([]);
	});

	it('setStatus replaces the status wholesale', () => {
		const store = createTakStore();
		const next: TakStatus = { status: 'connected', serverHost: 'tak.local' };
		store.setStatus(next);
		expect(store.status.status).toBe('connected');
		expect(store.status.serverHost).toBe('tak.local');
	});

	it('setCotMessages replaces the CoT feed', () => {
		const store = createTakStore();
		store.setCotMessages(['<event/>', '<event2/>']);
		expect(store.cotMessages).toHaveLength(2);
	});
});
