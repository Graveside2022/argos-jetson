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

/** Narrow a mock call tuple so tests can index without non-null assertions. */
function firstCallArgs(): readonly [string, readonly string[] | undefined] {
	const call = vi.mocked(execFileAsync).mock.calls[0];
	if (!call) throw new Error('execFileAsync was not called');
	return [call[0], call[1]];
}

function firstCallArgv(): readonly string[] {
	const [, args] = firstCallArgs();
	if (!args) throw new Error('execFileAsync called with no argv');
	return args;
}

describe('novasdrDriver', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(execFileAsync).mockResolvedValue({ stdout: '', stderr: '' });
	});

	it('start: `docker compose -f <abs> up -d novasdr`', async () => {
		await novasdrDriver.start({});
		const [cmd] = firstCallArgs();
		const args = firstCallArgv();
		expect(cmd).toBe('docker');
		expect(args[0]).toBe('compose');
		expect(args[1]).toBe('-f');
		expect(args[2]).toMatch(/^\/.*docker\/novasdr\/docker-compose\.yml$/);
		expect(args.slice(3)).toEqual(['up', '-d', 'novasdr']);
	});

	it('stop: `docker compose -f <abs> stop novasdr`', async () => {
		await novasdrDriver.stop({});
		expect(firstCallArgv().slice(-2)).toEqual(['stop', 'novasdr']);
	});

	it('restart: `docker compose -f <abs> restart novasdr`', async () => {
		await novasdrDriver.restart({});
		expect(firstCallArgv().slice(-2)).toEqual(['restart', 'novasdr']);
	});

	it('status: docker ps filter on container name', async () => {
		vi.mocked(execFileAsync).mockResolvedValueOnce({ stdout: 'Up 5 minutes\n', stderr: '' });
		const res = await novasdrDriver.status({});
		const [cmd] = firstCallArgs();
		const args = firstCallArgv();
		expect(cmd).toBe('docker');
		expect(args).toContain('ps');
		expect(args).toContain('name=novasdr-hackrf');
		const body = (await (res as Response).json()) as { running: boolean };
		expect(body.running).toBe(true);
	});
});
