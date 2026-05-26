import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/delay', () => ({
	delay: vi.fn(() => Promise.resolve())
}));

vi.mock('./process-utils', () => ({
	findBlockingProcesses: vi.fn(),
	killMatchingProcesses: vi.fn()
}));

import { execFileAsync } from '$lib/server/exec';

import {
	detectHackRF,
	getContainerStatus,
	getHackrfBlockingProcesses,
	killHackrfBlockingProcesses,
	stopContainers
} from './hackrf-manager';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

describe('hackrf-manager — detectHackRF', () => {
	beforeEach(() => vi.clearAllMocks());

	test('returns true when hackrf_info stdout contains "Serial number"', async () => {
		execMock.mockResolvedValue({ stdout: 'Serial number: 0000000000000000a06063c826b35a5b' });
		expect(await detectHackRF()).toBe(true);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/hackrf_info', [], { timeout: 3000 });
	});

	test('returns false when hackrf_info succeeds but stdout lacks "Serial number"', async () => {
		execMock.mockResolvedValue({ stdout: 'no hackrf found' });
		expect(await detectHackRF()).toBe(false);
	});

	test('falls back to lsusb 1d50:6089 check when hackrf_info fails', async () => {
		execMock.mockRejectedValueOnce(new Error('device busy')).mockResolvedValueOnce({
			stdout: 'Bus 003 Device 005: ID 1d50:6089 Great Scott Gadgets HackRF One'
		});
		expect(await detectHackRF()).toBe(true);
		expect(execMock).toHaveBeenCalledTimes(2);
		expect(execMock.mock.calls[1]).toEqual(['/usr/bin/lsusb', []]);
	});

	test('returns false when both hackrf_info AND lsusb fail', async () => {
		execMock
			.mockRejectedValueOnce(new Error('device busy'))
			.mockRejectedValueOnce(new Error('lsusb missing'));
		expect(await detectHackRF()).toBe(false);
	});

	test('returns false when lsusb fallback runs but stdout lacks 1d50:6089', async () => {
		execMock
			.mockRejectedValueOnce(new Error('device busy'))
			.mockResolvedValueOnce({ stdout: 'no hackrf' });
		expect(await detectHackRF()).toBe(false);
	});

	test('hackrf_info has 3000ms timeout (graceful-degradation rule 1)', async () => {
		execMock.mockResolvedValue({ stdout: 'Serial number: x' });
		await detectHackRF();
		expect(execMock.mock.calls[0][2]).toEqual({ timeout: 3000 });
	});
});

describe('hackrf-manager — process delegation', () => {
	beforeEach(() => vi.clearAllMocks());

	test('getHackrfBlockingProcesses delegates to findBlockingProcesses', async () => {
		const procs = [{ pid: '1', name: 'hackrf_sweep' }];
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(procs);
		expect(await getHackrfBlockingProcesses()).toBe(procs);
	});

	test('config set includes native + python-wrapped processes', async () => {
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		await getHackrfBlockingProcesses();
		const configs = (findBlockingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const names = configs.map((c: { name: string }) => c.name);
		expect(names).toContain('hackrf_sweep');
		expect(names).toContain('hackrf_transfer');
		expect(names).toContain('hackrf_info');
		expect(names).toContain('soapy_connector');
		expect(names).toContain('grgsm_livemon');
		expect(names).toContain('grgsm_livemon_headless');
	});

	test('python tools have useCmdlineMatch=true with anchored pattern', async () => {
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		await getHackrfBlockingProcesses();
		const configs = (findBlockingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const grgsm = configs.find((c: { name: string }) => c.name === 'grgsm_livemon');
		expect(grgsm.useCmdlineMatch).toBe(true);
		expect(grgsm.cmdlinePattern).toContain('grgsm_livemon');
	});

	test('killHackrfBlockingProcesses delegates to killMatchingProcesses', async () => {
		(killMatchingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		await killHackrfBlockingProcesses();
		expect(killMatchingProcesses).toHaveBeenCalledOnce();
	});
});

describe('hackrf-manager — getContainerStatus', () => {
	beforeEach(() => vi.clearAllMocks());

	test('reports isRunning=true on exact container name match', async () => {
		execMock.mockResolvedValue({ stdout: 'openwebrx\n' });
		const result = await getContainerStatus(true);
		const owr = result.find((r) => r.name === 'openwebrx');
		expect(owr?.isRunning).toBe(true);
	});

	test('reports isRunning=false when docker stdout lists a different (substring) name', async () => {
		// docker filter does substring; we require exact-name match
		execMock.mockResolvedValue({ stdout: 'openwebrx-hackrf\n' });
		const result = await getContainerStatus(true);
		const owr = result.find((r) => r.name === 'openwebrx');
		expect(owr?.isRunning).toBe(false);
	});

	test('reports isRunning=false on docker error (daemon down)', async () => {
		execMock.mockRejectedValue(new Error('docker: not running'));
		const result = await getContainerStatus(true);
		expect(result.every((r) => r.isRunning === false)).toBe(true);
	});

	test('default toolOnly=false uses HACKRF_ALL_CONTAINERS list', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		const result = await getContainerStatus();
		const names = result.map((r) => r.name);
		expect(names).toContain('openwebrx');
		expect(names).toContain('openwebrx-hackrf');
		expect(names).toContain('novasdr-hackrf');
		expect(names).toContain('pagermon');
	});

	test('toolOnly=true uses HACKRF_TOOL_CONTAINERS list', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		const result = await getContainerStatus(true);
		const names = result.map((r) => r.name);
		expect(names).toContain('openwebrx');
		expect(names).toContain('pagermon');
	});

	test('docker ps invoked with name filter + {{.Names}} format per container', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await getContainerStatus(true);
		const call = execMock.mock.calls[0];
		expect(call[0]).toBe('/usr/bin/docker');
		expect(call[1]).toContain('ps');
		expect(call[1]).toContain('--filter');
		expect(call[1]).toContain('--format');
		expect(call[1]).toContain('{{.Names}}');
	});

	test('checks ALL configured containers (one exec call per container)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await getContainerStatus(true);
		const toolOnlyCount = execMock.mock.calls.length;
		expect(toolOnlyCount).toBeGreaterThanOrEqual(2);
	});
});

describe('hackrf-manager — stopContainers', () => {
	beforeEach(() => vi.clearAllMocks());

	test('issues docker stop for each container in ALL_CONTAINERS list', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await stopContainers();
		const calls = execMock.mock.calls;
		const stoppedNames = calls.map((c) => c[1][1]);
		expect(stoppedNames).toEqual([
			'openwebrx',
			'openwebrx-hackrf',
			'novasdr-hackrf',
			'pagermon'
		]);
	});

	test('swallows docker stop errors (container missing)', async () => {
		execMock.mockRejectedValue(new Error('no such container'));
		await expect(stopContainers()).resolves.toBeUndefined();
	});

	test('waits 3000ms after stop loop (USB release window — graceful-degradation)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await stopContainers();
		const { delay } = await import('$lib/utils/delay');
		expect(delay).toHaveBeenCalledWith(3000);
	});
});
