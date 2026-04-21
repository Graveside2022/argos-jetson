/**
 * Unit tests for the lifecycle orchestration layer.
 *
 * Mocks the HackRF tool framework's claim/release functions and the
 * ResourceManager singleton so tests verify the orchestration contract
 * without touching real hardware.
 */

import { json } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runLifecycleAction } from './lifecycle';
import type { ControlAction, ToolDriver } from './types';

vi.mock('./claim', () => ({
	acquireHackRf: vi.fn(),
	releaseHackRf: vi.fn()
}));

vi.mock('$lib/server/hardware/resource-manager', () => ({
	resourceManager: { refreshNow: vi.fn() }
}));

vi.mock('$lib/server/api/webrx-control-lock', () => ({
	withWebRxLock: <T>(fn: () => Promise<T>) => fn()
}));

import { resourceManager } from '$lib/server/hardware/resource-manager';

import { acquireHackRf, releaseHackRf } from './claim';

function makeDriver(overrides: Partial<ToolDriver> = {}): ToolDriver {
	return {
		toolName: 'fake',
		recoveryPolicy: 'direct',
		supportedActions: ['start', 'stop', 'restart', 'status'],
		serializeInLock: false,
		acquireOnStart: true,
		start: vi.fn(async () => json({ ok: 'start' })),
		stop: vi.fn(async () => json({ ok: 'stop' })),
		restart: vi.fn(async () => json({ ok: 'restart' })),
		status: vi.fn(() => json({ ok: 'status' })),
		buildConflictResponse: vi.fn(() => json({ err: 'conflict' }, { status: 409 })),
		...overrides
	};
}

describe('runLifecycleAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(acquireHackRf).mockResolvedValue({ success: true });
		vi.mocked(resourceManager.refreshNow).mockResolvedValue();
	});

	it('status action skips claim acquisition entirely', async () => {
		const driver = makeDriver();
		const res = await runLifecycleAction(driver, 'status', {});
		expect(res.status).toBe(200);
		expect(acquireHackRf).not.toHaveBeenCalled();
		expect(resourceManager.refreshNow).not.toHaveBeenCalled();
		expect(driver.status).toHaveBeenCalledOnce();
	});

	it('start acquires claim, runs driver, calls refreshNow', async () => {
		const driver = makeDriver();
		const res = await runLifecycleAction(driver, 'start', {});
		expect(res.status).toBe(200);
		expect(acquireHackRf).toHaveBeenCalledWith('fake', 'direct');
		expect(driver.start).toHaveBeenCalledOnce();
		expect(resourceManager.refreshNow).toHaveBeenCalledOnce();
	});

	it('acquire failure short-circuits to conflict — driver.start never called', async () => {
		vi.mocked(acquireHackRf).mockResolvedValueOnce({
			success: false,
			owner: 'other',
			message: 'busy'
		});
		const driver = makeDriver();
		const res = await runLifecycleAction(driver, 'start', {});
		expect(res.status).toBe(409);
		expect(driver.start).not.toHaveBeenCalled();
		expect(resourceManager.refreshNow).not.toHaveBeenCalled();
	});

	it('driver.start throw releases the claim (no orphan)', async () => {
		const driver = makeDriver({
			start: vi.fn(async () => {
				throw new Error('boom');
			})
		});
		await expect(runLifecycleAction(driver, 'start', {})).rejects.toThrow('boom');
		expect(releaseHackRf).toHaveBeenCalledWith('fake', 'direct');
	});

	it('stop does NOT acquire a new claim (driver owns release)', async () => {
		const driver = makeDriver();
		await runLifecycleAction(driver, 'stop', {});
		expect(acquireHackRf).not.toHaveBeenCalled();
		expect(driver.stop).toHaveBeenCalledOnce();
	});

	it('restart calls driver.restart exactly once (not stop+start)', async () => {
		const driver = makeDriver();
		await runLifecycleAction(driver, 'restart', {});
		expect(driver.restart).toHaveBeenCalledOnce();
		expect(driver.stop).not.toHaveBeenCalled();
		expect(driver.start).not.toHaveBeenCalled();
	});

	it('acquireOnStart=false skips lifecycle-layer claim', async () => {
		const driver = makeDriver({ acquireOnStart: false });
		await runLifecycleAction(driver, 'start', {});
		expect(acquireHackRf).not.toHaveBeenCalled();
		expect(driver.start).toHaveBeenCalledOnce();
	});

	it('passes body through to driver methods', async () => {
		const driver = makeDriver();
		const body = { action: 'start' as ControlAction, frequency: '950' };
		await runLifecycleAction(driver, 'start', body);
		expect(driver.start).toHaveBeenCalledWith(body);
	});
});
