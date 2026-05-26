import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('$lib/server/env', () => ({
	env: { GPSD_SOCKET_PATH: '/var/run/gpsd.sock' }
}));

vi.mock('fs/promises', () => {
	const readdir = vi.fn();
	const readFile = vi.fn();
	return {
		default: { readdir, readFile },
		readdir,
		readFile
	};
});

import { readdir, readFile } from 'fs/promises';

import { execFileAsync } from '$lib/server/exec';

import { detectSerialDevices } from './serial-detector';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;
const readdirMock = readdir as ReturnType<typeof vi.fn>;
const readFileMock = readFile as ReturnType<typeof vi.fn>;

describe('detectSerialDevices — orchestration + GPS', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		readdirMock.mockResolvedValue([]);
		execMock.mockRejectedValue(new Error('not found'));
		readFileMock.mockRejectedValue(new Error('no file'));
	});

	test('returns empty when /dev readdir fails', async () => {
		readdirMock.mockRejectedValue(new Error('eperm'));
		expect(await detectSerialDevices()).toEqual([]);
	});

	test('returns empty when no ttyUSB/ttyACM/ttyAMA devices present', async () => {
		readdirMock.mockResolvedValue(['null', 'sda1']);
		expect(await detectSerialDevices()).toEqual([]);
	});

	test('detects GPS via NMEA sentence on ttyUSB device', async () => {
		readdirMock.mockResolvedValue(['ttyUSB0']);
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/cat' && args[0] === '/dev/ttyUSB0') {
				return { stdout: '$GPGGA,123456,...' };
			}
			throw new Error('unmocked');
		});
		const result = await detectSerialDevices();
		const gps = result.find((r) => r.category === 'gps');
		expect(gps).toBeDefined();
		expect(gps?.id).toBe('gps-ttyUSB0');
		expect(gps?.device).toBe('/dev/ttyUSB0');
	});

	test('skips ttyUSB device when no NMEA sentence in output', async () => {
		readdirMock.mockResolvedValue(['ttyUSB0']);
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/cat' && args[0] === '/dev/ttyUSB0') {
				return { stdout: 'random binary data' };
			}
			throw new Error('unmocked');
		});
		expect(await detectSerialDevices()).toEqual([]);
	});

	test('cat /dev/ttyXXX has 3000ms timeout (graceful-degradation)', async () => {
		readdirMock.mockResolvedValue(['ttyUSB0']);
		execMock.mockResolvedValue({ stdout: '$GPGGA' });
		await detectSerialDevices();
		const catCall = execMock.mock.calls.find(
			(c) => c[0] === '/usr/bin/cat' && c[1]?.[0] === '/dev/ttyUSB0'
		);
		expect(catCall?.[2]).toEqual(expect.objectContaining({ timeout: 3000 }));
	});

	test('detects GPSD virtual device when systemctl is-active returns "active"', async () => {
		readdirMock.mockResolvedValue([]);
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/systemctl' && args[1] === 'gpsd') {
				return { stdout: 'active\n' };
			}
			throw new Error('unmocked');
		});
		const result = await detectSerialDevices();
		const gpsd = result.find((r) => r.id === 'gps-gpsd');
		expect(gpsd?.connectionType).toBe('virtual');
	});

	test('skips GPSD virtual device when systemctl says inactive', async () => {
		readdirMock.mockResolvedValue([]);
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/systemctl' && args[1] === 'gpsd') {
				return { stdout: 'inactive\n' };
			}
			throw new Error('unmocked');
		});
		const result = await detectSerialDevices();
		expect(result.find((r) => r.id === 'gps-gpsd')).toBeUndefined();
	});
});

describe('detectSerialDevices — cellular modem', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		readdirMock.mockResolvedValue([]);
	});

	test('returns no modems when mmcli -L errors', async () => {
		execMock.mockRejectedValue(new Error('mmcli missing'));
		expect(await detectSerialDevices()).toEqual([]);
	});

	test('returns no modems when stdout lacks /Modem/', async () => {
		execMock.mockResolvedValue({ stdout: 'no modems found' });
		expect(await detectSerialDevices()).toEqual([]);
	});

	test('parses bands from modem details (GSM/LTE/5G)', async () => {
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/mmcli' && args[0] === '-L') {
				return { stdout: '/org/freedesktop/ModemManager1/Modem/0' };
			}
			if (cmd === '/usr/bin/mmcli' && args[0] === '-m') {
				return { stdout: 'model: Quectel\nimei: 12345\nstate: connected\nLTE/5G bands' };
			}
			throw new Error('unmocked');
		});
		const result = await detectSerialDevices();
		const cell = result.find((r) => r.category === 'cellular');
		expect((cell?.capabilities as Record<string, unknown>).supportedBands).toContain('LTE');
		expect((cell?.capabilities as Record<string, unknown>).supportedBands).toContain('5G');
	});
});

describe('detectSerialDevices — generic serial dedup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		readdirMock.mockResolvedValue([]);
		execMock.mockRejectedValue(new Error('not found'));
		readFileMock.mockRejectedValue(new Error('no file'));
	});

	test('deduplicates devices by device path across sub-detectors', async () => {
		// Same device path showing up twice (GPS + generic) → only one result
		readdirMock.mockResolvedValue(['ttyUSB0']);
		execMock.mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === '/usr/bin/cat' && args[0] === '/dev/ttyUSB0') {
				return { stdout: '$GPGGA' };
			}
			throw new Error('unmocked');
		});
		readFileMock.mockResolvedValue('Some Manufacturer');
		const result = await detectSerialDevices();
		// Only one device per /dev/ttyUSB0 path (GPS dedupes the generic)
		const ttyUsbDevices = result.filter((r) => r.device === '/dev/ttyUSB0');
		expect(ttyUsbDevices).toHaveLength(1);
	});
});
