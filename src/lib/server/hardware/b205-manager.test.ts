import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/delay', () => ({
	delay: vi.fn(() => Promise.resolve())
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('./process-utils', () => ({
	findBlockingProcesses: vi.fn(),
	killMatchingProcesses: vi.fn()
}));

import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

import {
	detectB205,
	getB205BlockingProcesses,
	getServiceStatus,
	killB205BlockingProcesses,
	stopServices
} from './b205-manager';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

describe('b205-manager — detectB205', () => {
	beforeEach(() => vi.clearAllMocks());

	test('returns true when lsusb stdout contains the B205 USB id', async () => {
		execMock.mockResolvedValue({ stdout: 'Bus 003 Device 005: ID 2500:0022 USRP B205mini' });
		expect(await detectB205()).toBe(true);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/lsusb', [], { timeout: 3000 });
	});

	test('returns false when stdout missing the B205 USB id', async () => {
		execMock.mockResolvedValue({ stdout: 'Bus 001 Device 001: ID 1d6b:0002' });
		expect(await detectB205()).toBe(false);
	});

	test('returns false on lsusb error (timeout, missing binary)', async () => {
		execMock.mockRejectedValue(new Error('ENOENT'));
		expect(await detectB205()).toBe(false);
	});

	test('lsusb call has 3000ms timeout (graceful-degradation rule 1)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await detectB205();
		const opts = execMock.mock.calls[0][2];
		expect(opts).toEqual({ timeout: 3000 });
	});
});

describe('b205-manager — process delegation', () => {
	beforeEach(() => vi.clearAllMocks());

	test('getB205BlockingProcesses delegates to findBlockingProcesses', async () => {
		const procs = [{ pid: '1', name: 'uhd_find_devices' }];
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(procs);
		expect(await getB205BlockingProcesses()).toBe(procs);
		expect(findBlockingProcesses).toHaveBeenCalledOnce();
	});

	test('getB205BlockingProcesses passes the canonical B205 process set', async () => {
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		await getB205BlockingProcesses();
		const configs = (findBlockingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const names = configs.map((c: { name: string }) => c.name);
		expect(names).toContain('uhd_find_devices');
		expect(names).toContain('uhd_usrp_probe');
		expect(names).toContain('uhd_fft');
		expect(names).toContain('rx_samples_to_file');
		expect(names).toContain('fpv_energy_scan.py');
		expect(names).toContain('gnuradio-companion');
	});

	test('killB205BlockingProcesses delegates to killMatchingProcesses', async () => {
		(killMatchingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		await killB205BlockingProcesses();
		expect(killMatchingProcesses).toHaveBeenCalledOnce();
	});

	test('python-wrapped tools use useCmdlineMatch=true', async () => {
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		await getB205BlockingProcesses();
		const configs = (findBlockingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const fpv = configs.find((c: { name: string }) => c.name === 'fpv_energy_scan.py');
		expect(fpv.useCmdlineMatch).toBe(true);
		expect(fpv.cmdlinePattern).toContain('fpv_energy_scan');
	});
});

describe('b205-manager — stopServices', () => {
	beforeEach(() => vi.clearAllMocks());

	test('stops each B205 systemd service via sudo systemctl', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await stopServices();
		expect(execMock).toHaveBeenCalledWith(
			'/usr/bin/sudo',
			['-n', '/usr/bin/systemctl', 'stop', 'wardragon-fpv-detect.service'],
			{ timeout: 10000 }
		);
	});

	test('logs info on successful stop', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await stopServices();
		expect(logger.info).toHaveBeenCalledWith(
			'[b205-manager] stopped service',
			expect.objectContaining({ unit: 'wardragon-fpv-detect.service' })
		);
	});

	test('logs warn (does not throw) on stop failure', async () => {
		execMock.mockRejectedValue(new Error('permission denied'));
		await expect(stopServices()).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(
			'[b205-manager] failed to stop service',
			expect.objectContaining({ error: 'permission denied' })
		);
	});

	test('delays 1500ms after stopping all services (cleanup window)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await stopServices();
		const { delay } = await import('$lib/utils/delay');
		expect(delay).toHaveBeenCalledWith(1500);
	});
});

describe('b205-manager — getServiceStatus', () => {
	beforeEach(() => vi.clearAllMocks());

	test('reports isActive=true when systemctl is-active stdout is "active"', async () => {
		execMock.mockResolvedValue({ stdout: 'active\n' });
		const result = await getServiceStatus();
		expect(result).toEqual([{ name: 'wardragon-fpv-detect.service', isActive: true }]);
	});

	test('reports isActive=false when stdout is "inactive"', async () => {
		execMock.mockResolvedValue({ stdout: 'inactive\n' });
		const result = await getServiceStatus();
		expect(result).toEqual([{ name: 'wardragon-fpv-detect.service', isActive: false }]);
	});

	test('reports isActive=false when systemctl exits non-zero (service unknown)', async () => {
		execMock.mockRejectedValue(new Error('unit not found'));
		const result = await getServiceStatus();
		expect(result).toEqual([{ name: 'wardragon-fpv-detect.service', isActive: false }]);
	});

	test('trims stdout before comparing — "active\\n " becomes "active"', async () => {
		execMock.mockResolvedValue({ stdout: '  active  \n' });
		const result = await getServiceStatus();
		expect(result[0].isActive).toBe(true);
	});

	test('uses 3000ms timeout on systemctl call (graceful-degradation)', async () => {
		execMock.mockResolvedValue({ stdout: 'active' });
		await getServiceStatus();
		expect(execMock).toHaveBeenCalledWith(
			'/usr/bin/systemctl',
			['is-active', 'wardragon-fpv-detect.service'],
			{ timeout: 3000 }
		);
	});
});
