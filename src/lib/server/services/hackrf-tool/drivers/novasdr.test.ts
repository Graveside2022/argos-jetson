/**
 * NovaSDR driver — verify docker compose arguments, absolute compose-file
 * path, and the `start -> up -d` mapping that enables the network-ID
 * self-heal behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({ execFileAsync: vi.fn() }));
vi.mock('$lib/server/env', () => ({ env: { NOVASDR_URL: 'http://host:8074' } }));
vi.mock('$lib/utils/delay', () => ({ delay: vi.fn() }));
vi.mock('$lib/server/hardware/resource-manager', () => ({
	resourceManager: { getOwner: vi.fn(() => null) }
}));
vi.mock('../claim', () => ({ releaseHackRf: vi.fn() }));

import { execFileAsync } from '$lib/server/exec';

import { novasdrDriver } from './novasdr';

describe('novasdrDriver', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(execFileAsync).mockResolvedValue({ stdout: '', stderr: '' });
	});

	it('start: `docker compose -f <abs> up -d novasdr`', async () => {
		await novasdrDriver.start({});
		const [cmd, args] = vi.mocked(execFileAsync).mock.calls[0];
		expect(cmd).toBe('docker');
		expect(args[0]).toBe('compose');
		expect(args[1]).toBe('-f');
		expect(args[2]).toMatch(/^\/.*docker\/novasdr\/docker-compose\.yml$/);
		expect(args.slice(3)).toEqual(['up', '-d', 'novasdr']);
	});

	it('stop: `docker compose -f <abs> stop novasdr`', async () => {
		await novasdrDriver.stop({});
		const stopCall = vi.mocked(execFileAsync).mock.calls[0];
		expect(stopCall[1].slice(-2)).toEqual(['stop', 'novasdr']);
	});

	it('restart: `docker compose -f <abs> restart novasdr`', async () => {
		await novasdrDriver.restart({});
		const call = vi.mocked(execFileAsync).mock.calls[0];
		expect(call[1].slice(-2)).toEqual(['restart', 'novasdr']);
	});

	it('status: docker ps filter on container name', async () => {
		vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: 'Up 5 minutes\n', stderr: '' });
		const res = await novasdrDriver.status({});
		const [cmd, args] = vi.mocked(execFileAsync).mock.calls[0];
		expect(cmd).toBe('docker');
		expect(args).toContain('ps');
		expect(args).toContain('name=novasdr-hackrf');
		const body = (await (res as Response).json()) as { running: boolean };
		expect(body.running).toBe(true);
	});
});
