/**
 * ResourceManager self-reacquire regression tests.
 *
 * Covers the fix for the 409 conflict that used to fire when the same tool
 * tried to re-acquire a device it already owned (e.g. double POST to
 * /api/novasdr/control {action: 'start'}).
 *
 * Isolation note: resourceManager.acquire() internally calls
 * dispatchRefresh() which invokes hackrfMgr.getBlockingProcesses()
 * (live `pgrep`/`ps`) + hackrfMgr.getContainerStatus() (live
 * `docker ps`). Those pull host state into the test and make the
 * assertions flaky when a real container or process happens to be
 * running (e.g. an unrelated `rdio-scanner` container, a previous
 * novasdr scan still winding down). The mocks below report "nothing
 * detected" so dispatchRefresh's applyOwnership() is called with
 * ownerName=null, exercising only the owner-preservation grace
 * window — the exact code path these tests intend to cover.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/hardware/hackrf-manager', () => ({
	detectHackRF: vi.fn().mockResolvedValue(false),
	getBlockingProcesses: vi.fn().mockResolvedValue([]),
	getContainerStatus: vi.fn().mockResolvedValue([]),
	killBlockingProcesses: vi.fn().mockResolvedValue(undefined),
	stopContainers: vi.fn().mockResolvedValue(undefined)
}));

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

const HACKRF = HardwareDevice.HACKRF;

describe('ResourceManager self-reacquire', () => {
	beforeEach(async () => {
		// Best-effort cleanup in case prior test left state.
		await resourceManager.release('novasdr', HACKRF).catch(() => undefined);
		await resourceManager.release('openwebrx', HACKRF).catch(() => undefined);
	});

	afterEach(async () => {
		await resourceManager.release('novasdr', HACKRF).catch(() => undefined);
		await resourceManager.release('openwebrx', HACKRF).catch(() => undefined);
	});

	it('second acquire by same tool returns success', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const second = await resourceManager.acquire('novasdr', HACKRF);
		expect(second.success).toBe(true);
		expect(second.owner).toBe('novasdr');
	});

	it('different tool still gets conflict when resource is held', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const second = await resourceManager.acquire('openwebrx', HACKRF);
		expect(second.success).toBe(false);
		expect(second.owner).toBe('novasdr');
	});

	it('release then reacquire works normally', async () => {
		const first = await resourceManager.acquire('novasdr', HACKRF);
		expect(first.success).toBe(true);

		const released = await resourceManager.release('novasdr', HACKRF);
		expect(released.success).toBe(true);

		const third = await resourceManager.acquire('novasdr', HACKRF);
		expect(third.success).toBe(true);
	});

	it('three consecutive self-reacquires all succeed', async () => {
		const r1 = await resourceManager.acquire('novasdr', HACKRF);
		const r2 = await resourceManager.acquire('novasdr', HACKRF);
		const r3 = await resourceManager.acquire('novasdr', HACKRF);
		expect(r1.success).toBe(true);
		expect(r2.success).toBe(true);
		expect(r3.success).toBe(true);
	});
});
