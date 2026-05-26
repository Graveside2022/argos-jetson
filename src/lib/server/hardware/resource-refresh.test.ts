import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('./hackrf-manager', () => ({
	detectHackRF: vi.fn(),
	getHackrfBlockingProcesses: vi.fn(),
	getContainerStatus: vi.fn(),
	killHackrfBlockingProcesses: vi.fn(),
	stopContainers: vi.fn()
}));

vi.mock('./alfa-manager', () => ({
	detectAdapter: vi.fn(),
	getAlfaBlockingProcesses: vi.fn(),
	killAlfaBlockingProcesses: vi.fn()
}));

vi.mock('./b205-manager', () => ({
	detectB205: vi.fn(),
	getB205BlockingProcesses: vi.fn(),
	getServiceStatus: vi.fn(),
	killB205BlockingProcesses: vi.fn(),
	stopServices: vi.fn()
}));

import * as alfaMgr from './alfa-manager';
import * as b205Mgr from './b205-manager';
import * as hackrfMgr from './hackrf-manager';
import { dispatchRefresh, killDeviceHolders, refreshDetection } from './resource-refresh';
import { HardwareDevice, type ResourceState } from './types';

function makeState(device: HardwareDevice, overrides: Partial<ResourceState> = {}): ResourceState {
	return {
		device,
		isAvailable: true,
		owner: null,
		connectedSince: null,
		isDetected: false,
		...overrides
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

describe('resource-refresh — dispatchRefresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(b205Mgr.detectB205 as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(b205Mgr.getB205BlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(b205Mgr.getServiceStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('HACKRF dispatch sets isDetected from detectHackRF', async () => {
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.HACKRF);
		expect(state.get(HardwareDevice.HACKRF)?.isDetected).toBe(true);
	});

	test('HACKRF dispatch sets owner from first process when present', async () => {
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'hackrf_sweep' }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.HACKRF);
		expect(state.get(HardwareDevice.HACKRF)?.owner).toBe('hackrf_sweep');
		expect(state.get(HardwareDevice.HACKRF)?.isAvailable).toBe(false);
	});

	test('HACKRF dispatch canonicalizes openwebrx-hackrf container to openwebrx', async () => {
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'openwebrx-hackrf', isRunning: true }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.HACKRF);
		expect(state.get(HardwareDevice.HACKRF)?.owner).toBe('openwebrx');
	});

	test('ALFA dispatch sets isDetected based on truthy detectAdapter result', async () => {
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue('wlan1');
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.ALFA);
		expect(state.get(HardwareDevice.ALFA)?.isDetected).toBe(true);
	});

	test('ALFA dispatch leaves isDetected=false when detectAdapter returns null', async () => {
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.ALFA);
		expect(state.get(HardwareDevice.ALFA)?.isDetected).toBe(false);
	});

	test('ALFA dispatch sets owner from first blocking process', async () => {
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue('wlan1');
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'kismet' }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.ALFA);
		expect(state.get(HardwareDevice.ALFA)?.owner).toBe('kismet');
	});

	test('B205 dispatch prefers process owner over active service', async () => {
		(b205Mgr.detectB205 as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(b205Mgr.getB205BlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ pid: '1', name: 'uhd_fft' }
		]);
		(b205Mgr.getServiceStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'wardragon-fpv-detect.service', isActive: true }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.B205);
		expect(state.get(HardwareDevice.B205)?.owner).toBe('uhd_fft');
	});

	test('B205 dispatch falls back to active service name (stripped .service suffix) when no process', async () => {
		(b205Mgr.detectB205 as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(b205Mgr.getServiceStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'wardragon-fpv-detect.service', isActive: true }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.B205);
		expect(state.get(HardwareDevice.B205)?.owner).toBe('wardragon-fpv-detect');
	});

	test('B205 dispatch sets owner to null when no process AND no active service', async () => {
		(b205Mgr.detectB205 as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		(b205Mgr.getServiceStatus as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ name: 'wardragon-fpv-detect.service', isActive: false }
		]);
		const state = setupStateMap();
		await dispatchRefresh(state, HardwareDevice.B205);
		expect(state.get(HardwareDevice.B205)?.owner).toBeNull();
	});

	test('dispatchRefresh of BLUETOOTH device is a no-op (no manager wired)', async () => {
		const state = setupStateMap();
		const before = { ...(state.get(HardwareDevice.BLUETOOTH) as ResourceState) };
		await dispatchRefresh(state, HardwareDevice.BLUETOOTH);
		expect(state.get(HardwareDevice.BLUETOOTH)).toEqual(before);
	});

	test('dispatchRefresh of unknown device id is silent no-op', async () => {
		const state = setupStateMap();
		await dispatchRefresh(state, 'mystery' as HardwareDevice);
		// No throws — assertion is implicit (test passes)
		expect(state.size).toBe(4);
	});
});

describe('resource-refresh — refreshDetection (full pass)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(hackrfMgr.getHackrfBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(hackrfMgr.getContainerStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(alfaMgr.detectAdapter as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		(alfaMgr.getAlfaBlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(b205Mgr.detectB205 as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(b205Mgr.getB205BlockingProcesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(b205Mgr.getServiceStatus as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('runs hackrf + alfa + b205 refreshes in order', async () => {
		const state = setupStateMap();
		await refreshDetection(state);
		expect(hackrfMgr.detectHackRF).toHaveBeenCalled();
		expect(alfaMgr.detectAdapter).toHaveBeenCalled();
		expect(b205Mgr.detectB205).toHaveBeenCalled();
	});

	test('caught error logs warn (does not throw)', async () => {
		(hackrfMgr.detectHackRF as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
		const state = setupStateMap();
		const { logger } = await import('$lib/utils/logger');
		await expect(refreshDetection(state)).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalled();
	});
});

describe('resource-refresh — killDeviceHolders', () => {
	beforeEach(() => vi.clearAllMocks());

	test('HACKRF: kills processes then stops containers', async () => {
		await killDeviceHolders(HardwareDevice.HACKRF);
		expect(hackrfMgr.killHackrfBlockingProcesses).toHaveBeenCalledOnce();
		expect(hackrfMgr.stopContainers).toHaveBeenCalledOnce();
	});

	test('ALFA: kills processes only', async () => {
		await killDeviceHolders(HardwareDevice.ALFA);
		expect(alfaMgr.killAlfaBlockingProcesses).toHaveBeenCalledOnce();
		expect(hackrfMgr.killHackrfBlockingProcesses).not.toHaveBeenCalled();
	});

	test('B205: stops services then kills processes', async () => {
		await killDeviceHolders(HardwareDevice.B205);
		expect(b205Mgr.stopServices).toHaveBeenCalledOnce();
		expect(b205Mgr.killB205BlockingProcesses).toHaveBeenCalledOnce();
	});

	test('BLUETOOTH: no-op (no manager)', async () => {
		await killDeviceHolders(HardwareDevice.BLUETOOTH);
		expect(hackrfMgr.killHackrfBlockingProcesses).not.toHaveBeenCalled();
		expect(alfaMgr.killAlfaBlockingProcesses).not.toHaveBeenCalled();
		expect(b205Mgr.killB205BlockingProcesses).not.toHaveBeenCalled();
	});
});
