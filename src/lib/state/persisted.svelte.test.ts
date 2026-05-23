import { describe, expect, it } from 'vitest';

import { persistedState } from './persisted.svelte';

// In-memory reactive behaviour only — the localStorage load/save logic is
// covered by persisted-storage.test.ts (the pure, browser-mockable helpers).
describe('persistedState (rune wrapper)', () => {
	it('exposes the default value as current', () => {
		expect(persistedState<number>('pw-default', 5).current).toBe(5);
	});

	it('set() updates current in memory', () => {
		const s = persistedState<number>('pw-set', 5);
		s.set(9);
		expect(s.current).toBe(9);
	});
});
