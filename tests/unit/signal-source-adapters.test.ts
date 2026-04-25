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
		// Spy on the timer primitives the adapter uses (module-level
		// `setInterval` / `clearInterval`) so we can assert the lifecycle
		// without relying on private fields.
		const setSpy = vi.spyOn(global, 'setInterval');
		const clearSpy = vi.spyOn(global, 'clearInterval');

		try {
			await gsmEvilSignalSource.start('sess-x');
			expect(setSpy).toHaveBeenCalledTimes(1);
			const firstHandle = setSpy.mock.results[0]?.value;
			expect(firstHandle).toBeTruthy();

			// Double-start must not stack timers — no additional setInterval
			// call, and the existing handle must remain.
			await gsmEvilSignalSource.start('sess-x');
			expect(setSpy).toHaveBeenCalledTimes(1);

			// Stop must clear the same handle that start produced.
			await gsmEvilSignalSource.stop();
			expect(clearSpy).toHaveBeenCalledTimes(1);
			expect(clearSpy.mock.calls[0]?.[0]).toBe(firstHandle);

			// After stop, restart should produce a fresh handle (not reuse the cleared one).
			await gsmEvilSignalSource.start('sess-x');
			expect(setSpy).toHaveBeenCalledTimes(2);
			await gsmEvilSignalSource.stop();
		} finally {
			setSpy.mockRestore();
			clearSpy.mockRestore();
		}
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
