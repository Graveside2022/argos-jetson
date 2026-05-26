import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('./usb-sdr-detectors', () => ({
	detectHackRF: vi.fn(async () => []),
	detectUSRP: vi.fn(async () => []),
	detectRTLSDR: vi.fn(async () => [])
}));

import { execFileAsync } from '$lib/server/exec';

import { detectUSBDevices } from './usb-detector';
import * as sdr from './usb-sdr-detectors';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

function makeIwMock(
	phyOutput: string
): (cmd: string, args: string[]) => Promise<{ stdout: string }> {
	const responses: Record<string, string> = {
		'iw|dev': 'Interface wlan0\n',
		'iw|wlan0|info': 'ok',
		'iw|phywlan0|info': phyOutput,
		'iw|phywlan0': phyOutput
	};
	return async (cmd: string, args: string[]) => {
		if (cmd !== '/usr/sbin/iw') throw new Error(`unmocked ${cmd}`);
		const key = ['iw', ...args.slice(0, 2)].join('|');
		const stdout = responses[key];
		if (stdout === undefined) throw new Error(`unmocked iw args ${args.join(' ')}`);
		return { stdout };
	};
}

describe('detectUSBDevices — orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(sdr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectUSRP as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectRTLSDR as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		execMock.mockRejectedValue(new Error('not found'));
	});

	test('runs all 5 sub-detectors via Promise.allSettled (each can fail independently)', async () => {
		await detectUSBDevices();
		expect(sdr.detectHackRF).toHaveBeenCalled();
		expect(sdr.detectUSRP).toHaveBeenCalled();
		expect(sdr.detectRTLSDR).toHaveBeenCalled();
	});

	test('aggregates results from all successful sub-detectors', async () => {
		(sdr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'h',
				name: 'h',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		(sdr.detectRTLSDR as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'r',
				name: 'r',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await detectUSBDevices();
		expect(result).toHaveLength(2);
	});

	test('one failing sub-detector does not abort others (Promise.allSettled isolation)', async () => {
		(sdr.detectHackRF as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
		(sdr.detectRTLSDR as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'r',
				name: 'r',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities: {}
			}
		]);
		const result = await detectUSBDevices();
		expect(result).toHaveLength(1);
	});

	test('returns empty array when all sub-detectors return empty', async () => {
		expect(await detectUSBDevices()).toEqual([]);
	});
});

describe('detectUSBDevices — WiFi adapter detection (via iw)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(sdr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectUSRP as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectRTLSDR as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('returns empty when iw dev fails (no wifi)', async () => {
		execMock.mockRejectedValue(new Error('no iw'));
		const result = await detectUSBDevices();
		expect(result).toEqual([]);
	});

	test('detects monitor-capable wifi + builds compatibleTools list', async () => {
		execMock.mockImplementation(makeIwMock('2.4 GHz\nmonitor\nTX frame'));
		const result = await detectUSBDevices();
		const wifi = result.find((r) => r.category === 'wifi');
		expect(wifi).toBeDefined();
		expect((wifi?.capabilities as Record<string, unknown>).hasMonitorMode).toBe(true);
		expect((wifi?.capabilities as Record<string, unknown>).canInject).toBe(true);
		expect(wifi?.compatibleTools).toContain('wifi.scan.kismet');
	});

	test('builds wifi without monitor mode — empty compatibleTools', async () => {
		execMock.mockImplementation(makeIwMock('2.4 GHz'));
		const result = await detectUSBDevices();
		const wifi = result.find((r) => r.category === 'wifi');
		expect(wifi?.compatibleTools).toEqual([]);
	});

	test('parses both 2.4 and 5 GHz bands', async () => {
		execMock.mockImplementation(makeIwMock('2400 MHz\n5000 MHz'));
		const result = await detectUSBDevices();
		const wifi = result.find((r) => r.category === 'wifi');
		expect((wifi?.capabilities as Record<string, unknown>).frequencyBands).toEqual([
			'2.4GHz',
			'5GHz'
		]);
	});
});

describe('detectUSBDevices — Bluetooth adapter detection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(sdr.detectHackRF as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectUSRP as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(sdr.detectRTLSDR as ReturnType<typeof vi.fn>).mockResolvedValue([]);
	});

	test('returns empty when hciconfig fails (no bluetooth)', async () => {
		execMock.mockRejectedValue(new Error('hciconfig: command not found'));
		expect(await detectUSBDevices()).toEqual([]);
	});

	test('detects BLE + Classic from bluetoothctl show', async () => {
		execMock.mockImplementation(async (cmd: string) => {
			if (cmd === '/usr/bin/hciconfig') {
				return { stdout: 'hci0:	Type: Primary  Bus: USB' };
			}
			if (cmd === '/usr/bin/bluetoothctl') {
				return { stdout: 'LE supported\nBR/EDR supported' };
			}
			if (cmd === '/usr/sbin/iw') throw new Error('no iw');
			throw new Error(`unmocked ${cmd}`);
		});
		const result = await detectUSBDevices();
		const bt = result.find((r) => r.category === 'bluetooth');
		const caps = bt?.capabilities as Record<string, unknown>;
		expect(caps.hasBleSupport).toBe(true);
		expect(caps.hasClassicSupport).toBe(true);
	});

	test('falls back to default capabilities when bluetoothctl fails', async () => {
		execMock.mockImplementation(async (cmd: string) => {
			if (cmd === '/usr/bin/hciconfig') return { stdout: 'hci0:	Type: Primary' };
			if (cmd === '/usr/bin/bluetoothctl') throw new Error('busy');
			if (cmd === '/usr/sbin/iw') throw new Error('no iw');
			throw new Error('unmocked');
		});
		const result = await detectUSBDevices();
		const bt = result.find((r) => r.category === 'bluetooth');
		const caps = bt?.capabilities as Record<string, unknown>;
		expect(caps.hasBleSupport).toBe(true);
		expect(caps.hasClassicSupport).toBe(true);
	});
});
