import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/kismet/alfa-detector', () => ({
	AlfaDetector: {
		getAlfaInterface: vi.fn()
	}
}));

vi.mock('./process-utils', () => ({
	findBlockingProcesses: vi.fn(),
	killMatchingProcesses: vi.fn()
}));

import { AlfaDetector } from '$lib/server/kismet/alfa-detector';

import { detectAdapter, getAlfaBlockingProcesses, killAlfaBlockingProcesses } from './alfa-manager';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const EXPECTED_ALFA_PROCESSES = ['kismet', 'wifite', 'bettercap', 'airodump-ng', 'aireplay-ng'];

describe('alfa-manager — detectAdapter', () => {
	beforeEach(() => vi.clearAllMocks());

	test('delegates to AlfaDetector.getAlfaInterface', async () => {
		(AlfaDetector.getAlfaInterface as ReturnType<typeof vi.fn>).mockResolvedValue('wlan1');
		expect(await detectAdapter()).toBe('wlan1');
		expect(AlfaDetector.getAlfaInterface).toHaveBeenCalledOnce();
	});

	test('returns null when no adapter detected', async () => {
		(AlfaDetector.getAlfaInterface as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		expect(await detectAdapter()).toBeNull();
	});
});

describe('alfa-manager — getAlfaBlockingProcesses', () => {
	beforeEach(() => vi.clearAllMocks());

	test('delegates to findBlockingProcesses with the ALFA_PROCESS_CONFIGS array', async () => {
		const procs = [{ pid: '1234', name: 'kismet' }];
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(procs);
		const result = await getAlfaBlockingProcesses();
		expect(result).toBe(procs);
		expect(findBlockingProcesses).toHaveBeenCalledOnce();
	});

	test('passes the canonical ALFA blocker config set', async () => {
		(findBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		await getAlfaBlockingProcesses();
		const arg = (findBlockingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const names = arg.map((p: { name: string }) => p.name);
		expect(names).toEqual(EXPECTED_ALFA_PROCESSES);
	});
});

describe('alfa-manager — killAlfaBlockingProcesses', () => {
	beforeEach(() => vi.clearAllMocks());

	test('delegates to killMatchingProcesses with the ALFA_PROCESS_CONFIGS array', async () => {
		(killMatchingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		await killAlfaBlockingProcesses();
		expect(killMatchingProcesses).toHaveBeenCalledOnce();
		const arg = (killMatchingProcesses as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const names = arg.map((p: { name: string }) => p.name);
		expect(names).toEqual(EXPECTED_ALFA_PROCESSES);
	});
});
