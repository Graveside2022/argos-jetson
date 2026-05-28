/**
 * Unit tests for the `acquireWithPreempt` mechanism added 2026-05-27.
 *
 * We instantiate the `ResourceManager` class directly (not the singleton) so
 * each test runs against fresh state. `startRefreshLoop: false` keeps the
 * 30 s setInterval out of the test process. The OS-side `dispatchRefresh`
 * called inside `acquire` is best-effort and swallows errors, so a fake
 * `HardwareDevice.B205` claim flows through cleanly in this hermetic test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResourceManager } from './resource-manager';
import { HardwareDevice } from './types';

let rm: ResourceManager;

beforeEach(() => {
	rm = new ResourceManager({ startRefreshLoop: false, skipOsRefresh: true });
});

afterEach(() => {
	rm.dispose();
});

describe('acquireWithPreempt', () => {
	it('returns the same result as acquire when the device is free', async () => {
		const result = await rm.acquireWithPreempt('test-tool', HardwareDevice.B205);
		expect(result.success).toBe(true);
		expect(result.preempted).toBeUndefined();
	});

	it('returns success without invoking handler when the same tool re-acquires', async () => {
		await rm.acquire('test-tool', HardwareDevice.B205);
		const handler = vi.fn(async () => {});
		rm.registerPreemptHandler('test-tool', HardwareDevice.B205, handler);
		const result = await rm.acquireWithPreempt('test-tool', HardwareDevice.B205);
		expect(result.success).toBe(true);
		expect(handler).not.toHaveBeenCalled();
	});

	it('returns conflict unchanged when no preempt handler is registered for the current owner', async () => {
		await rm.acquire('owner-a', HardwareDevice.B205);
		const result = await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(result.success).toBe(false);
		expect(result.owner).toBe('owner-a');
		expect(result.preempted).toBeUndefined();
	});

	it('invokes the registered handler then re-acquires successfully on the happy path', async () => {
		await rm.acquire('owner-a', HardwareDevice.B205);
		const handler = vi.fn(async () => {
			await rm.release('owner-a', HardwareDevice.B205);
		});
		rm.registerPreemptHandler('owner-a', HardwareDevice.B205, handler);
		const result = await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(handler).toHaveBeenCalledOnce();
		expect(result.success).toBe(true);
		expect(result.preempted).toBe('owner-a');
		expect(rm.getOwner(HardwareDevice.B205)).toBe('owner-b');
	});

	it('returns conflict when the handler succeeds but the device is still held (handler did not release)', async () => {
		await rm.acquire('owner-a', HardwareDevice.B205);
		const handler = vi.fn(async () => {
			// intentionally NOT calling release — simulates buggy owner
		});
		rm.registerPreemptHandler('owner-a', HardwareDevice.B205, handler);
		const result = await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(handler).toHaveBeenCalledOnce();
		expect(result.success).toBe(false);
		expect(result.owner).toBe('owner-a');
	});

	it('returns the original conflict if the handler throws', async () => {
		await rm.acquire('owner-a', HardwareDevice.B205);
		const handler = vi.fn(async () => {
			throw new Error('handler boom');
		});
		rm.registerPreemptHandler('owner-a', HardwareDevice.B205, handler);
		const result = await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(handler).toHaveBeenCalledOnce();
		expect(result.success).toBe(false);
		expect(result.owner).toBe('owner-a');
	});

	it('respects unregisterPreemptHandler — once removed, conflict is returned without invoking the (removed) handler', async () => {
		await rm.acquire('owner-a', HardwareDevice.B205);
		const handler = vi.fn(async () => {
			await rm.release('owner-a', HardwareDevice.B205);
		});
		rm.registerPreemptHandler('owner-a', HardwareDevice.B205, handler);
		rm.unregisterPreemptHandler('owner-a', HardwareDevice.B205);
		const result = await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(handler).not.toHaveBeenCalled();
		expect(result.success).toBe(false);
	});

	it('keys handlers by `(toolName, device)` so the same tool can register handlers on multiple devices', async () => {
		const hB205 = vi.fn(async () =>
			rm.release('owner-a', HardwareDevice.B205).then(() => undefined)
		);
		const hHack = vi.fn(async () =>
			rm.release('owner-a', HardwareDevice.HACKRF).then(() => undefined)
		);
		rm.registerPreemptHandler('owner-a', HardwareDevice.B205, hB205);
		rm.registerPreemptHandler('owner-a', HardwareDevice.HACKRF, hHack);

		await rm.acquire('owner-a', HardwareDevice.B205);
		await rm.acquireWithPreempt('owner-b', HardwareDevice.B205);
		expect(hB205).toHaveBeenCalledOnce();
		expect(hHack).not.toHaveBeenCalled();
	});
});
