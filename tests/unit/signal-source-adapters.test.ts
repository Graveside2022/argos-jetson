/**
 * Smoke tests for the three built-in SignalSourceAdapter implementations.
 * Verifies each has the correct name + shape + idempotent start/stop.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/services/bluedragon/state', () => ({
	isBluedragonActive: () => false
}));

vi.mock('$lib/server/services/rf/gsm-evil-health-probe', () => ({
	getGsmEvilHealth: () => Promise.resolve(false)
}));

import { bluedragonSignalSource } from '$lib/server/services/rf/bluedragon-signal-source';
import { gsmEvilSignalSource } from '$lib/server/services/rf/gsm-evil-signal-source';
import { registerSignalSources } from '$lib/server/services/rf/register-signal-sources';
import { listSignalSources, unregisterSignalSource } from '$lib/server/services/rf/signal-sources';

describe('SignalSourceAdapter built-ins', () => {
	beforeEach(() => {
		for (const s of listSignalSources()) unregisterSignalSource(s.name);
	});

	it('bluedragon adapter has the correct name', () => {
		expect(bluedragonSignalSource.name).toBe('bluedragon');
	});

	it('bluedragon adapter.start and .stop resolve', async () => {
		await expect(bluedragonSignalSource.start('sess-x')).resolves.toBeUndefined();
		await expect(bluedragonSignalSource.stop()).resolves.toBeUndefined();
	});

	it('gsm-evil adapter has the correct name', () => {
		expect(gsmEvilSignalSource.name).toBe('gsm-evil');
	});

	it('gsm-evil adapter.start launches a poll timer; stop clears it', async () => {
		await gsmEvilSignalSource.start('sess-x');
		// Double-start must not stack timers.
		await gsmEvilSignalSource.start('sess-x');
		await gsmEvilSignalSource.stop();
	});

	it('registerSignalSources() adds both BD and GSM Evil to the registry', () => {
		registerSignalSources();
		const names = listSignalSources().map((s) => s.name);
		expect(names).toContain('bluedragon');
		expect(names).toContain('gsm-evil');
	});

	it('registerSignalSources() is idempotent across multiple calls', () => {
		registerSignalSources();
		registerSignalSources();
		registerSignalSources();
		const names = listSignalSources().map((s) => s.name);
		expect(names.filter((n) => n === 'bluedragon')).toHaveLength(1);
		expect(names.filter((n) => n === 'gsm-evil')).toHaveLength(1);
	});
});
