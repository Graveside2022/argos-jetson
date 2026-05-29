import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAcquire = vi.fn();
const mockRelease = vi.fn();
const mockForceRelease = vi.fn();
const mockWarn = vi.fn();
const mockCanonicalize = vi.fn((owner: string) => owner);

vi.mock('$lib/server/hardware/resource-manager', () => ({
	resourceManager: {
		acquireWithPreempt: mockAcquire,
		release: mockRelease,
		forceRelease: mockForceRelease,
		registerPreemptHandler: vi.fn(),
		unregisterPreemptHandler: vi.fn()
	}
}));

vi.mock('$lib/server/hardware/hackrf-owner-aliases', () => ({
	canonicalizeWebRxOwner: mockCanonicalize
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const { acquireHackRfForWebRx, releaseHackRfForWebRx } = await import('./webrx-hackrf-claim');

beforeEach(() => {
	mockAcquire.mockReset();
	mockRelease.mockReset();
	mockForceRelease.mockReset();
	mockWarn.mockReset();
	mockCanonicalize.mockImplementation((owner: string) => owner);
});

describe('acquireHackRfForWebRx — success path', () => {
	it('returns { success: true } when acquire succeeds first try', async () => {
		mockAcquire.mockResolvedValueOnce({ success: true });
		const result = await acquireHackRfForWebRx('novasdr');
		expect(result).toEqual({ success: true });
		expect(result.owner).toBeUndefined();
		expect(result.message).toBeUndefined();
	});

	it('calls resourceManager.acquireWithPreempt with toolName, HACKRF device, forceOnOrphan', async () => {
		mockAcquire.mockResolvedValueOnce({ success: true });
		await acquireHackRfForWebRx('openwebrx');
		expect(mockAcquire).toHaveBeenCalledWith('openwebrx', 'hackrf', { forceOnOrphan: true });
	});

	it('does NOT call forceRelease on first-try success', async () => {
		mockAcquire.mockResolvedValueOnce({ success: true });
		await acquireHackRfForWebRx('novasdr');
		expect(mockForceRelease).not.toHaveBeenCalled();
	});
});

describe('acquireHackRfForWebRx — peer conflict recovery (openwebrx ⇄ novasdr)', () => {
	it('recovers when peer openwebrx holds HackRF (novasdr trying to start)', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'openwebrx' })
			.mockResolvedValueOnce({ success: true });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('novasdr');

		expect(result).toEqual({ success: true });
		expect(mockForceRelease).toHaveBeenCalledWith('hackrf');
		expect(mockForceRelease).toHaveBeenCalledTimes(1);
		expect(mockAcquire).toHaveBeenCalledTimes(2);
	});

	it('recovers when peer novasdr holds HackRF (openwebrx trying to start)', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'novasdr' })
			.mockResolvedValueOnce({ success: true });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('openwebrx');
		expect(result).toEqual({ success: true });
	});

	it('logs warn when peer recovery is triggered', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'openwebrx' })
			.mockResolvedValueOnce({ success: true });
		mockForceRelease.mockResolvedValueOnce(undefined);

		await acquireHackRfForWebRx('novasdr');

		expect(mockWarn).toHaveBeenCalledWith(
			'[webrx-claim] HackRF held by peer — force-releasing and retrying',
			{ toolName: 'novasdr', peer: 'openwebrx' }
		);
	});

	it('returns conflict when peer recovery acquire still fails', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'openwebrx' })
			.mockResolvedValueOnce({ success: false, owner: 'gsm-evil' });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('novasdr');

		expect(result.success).toBe(false);
		expect(result.owner).toBe('gsm-evil');
		expect(result.message).toBe('Failed to reclaim HackRF from openwebrx after force-release.');
	});

	it('uses "unknown" as owner when retry returns no owner', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'openwebrx' })
			.mockResolvedValueOnce({ success: false, owner: undefined });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('novasdr');
		expect(result.owner).toBe('unknown');
	});

	it('treats sdrpp as a WebRX peer (third member of peer set)', async () => {
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'sdrpp' })
			.mockResolvedValueOnce({ success: true });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('novasdr');
		expect(result).toEqual({ success: true });
		expect(mockForceRelease).toHaveBeenCalledTimes(1);
	});

	it('recognizes container-name owner via canonicalize alias', async () => {
		mockCanonicalize.mockImplementation((owner: string) =>
			owner === 'argos-novasdr-1' ? 'novasdr' : owner
		);
		mockAcquire
			.mockResolvedValueOnce({ success: false, owner: 'argos-novasdr-1' })
			.mockResolvedValueOnce({ success: true });
		mockForceRelease.mockResolvedValueOnce(undefined);

		const result = await acquireHackRfForWebRx('openwebrx');
		expect(result.success).toBe(true);
		expect(mockForceRelease).toHaveBeenCalled();
	});
});

describe('acquireHackRfForWebRx — non-peer conflict (refuses)', () => {
	it('returns conflict error when gsm-evil owns HackRF', async () => {
		mockAcquire.mockResolvedValueOnce({ success: false, owner: 'gsm-evil' });

		const result = await acquireHackRfForWebRx('novasdr');

		expect(result.success).toBe(false);
		expect(result.owner).toBe('gsm-evil');
		expect(result.message).toBe(
			'HackRF is currently in use by gsm-evil. Stop it first before starting novasdr.'
		);
	});

	it('returns conflict when kismet owns HackRF', async () => {
		mockAcquire.mockResolvedValueOnce({ success: false, owner: 'kismet' });

		const result = await acquireHackRfForWebRx('openwebrx');

		expect(result.success).toBe(false);
		expect(result.owner).toBe('kismet');
		expect(result.message).toContain('kismet');
		expect(result.message).toContain('openwebrx');
	});

	it('does NOT call forceRelease on non-peer conflict', async () => {
		mockAcquire.mockResolvedValueOnce({ success: false, owner: 'kismet' });

		await acquireHackRfForWebRx('openwebrx');

		expect(mockForceRelease).not.toHaveBeenCalled();
	});

	it('treats null owner as "unknown" and refuses (not a peer)', async () => {
		mockAcquire.mockResolvedValueOnce({ success: false, owner: undefined });

		const result = await acquireHackRfForWebRx('openwebrx');

		expect(result.success).toBe(false);
		expect(result.owner).toBe('unknown');
		expect(result.message).toContain('unknown');
	});

	it('treats same-name owner as non-peer conflict (would be self-conflict)', async () => {
		// canonicalize returns same name; if owner == toolName, it's NOT a peer
		// (peer means *different* WebRX-family tool). Should refuse.
		mockAcquire.mockResolvedValueOnce({ success: false, owner: 'novasdr' });

		const result = await acquireHackRfForWebRx('novasdr');

		expect(result.success).toBe(false);
		expect(mockForceRelease).not.toHaveBeenCalled();
	});
});

describe('releaseHackRfForWebRx', () => {
	it('completes silently on successful release', async () => {
		mockRelease.mockResolvedValueOnce({ success: true });

		await releaseHackRfForWebRx('novasdr');

		expect(mockRelease).toHaveBeenCalledWith('novasdr', 'hackrf');
		expect(mockWarn).not.toHaveBeenCalled();
	});

	it('logs warn (not throws) when release reports failure', async () => {
		mockRelease.mockResolvedValueOnce({
			success: false,
			error: 'not the owner'
		});

		await expect(releaseHackRfForWebRx('novasdr')).resolves.toBeUndefined();

		expect(mockWarn).toHaveBeenCalledWith('[webrx-claim] Release reported non-success', {
			toolName: 'novasdr',
			error: 'not the owner'
		});
	});

	it('does not throw even when release succeeds (returns void)', async () => {
		mockRelease.mockResolvedValueOnce({ success: true });
		const result = await releaseHackRfForWebRx('openwebrx');
		expect(result).toBeUndefined();
	});

	it('uses passed toolName in release call', async () => {
		mockRelease.mockResolvedValueOnce({ success: true });
		await releaseHackRfForWebRx('openwebrx');
		expect(mockRelease).toHaveBeenCalledWith('openwebrx', 'hackrf');
	});

	it('includes error field in warn payload when release failed', async () => {
		mockRelease.mockResolvedValueOnce({ success: false, error: 'specific error msg' });
		await releaseHackRfForWebRx('novasdr');
		expect(mockWarn.mock.calls[0][1].error).toBe('specific error msg');
	});
});
