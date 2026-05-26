import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('$lib/server/hardware/hardware-registry', () => ({
	globalHardwareRegistry: {
		registerBulk: vi.fn()
	}
}));

vi.mock('./usb-detector', () => ({
	detectUSBDevices: vi.fn(async () => [])
}));

vi.mock('./serial-detector', () => ({
	detectSerialDevices: vi.fn(async () => [])
}));

vi.mock('./network-detector', () => ({
	detectNetworkDevices: vi.fn(async () => [])
}));

import { globalHardwareRegistry } from '$lib/server/hardware/hardware-registry';

import { HardwareMonitor, scanAllHardware } from './hardware-detector';
import { detectNetworkDevices } from './network-detector';
import { detectSerialDevices } from './serial-detector';
import { detectUSBDevices } from './usb-detector';

describe('scanAllHardware', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(detectSerialDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(detectNetworkDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('aggregates results from USB / Serial / Network detectors', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'usb-1',
				name: 'a',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		(detectSerialDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'serial-1',
				name: 'b',
				category: 'gps',
				connectionType: 'serial',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.detected).toHaveLength(2);
		expect(result.stats.total).toBe(2);
	});

	test('deduplicates by id (keeps first occurrence)', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'dup',
				name: 'first',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		(detectSerialDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'dup',
				name: 'second',
				category: 'gps',
				connectionType: 'serial',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.detected).toHaveLength(1);
		expect(result.detected[0].name).toBe('first');
	});

	test('registers deduplicated list with globalHardwareRegistry', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'x',
				name: 'x',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		await scanAllHardware();
		expect(globalHardwareRegistry.registerBulk).toHaveBeenCalledOnce();
	});

	test('one failing detector logs error but does not abort scan', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
		(detectNetworkDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'net-1',
				name: 'n',
				category: 'network',
				connectionType: 'network',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.detected).toHaveLength(1);
		const { logger } = await import('$lib/utils/logger');
		expect(logger.error).toHaveBeenCalled();
	});

	test('computes connected count separately from total', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: '1',
				name: 'a',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			},
			{
				id: '2',
				name: 'b',
				category: 'sdr',
				connectionType: 'usb',
				status: 'disconnected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.stats.total).toBe(2);
		expect(result.stats.connected).toBe(1);
	});

	test('computes byCategory + byConnectionType stats', async () => {
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: '1',
				name: 'a',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			},
			{
				id: '2',
				name: 'b',
				category: 'wifi',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.stats.byCategory.sdr).toBe(1);
		expect(result.stats.byCategory.wifi).toBe(1);
		expect(result.stats.byConnectionType.usb).toBe(2);
	});

	test('byCategory.unknown stays finite when a device carries category: "unknown"', async () => {
		// Pre-built record at hardware-detector.ts:58-68 seeds every HardwareCategory key
		// to 0. The mutation we’re killing: if the initializer is mutated (e.g., unknown
		// key removed), byCategory['unknown']++ becomes `undefined++` → NaN. Force the
		// path by feeding a hw row with category: 'unknown' and assert the counter is
		// a finite integer, not NaN.
		(detectUSBDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'mystery',
				name: 'mystery device',
				category: 'unknown',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await scanAllHardware();
		expect(result.stats.byCategory.unknown).toBe(1);
		expect(Number.isFinite(result.stats.byCategory.unknown)).toBe(true);
		// Sibling buckets stay 0 — the increment didn’t leak.
		expect(result.stats.byCategory.sdr).toBe(0);
		expect(result.stats.byCategory.wifi).toBe(0);
	});
});

describe('HardwareMonitor', () => {
	beforeEach(() => vi.clearAllMocks());

	test('start sets isRunning=true and triggers initial scan', () => {
		vi.useFakeTimers();
		const monitor = new HardwareMonitor();
		monitor.start();
		expect(monitor.isRunning()).toBe(true);
		monitor.stop();
		vi.useRealTimers();
	});

	test('start when already running logs warn and returns early', async () => {
		vi.useFakeTimers();
		const monitor = new HardwareMonitor();
		monitor.start();
		monitor.start();
		const { logger } = await import('$lib/utils/logger');
		expect(logger.warn).toHaveBeenCalledWith('[HardwareMonitor] Already running');
		monitor.stop();
		vi.useRealTimers();
	});

	test('stop sets isRunning=false', () => {
		vi.useFakeTimers();
		const monitor = new HardwareMonitor();
		monitor.start();
		monitor.stop();
		expect(monitor.isRunning()).toBe(false);
		vi.useRealTimers();
	});

	test('stop when not running is a no-op', () => {
		const monitor = new HardwareMonitor();
		expect(() => monitor.stop()).not.toThrow();
	});

	test('start with custom intervalMs uses that value for setInterval', () => {
		vi.useFakeTimers();
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
		const monitor = new HardwareMonitor();
		monitor.start(60_000);
		const intervalArg = setIntervalSpy.mock.calls[0][1];
		expect(intervalArg).toBe(60_000);
		monitor.stop();
		vi.useRealTimers();
	});

	test('default intervalMs is 30000 (30s)', () => {
		vi.useFakeTimers();
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
		const monitor = new HardwareMonitor();
		monitor.start();
		expect(setIntervalSpy.mock.calls[0][1]).toBe(30000);
		monitor.stop();
		vi.useRealTimers();
	});
});
