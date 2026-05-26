import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('./resource-mutex', () => ({
	acquireMutex: vi.fn(async () => true),
	releaseMutex: vi.fn()
}));

vi.mock('./resource-refresh', () => ({
	dispatchRefresh: vi.fn(async () => undefined),
	killDeviceHolders: vi.fn(async () => undefined),
	refreshDetection: vi.fn(async () => undefined)
}));

vi.mock('./resource-scan', () => ({
	scanForOrphans: vi.fn(async () => undefined)
}));

import { resourceManager } from './resource-manager';
import { acquireMutex } from './resource-mutex';
import { dispatchRefresh, killDeviceHolders } from './resource-refresh';
import { HardwareDevice } from './types';

async function resetAllDevices(): Promise<void> {
	// Force-release everything in case prior tests left state held
	for (const d of [
		HardwareDevice.HACKRF,
		HardwareDevice.ALFA,
		HardwareDevice.B205,
		HardwareDevice.BLUETOOTH
	]) {
		await resourceManager.forceRelease(d);
	}
}

beforeEach(async () => {
	vi.clearAllMocks();
	(acquireMutex as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	await resetAllDevices();
});

afterEach(() => {
	resourceManager.removeAllListeners();
});

describe('resourceManager — acquire', () => {
	test('returns success when device available + no current owner', async () => {
		const result = await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(true);
	});

	test('emits "acquired" event on successful claim', async () => {
		const handler = vi.fn();
		resourceManager.on('acquired', handler);
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ device: HardwareDevice.HACKRF, toolName: 'mytool' })
		);
	});

	test('second acquire by SAME tool returns success (re-acquire idempotent)', async () => {
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		const second = await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(second.success).toBe(true);
		expect(second.owner).toBe('mytool');
	});

	test('acquire by DIFFERENT tool while held returns failure + current owner', async () => {
		await resourceManager.acquire('alice', HardwareDevice.HACKRF);
		const result = await resourceManager.acquire('bob', HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
		expect(result.owner).toBe('alice');
	});

	test('returns mutex-timeout error when acquireMutex returns false', async () => {
		(acquireMutex as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
		const result = await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
		expect(result.owner).toBe('mutex-timeout');
	});

	test('dispatchRefresh runs before tryClaim (re-scan OS state)', async () => {
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(dispatchRefresh).toHaveBeenCalled();
	});

	test('dispatchRefresh failure does not block acquire (swallowed via .catch)', async () => {
		(dispatchRefresh as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error('flaky pgrep')
		);
		const result = await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(true);
	});
});

describe('resourceManager — release', () => {
	test('returns success when releasing own claim', async () => {
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		const result = await resourceManager.release('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(true);
	});

	test('emits "released" event on success', async () => {
		const handler = vi.fn();
		resourceManager.on('released', handler);
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		await resourceManager.release('mytool', HardwareDevice.HACKRF);
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ device: HardwareDevice.HACKRF, toolName: 'mytool' })
		);
	});

	test('release by wrong owner returns failure with descriptive error', async () => {
		await resourceManager.acquire('alice', HardwareDevice.HACKRF);
		const result = await resourceManager.release('bob', HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
		expect(result.error).toContain('alice');
	});

	test('mutex-timeout returns failure', async () => {
		(acquireMutex as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
		const result = await resourceManager.release('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
		expect(result.error).toBe('mutex-timeout');
	});

	test('release on unowned device returns failure (owner mismatch)', async () => {
		const result = await resourceManager.release('mytool', HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
	});

	test('release sets device back to available + clears owner', async () => {
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		await resourceManager.release('mytool', HardwareDevice.HACKRF);
		expect(resourceManager.isAvailable(HardwareDevice.HACKRF)).toBe(true);
		expect(resourceManager.getOwner(HardwareDevice.HACKRF)).toBeNull();
	});
});

describe('resourceManager — forceRelease', () => {
	test('clears any owner + calls killDeviceHolders', async () => {
		await resourceManager.acquire('alice', HardwareDevice.HACKRF);
		const result = await resourceManager.forceRelease(HardwareDevice.HACKRF);
		expect(result.success).toBe(true);
		expect(killDeviceHolders).toHaveBeenCalledWith(HardwareDevice.HACKRF);
		expect(resourceManager.isAvailable(HardwareDevice.HACKRF)).toBe(true);
		expect(resourceManager.getOwner(HardwareDevice.HACKRF)).toBeNull();
	});

	test('emits "force-released" with previousOwner', async () => {
		const handler = vi.fn();
		resourceManager.on('force-released', handler);
		await resourceManager.acquire('alice', HardwareDevice.HACKRF);
		await resourceManager.forceRelease(HardwareDevice.HACKRF);
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({ device: HardwareDevice.HACKRF, previousOwner: 'alice' })
		);
	});

	test('forceRelease on unowned device still succeeds (no-op)', async () => {
		const result = await resourceManager.forceRelease(HardwareDevice.B205);
		expect(result.success).toBe(true);
	});

	test('mutex-timeout returns failure', async () => {
		(acquireMutex as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
		const result = await resourceManager.forceRelease(HardwareDevice.HACKRF);
		expect(result.success).toBe(false);
	});
});

describe('resourceManager — getStatus / isAvailable / getOwner', () => {
	test('getStatus returns frozen copies of all 4 device states', async () => {
		const status = resourceManager.getStatus();
		expect(status.hackrf.device).toBe(HardwareDevice.HACKRF);
		expect(status.alfa.device).toBe(HardwareDevice.ALFA);
		expect(status.bluetooth.device).toBe(HardwareDevice.BLUETOOTH);
		expect(status.b205.device).toBe(HardwareDevice.B205);
	});

	test('getStatus returns COPIES (mutating doesnt affect internal state)', async () => {
		const status = resourceManager.getStatus();
		status.hackrf.owner = 'mutated';
		expect(resourceManager.getOwner(HardwareDevice.HACKRF)).not.toBe('mutated');
	});

	test('isAvailable true after fresh state, false after acquire', async () => {
		expect(resourceManager.isAvailable(HardwareDevice.HACKRF)).toBe(true);
		await resourceManager.acquire('mytool', HardwareDevice.HACKRF);
		expect(resourceManager.isAvailable(HardwareDevice.HACKRF)).toBe(false);
	});

	test('getOwner returns null when no owner, tool name when claimed', async () => {
		expect(resourceManager.getOwner(HardwareDevice.HACKRF)).toBeNull();
		await resourceManager.acquire('alice', HardwareDevice.HACKRF);
		expect(resourceManager.getOwner(HardwareDevice.HACKRF)).toBe('alice');
	});
});

describe('resourceManager — refreshNow', () => {
	test('calls dispatchRefresh with the device', async () => {
		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		expect(dispatchRefresh).toHaveBeenCalledWith(expect.any(Map), HardwareDevice.HACKRF);
	});

	test('swallows dispatch errors and logs warn', async () => {
		(dispatchRefresh as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
		const { logger } = await import('$lib/utils/logger');
		await expect(resourceManager.refreshNow(HardwareDevice.HACKRF)).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalled();
	});
});

describe('resourceManager — dispose', () => {
	test('dispose can be called more than once safely', () => {
		// Singleton may have been disposed by another test; calling again is safe
		expect(() => {
			resourceManager.dispose();
			resourceManager.dispose();
		}).not.toThrow();
	});
});
