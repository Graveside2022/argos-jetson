import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/delay', () => ({
	delay: vi.fn(() => Promise.resolve())
}));

import { execFileAsync } from '$lib/server/exec';

import type { ProcessConfig } from './process-utils';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

describe('process-utils — findBlockingProcesses', () => {
	beforeEach(() => vi.clearAllMocks());

	test('empty configs returns empty array (no pgrep calls)', async () => {
		const result = await findBlockingProcesses([]);
		expect(result).toEqual([]);
		expect(execMock).not.toHaveBeenCalled();
	});

	test('exact-comm match config uses pgrep -x with name', async () => {
		execMock.mockResolvedValue({ stdout: '1234\n5678\n' });
		const configs: ProcessConfig[] = [{ name: 'hackrf_sweep' }];
		await findBlockingProcesses(configs);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pgrep', ['-x', 'hackrf_sweep']);
	});

	test('cmdline match config uses pgrep -f with cmdlinePattern, not name', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		const configs: ProcessConfig[] = [
			{ name: 'grgsm_livemon', useCmdlineMatch: true, cmdlinePattern: 'python.*grgsm' }
		];
		await findBlockingProcesses(configs);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pgrep', ['-f', 'python.*grgsm']);
	});

	test('cmdline match without cmdlinePattern falls back to name', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		const configs: ProcessConfig[] = [{ name: 'mytool', useCmdlineMatch: true }];
		await findBlockingProcesses(configs);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pgrep', ['-f', 'mytool']);
	});

	test('parses pgrep stdout into ProcessEntry[] with config name as label', async () => {
		execMock.mockResolvedValue({ stdout: '1234\n5678\n9999\n' });
		const result = await findBlockingProcesses([{ name: 'hackrf_sweep' }]);
		expect(result).toEqual([
			{ pid: '1234', name: 'hackrf_sweep' },
			{ pid: '5678', name: 'hackrf_sweep' },
			{ pid: '9999', name: 'hackrf_sweep' }
		]);
	});

	test('uses displayName for label when provided', async () => {
		execMock.mockResolvedValue({ stdout: '42\n' });
		const result = await findBlockingProcesses([
			{ name: 'hackrf_sweep', displayName: 'Spectrum Sweep' }
		]);
		expect(result).toEqual([{ pid: '42', name: 'Spectrum Sweep' }]);
	});

	test('filters empty stdout lines (trailing newline)', async () => {
		execMock.mockResolvedValue({ stdout: '\n42\n\n\n' });
		const result = await findBlockingProcesses([{ name: 'tool' }]);
		expect(result).toEqual([{ pid: '42', name: 'tool' }]);
	});

	test('returns empty array on pgrep exit-1 (no matches)', async () => {
		execMock.mockRejectedValue(new Error('exit 1'));
		const result = await findBlockingProcesses([{ name: 'tool' }]);
		expect(result).toEqual([]);
	});

	test('flattens results across multiple configs', async () => {
		execMock
			.mockResolvedValueOnce({ stdout: '1\n' })
			.mockResolvedValueOnce({ stdout: '2\n3\n' });
		const result = await findBlockingProcesses([{ name: 'a' }, { name: 'b' }]);
		expect(result).toEqual([
			{ pid: '1', name: 'a' },
			{ pid: '2', name: 'b' },
			{ pid: '3', name: 'b' }
		]);
	});

	test('one failing config does not abort others (per-config error isolation)', async () => {
		execMock
			.mockRejectedValueOnce(new Error('exit 1'))
			.mockResolvedValueOnce({ stdout: '99\n' });
		const result = await findBlockingProcesses([{ name: 'absent' }, { name: 'present' }]);
		expect(result).toEqual([{ pid: '99', name: 'present' }]);
	});

	test('empty stdout returns empty array', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		const result = await findBlockingProcesses([{ name: 'tool' }]);
		expect(result).toEqual([]);
	});
});

describe('process-utils — killMatchingProcesses', () => {
	beforeEach(() => vi.clearAllMocks());

	test('empty configs still delays (cleanup window) but no pkill', async () => {
		await killMatchingProcesses([]);
		expect(execMock).not.toHaveBeenCalled();
		const { delay } = await import('$lib/utils/delay');
		expect(delay).toHaveBeenCalledWith(2000);
	});

	test('exact match config invokes pkill -9 -x name', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await killMatchingProcesses([{ name: 'tool' }]);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pkill', ['-9', '-x', 'tool']);
	});

	test('cmdline match with pattern invokes pkill -9 -f pattern', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await killMatchingProcesses([
			{ name: 'tool', useCmdlineMatch: true, cmdlinePattern: 'python.*tool' }
		]);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pkill', ['-9', '-f', 'python.*tool']);
	});

	test('cmdline match without pattern uses name as pattern', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await killMatchingProcesses([{ name: 'tool', useCmdlineMatch: true }]);
		expect(execMock).toHaveBeenCalledWith('/usr/bin/pkill', ['-9', '-f', 'tool']);
	});

	test('swallows pkill errors (process already dead)', async () => {
		execMock.mockRejectedValue(new Error('exit 1'));
		await expect(killMatchingProcesses([{ name: 'tool' }])).resolves.toBeUndefined();
	});

	test('iterates ALL configs even when first throws', async () => {
		execMock
			.mockRejectedValueOnce(new Error('first fail'))
			.mockResolvedValueOnce({ stdout: '' });
		await killMatchingProcesses([{ name: 'first' }, { name: 'second' }]);
		expect(execMock).toHaveBeenCalledTimes(2);
		expect(execMock.mock.calls[1]).toEqual(['/usr/bin/pkill', ['-9', '-x', 'second']]);
	});

	test('uses custom waitMs when passed', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await killMatchingProcesses([{ name: 'tool' }], 500);
		const { delay } = await import('$lib/utils/delay');
		expect(delay).toHaveBeenCalledWith(500);
	});

	test('default waitMs is 2000ms (cleanup window)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await killMatchingProcesses([{ name: 'tool' }]);
		const { delay } = await import('$lib/utils/delay');
		expect(delay).toHaveBeenCalledWith(2000);
	});
});
