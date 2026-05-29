import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('./hackrf-manager', () => ({
	detectHackRF: vi.fn(),
	getHackrfBlockingProcesses: vi.fn(),
	getContainerStatus: vi.fn()
}));

vi.mock('./alfa-manager', () => ({
	detectAdapter: vi.fn(),
	getAlfaBlockingProcesses: vi.fn(),
	killAlfaBlockingProcesses: vi.fn()
}));

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { scanForOrphans } from './resource-scan';
import { HardwareDevice, type ResourceState } from './types';

function makeState(device: HardwareDevice): ResourceState {
	return {
		device,
		isAvailable: true,
		owner: null,
		connectedSince: null,
		isDetected: false
	};
}

function setupStateMap(): Map<HardwareDevice, ResourceState> {
	const m = new Map<HardwareDevice, ResourceState>();
	m.set(HardwareDevice.HACKRF, makeState(HardwareDevice.HACKRF));
	m.set(HardwareDevice.ALFA, makeState(HardwareDevice.ALFA));
	m.set(HardwareDevice.B205, makeState(HardwareDevice.B205));
	m.set(HardwareDevice.BLUETOOTH, makeState(HardwareDevice.BLUETOOTH));
	return m;
}

describe('resource-scan — scanForOrphans (HackRF process detection)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('found HackRF process: state set to isAvailable=false + owner=process-name', async () => {
		// A process holding the device implies it is present, so detection returns
		// true; isDetected now mirrors the real detect result (not inferred from
		// process presence) — consistent with the B205/ALFA plugins.
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'hackrf_sweep' }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		const hackrf = state.get(HardwareDevice.HACKRF);
		expect(hackrf?.isAvailable).toBe(false);
		expect(hackrf?.owner).toBe('hackrf_sweep');
		expect(hackrf?.isDetected).toBe(true);
		expect(hackrf?.connectedSince).toBeGreaterThan(0);
	});

	test('no HackRF process: detectHackRF result flows into isDetected, state stays available', async () => {
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		const state = setupStateMap();
		await scanForOrphans(state);
		expect(state.get(HardwareDevice.HACKRF)?.isDetected).toBe(true);
		expect(state.get(HardwareDevice.HACKRF)?.isAvailable).toBe(true);
		expect(state.get(HardwareDevice.HACKRF)?.owner).toBeNull();
	});

	test('detection is probed even when a process is found (no short-circuit)', async () => {
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'hackrf_sweep' }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		// scanOrphans always probes detectHackRF first for ground-truth isDetected,
		// even when a process owns the device — consistent with B205/ALFA plugins.
		expect(hackrfMgr.detectHackRF).toHaveBeenCalledTimes(1);
	});
});

describe('resource-scan — scanForOrphans (HackRF container detection)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('running container sets state to owned with container name', async () => {
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'openwebrx', isRunning: true }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		const hackrf = state.get(HardwareDevice.HACKRF);
		expect(hackrf?.owner).toBe('openwebrx');
		expect(hackrf?.isAvailable).toBe(false);
	});

	test('no running container: state unchanged', async () => {
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'openwebrx', isRunning: false }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		expect(state.get(HardwareDevice.HACKRF)?.owner).toBeNull();
	});
});

describe('resource-scan — scanForOrphans (ALFA detection)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('ALFA process found: state owned + isDetected mirrors detectAdapter truthiness', async () => {
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue('wlan1');
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'kismet' }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		const alfa = state.get(HardwareDevice.ALFA);
		expect(alfa?.owner).toBe('kismet');
		expect(alfa?.isDetected).toBe(true);
		expect(alfa?.isAvailable).toBe(false);
	});

	test('ALFA process found + adapter not detected: isDetected=false but still owned', async () => {
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'kismet' }
		]);
		const state = setupStateMap();
		await scanForOrphans(state);
		const alfa = state.get(HardwareDevice.ALFA);
		expect(alfa?.owner).toBe('kismet');
		expect(alfa?.isDetected).toBe(false);
	});

	test('ALFA no process, adapter detected: state stays available, isDetected=true', async () => {
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue('wlan1');
		const state = setupStateMap();
		await scanForOrphans(state);
		const alfa = state.get(HardwareDevice.ALFA);
		expect(alfa?.owner).toBeNull();
		expect(alfa?.isDetected).toBe(true);
	});
});

describe('resource-scan — error handling', () => {
	beforeEach(() => vi.clearAllMocks());

	test('exception in scan: logs error and resolves', async () => {
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('boom')
		);
		const state = setupStateMap();
		const { logger } = await import('$lib/utils/logger');
		await expect(scanForOrphans(state)).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalled();
	});
});
