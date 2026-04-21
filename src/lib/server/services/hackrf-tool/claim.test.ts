/**
 * Unit tests for the claim facade — verify each RecoveryPolicy routes to
 * the correct underlying claim function and the release path is symmetric.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/api/webrx-hackrf-claim', () => ({
	acquireHackRfForWebRx: vi.fn(),
	releaseHackRfForWebRx: vi.fn()
}));
vi.mock('$lib/server/services/gsm-evil/gsm-evil-control-helpers', () => ({
	acquireHackRfResource: vi.fn()
}));
vi.mock('$lib/server/hardware/resource-manager', () => ({
	resourceManager: { acquire: vi.fn(), release: vi.fn() }
}));

import { acquireHackRfForWebRx, releaseHackRfForWebRx } from '$lib/server/api/webrx-hackrf-claim';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { acquireHackRfResource } from '$lib/server/services/gsm-evil/gsm-evil-control-helpers';

import { acquireHackRf, releaseHackRf } from './claim';

describe('acquireHackRf', () => {
	beforeEach(() => vi.clearAllMocks());

	it("policy 'peer-webrx' routes to acquireHackRfForWebRx", async () => {
		vi.mocked(acquireHackRfForWebRx).mockResolvedValue({ success: true });
		await acquireHackRf('openwebrx', 'peer-webrx');
		expect(acquireHackRfForWebRx).toHaveBeenCalledWith('openwebrx');
		expect(acquireHackRfResource).not.toHaveBeenCalled();
	});

	it("policy 'stale-only' routes to acquireHackRfResource (success)", async () => {
		vi.mocked(acquireHackRfResource).mockResolvedValue(null);
		const res = await acquireHackRf('gsm-evil', 'stale-only');
		expect(res.success).toBe(true);
	});

	it("policy 'stale-only' returns mapped error on failure", async () => {
		vi.mocked(acquireHackRfResource).mockResolvedValue({
			success: false,
			message: 'busy by novasdr',
			conflictingService: 'novasdr'
		});
		const res = await acquireHackRf('gsm-evil', 'stale-only');
		expect(res).toEqual({ success: false, owner: 'novasdr', message: 'busy by novasdr' });
	});

	it("policy 'direct' routes to resourceManager.acquire (success)", async () => {
		vi.mocked(resourceManager.acquire).mockResolvedValue({ success: true });
		const res = await acquireHackRf('trunk-recorder', 'direct');
		expect(res.success).toBe(true);
	});

	it("policy 'direct' produces mapped error on failure", async () => {
		vi.mocked(resourceManager.acquire).mockResolvedValue({ success: false, owner: 'gsm-evil' });
		const res = await acquireHackRf('trunk-recorder', 'direct');
		expect(res.success).toBe(false);
		expect(res.owner).toBe('gsm-evil');
		expect(res.message).toContain('gsm-evil');
	});
});

describe('releaseHackRf', () => {
	beforeEach(() => vi.clearAllMocks());

	it("policy 'peer-webrx' routes to releaseHackRfForWebRx", async () => {
		await releaseHackRf('sdrpp', 'peer-webrx');
		expect(releaseHackRfForWebRx).toHaveBeenCalledWith('sdrpp');
		expect(resourceManager.release).not.toHaveBeenCalled();
	});

	it("policy 'stale-only' uses resourceManager.release", async () => {
		vi.mocked(resourceManager.release).mockResolvedValue({ success: true });
		await releaseHackRf('gsm-evil', 'stale-only');
		expect(resourceManager.release).toHaveBeenCalled();
	});

	it("policy 'direct' uses resourceManager.release", async () => {
		vi.mocked(resourceManager.release).mockResolvedValue({ success: true });
		await releaseHackRf('trunk-recorder', 'direct');
		expect(resourceManager.release).toHaveBeenCalled();
	});
});
