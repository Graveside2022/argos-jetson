/**
 * Unit tests for the one-shot `withHackRf` helper used by scan endpoints.
 *
 * Core guarantee: release runs even when `fn` throws. A leaked claim in a
 * scan endpoint would block every other HackRF tool until operator restart.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./claim', () => ({
	acquireHackRf: vi.fn(),
	releaseHackRf: vi.fn()
}));

import { acquireHackRf, releaseHackRf } from './claim';
import { withHackRf } from './with-hackrf';

describe('withHackRf', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(releaseHackRf).mockResolvedValue();
	});

	it('success path: acquire → fn → release', async () => {
		vi.mocked(acquireHackRf).mockResolvedValue({ success: true });
		const fn = vi.fn(async () => 42);

		const result = await withHackRf({ tool: 'gsm-scan', recoveryPolicy: 'direct', fn });

		expect(result).toEqual({ success: true, value: 42 });
		expect(acquireHackRf).toHaveBeenCalledWith('gsm-scan', 'direct');
		expect(fn).toHaveBeenCalledOnce();
		expect(releaseHackRf).toHaveBeenCalledWith('gsm-scan', 'direct');
	});

	it('acquire-fail: fn never called, release not called (nothing acquired)', async () => {
		vi.mocked(acquireHackRf).mockResolvedValue({ success: false, owner: 'kismet' });
		const fn = vi.fn();

		const result = await withHackRf({ tool: 'gsm-scan', recoveryPolicy: 'direct', fn });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.claim.owner).toBe('kismet');
		expect(fn).not.toHaveBeenCalled();
		expect(releaseHackRf).not.toHaveBeenCalled();
	});

	it('fn throw: release still runs (no orphaned claim)', async () => {
		vi.mocked(acquireHackRf).mockResolvedValue({ success: true });
		const fn = vi.fn(async () => {
			throw new Error('scan crashed');
		});

		await expect(
			withHackRf({ tool: 'gsm-scan', recoveryPolicy: 'direct', fn })
		).rejects.toThrow('scan crashed');

		expect(releaseHackRf).toHaveBeenCalledWith('gsm-scan', 'direct');
	});
});
