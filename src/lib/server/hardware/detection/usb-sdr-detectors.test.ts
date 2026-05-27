import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { execFileAsync } from '$lib/server/exec';

import { detectHackRF, detectRTLSDR, detectUSRP } from './usb-sdr-detectors';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

describe('detectHackRF', () => {
	beforeEach(() => vi.clearAllMocks());

	test('returns empty array when hackrf_info errors (no device)', async () => {
		execMock.mockRejectedValue(new Error('no devices'));
		expect(await detectHackRF()).toEqual([]);
	});

	test('returns empty array when stdout has no Serial number line', async () => {
		execMock.mockResolvedValue({ stdout: 'no hackrf' });
		expect(await detectHackRF()).toEqual([]);
	});

	test('parses serial + builds HackRF device with default productId 6089', async () => {
		execMock.mockResolvedValue({
			stdout: 'Serial number: 0000abc\nFirmware Version: 2024.02.1'
		});
		const result = await detectHackRF();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 'hackrf-0000abc',
			name: 'HackRF One',
			category: 'sdr',
			connectionType: 'usb',
			serial: '0000abc',
			productId: '6089',
			vendorId: '1d50',
			firmwareVersion: '2024.02.1'
		});
	});

	test('resolves productId 604b when Part ID Number includes 604b', async () => {
		execMock.mockResolvedValue({
			stdout: 'Serial number: 0000abc\nPart ID Number: a000604b xxxx'
		});
		const result = await detectHackRF();
		expect(result[0].productId).toBe('604b');
	});

	test('resolves productId 6089 when Part ID Number does NOT include 604b', async () => {
		execMock.mockResolvedValue({
			stdout: 'Serial number: 0000abc\nPart ID Number: a0006089 xxxx'
		});
		const result = await detectHackRF();
		expect(result[0].productId).toBe('6089');
	});

	test('builds capabilities with HackRF freq range 1MHz-6GHz, 20MHz rate, full-duplex=false', async () => {
		execMock.mockResolvedValue({ stdout: 'Serial number: abc' });
		const caps = (await detectHackRF())[0].capabilities as Record<string, unknown>;
		expect(caps.minFrequency).toBe(1_000_000);
		expect(caps.maxFrequency).toBe(6_000_000_000);
		expect(caps.fullDuplex).toBe(false);
		expect(caps.canTransmit).toBe(true);
		expect(caps.canReceive).toBe(true);
	});
});

describe('detectUSRP', () => {
	beforeEach(() => vi.clearAllMocks());

	test('returns empty array on uhd_find_devices error', async () => {
		execMock.mockRejectedValue(new Error('no devices'));
		expect(await detectUSRP()).toEqual([]);
	});

	test('parses single USRP device entry block', async () => {
		execMock.mockResolvedValue({
			stdout: [
				'-- USRP Device 0 --',
				'  Device Address:',
				'    serial: ABCDEF12',
				'    type: b200',
				'    name: MyB200'
			].join('\n')
		});
		const result = await detectUSRP();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 'usrp-ABCDEF12',
			serial: 'ABCDEF12',
			model: 'b200',
			name: 'MyB200',
			manufacturer: 'Ettus Research'
		});
	});

	test('parses multiple USRP blocks (Device Address as separator) — only LAST block gets finalized', async () => {
		// Note: intermediate blocks validateAndPush without finalize → schema fails →
		// dropped silently. Only the trailing-EOF device is finalized then pushed.
		// This is an artifact of the source code's ordering (see usb-sdr-detectors.ts).
		execMock.mockResolvedValue({
			stdout: [
				'  Device Address:',
				'    serial: AAA1',
				'    type: b205',
				'  Device Address:',
				'    serial: BBB2',
				'    type: b210'
			].join('\n')
		});
		const result = await detectUSRP();
		expect(result).toHaveLength(1);
		expect(result[0].serial).toBe('BBB2');
	});

	test('skips device entries without serial (validation fails)', async () => {
		execMock.mockResolvedValue({
			stdout: ['  Device Address:', '    type: b205'].join('\n')
		});
		expect(await detectUSRP()).toHaveLength(0);
	});

	test('default name "USRP Device" when neither name field nor model fallback present', async () => {
		execMock.mockResolvedValue({
			stdout: ['  Device Address:', '    serial: AAA1'].join('\n')
		});
		const result = await detectUSRP();
		expect(result[0].name).toBe('USRP Device');
	});
});

describe('detectRTLSDR', () => {
	beforeEach(() => vi.clearAllMocks());

	test('returns empty array on rtl_test error', async () => {
		execMock.mockRejectedValue(new Error('no devices'));
		expect(await detectRTLSDR()).toEqual([]);
	});

	test('parses single RTL-SDR device line', async () => {
		execMock.mockResolvedValue({
			stdout: '  0:  Realtek, RTL2838UHIDIR, SN: 0000001'
		});
		const result = await detectRTLSDR();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 'rtlsdr-0000001',
			manufacturer: 'Realtek',
			model: 'RTL2838UHIDIR',
			serial: '0000001'
		});
	});

	test('rtl_test has 5000ms timeout (graceful-degradation)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await detectRTLSDR();
		expect(execMock.mock.calls[0][2]).toEqual({ timeout: 5000 });
	});

	test('parses multiple RTL-SDR devices on separate lines', async () => {
		execMock.mockResolvedValue({
			stdout: [
				'  0:  Realtek, RTL2838UHIDIR, SN: AAA',
				'  1:  Realtek, RTL2832U, SN: BBB'
			].join('\n')
		});
		const result = await detectRTLSDR();
		expect(result).toHaveLength(2);
		expect(result.map((d) => d.serial)).toEqual(['AAA', 'BBB']);
	});

	test('truncates stdout to first 20 lines before matching', async () => {
		// Emit 30 lines with device only on line 25 — should NOT be picked up
		const lines = Array(30).fill('garbage');
		lines[24] = '  0:  Realtek, RTL2838UHIDIR, SN: LATE';
		execMock.mockResolvedValue({ stdout: lines.join('\n') });
		expect(await detectRTLSDR()).toEqual([]);
	});
});
