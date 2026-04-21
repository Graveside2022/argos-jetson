/**
 * OpenWebRX driver — verify exact systemctl argument arrays + success JSON.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({ execFileAsync: vi.fn() }));
vi.mock('$lib/server/env', () => ({ env: { OPENWEBRX_URL: 'http://host:8073' } }));
vi.mock('$lib/utils/delay', () => ({ delay: vi.fn() }));
vi.mock('$lib/server/hardware/resource-manager', () => ({
	resourceManager: { getOwner: vi.fn(() => null) }
}));
vi.mock('../claim', () => ({ releaseHackRf: vi.fn() }));

import { execFileAsync } from '$lib/server/exec';

import { releaseHackRf } from '../claim';
import { openwebrxDriver } from './openwebrx';

describe('openwebrxDriver', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(execFileAsync).mockResolvedValue({ stdout: '', stderr: '' });
	});

	it('start: sudo systemctl start openwebrx + URL extras', async () => {
		const res = await openwebrxDriver.start({});
		expect(execFileAsync).toHaveBeenCalledWith('/usr/bin/sudo', [
			'/usr/bin/systemctl',
			'start',
			'openwebrx'
		]);
		const body = (await res.json()) as { message: string; url: string; action: string };
		expect(body.action).toBe('start');
		expect(body.url).toBe('http://host:8073');
		expect(body.message).toContain('OpenWebRX started successfully');
	});

	it('stop: sudo systemctl stop + release claim', async () => {
		await openwebrxDriver.stop({});
		expect(execFileAsync).toHaveBeenCalledWith('/usr/bin/sudo', [
			'/usr/bin/systemctl',
			'stop',
			'openwebrx'
		]);
		expect(releaseHackRf).toHaveBeenCalledWith('openwebrx', 'peer-webrx');
	});

	it('restart: sudo systemctl restart', async () => {
		await openwebrxDriver.restart({});
		expect(execFileAsync).toHaveBeenCalledWith('/usr/bin/sudo', [
			'/usr/bin/systemctl',
			'restart',
			'openwebrx'
		]);
	});

	it('status: is-active returns running when stdout is "active"', async () => {
		vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: 'active\n', stderr: '' });
		const res = await openwebrxDriver.status({});
		const body = (await (res as Response).json()) as { running: boolean; status: string };
		expect(body.running).toBe(true);
		expect(body.status).toBe('running');
	});

	it('status: is-active throw is treated as stopped (not an error)', async () => {
		vi.mocked(execFileAsync).mockRejectedValueOnce(new Error('exit 3'));
		const res = await openwebrxDriver.status({});
		const body = (await (res as Response).json()) as { running: boolean; status: string };
		expect(body.running).toBe(false);
		expect(body.status).toBe('stopped');
	});
});
