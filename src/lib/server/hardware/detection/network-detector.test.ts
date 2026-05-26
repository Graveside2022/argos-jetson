import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/exec', () => ({
	execFileAsync: vi.fn()
}));

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('$lib/server/env', () => ({
	env: {
		PUBLIC_KISMET_API_URL: 'http://localhost:2501',
		PUBLIC_HACKRF_API_URL: 'http://localhost:8092',
		OPENWEBRX_URL: 'http://localhost:8073'
	}
}));

import { execFileAsync } from '$lib/server/exec';

import { detectNetworkDevices } from './network-detector';

const execMock = execFileAsync as unknown as ReturnType<typeof vi.fn>;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function mockFetchFailures(): void {
	fetchMock.mockRejectedValue(new Error('connection refused'));
}

describe('detectNetworkDevices — orchestration', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		execMock.mockRejectedValue(new Error('no uhd'));
		mockFetchFailures();
	});

	test('returns empty when all detectors fail', async () => {
		expect(await detectNetworkDevices()).toEqual([]);
	});

	test('one failing detector does not abort others', async () => {
		execMock.mockRejectedValue(new Error('no uhd'));
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('2501')) {
				return new Response(JSON.stringify({ kismet_version: '2023-07' }), { status: 200 });
			}
			return Promise.reject(new Error('refused'));
		});
		const result = await detectNetworkDevices();
		const kismet = result.find((r) => r.id === 'kismet-server');
		expect(kismet).toBeDefined();
	});
});

describe('detectNetworkDevices — Kismet server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		execMock.mockRejectedValue(new Error('no uhd'));
		mockFetchFailures();
	});

	test('detects kismet on successful response', async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('2501')) {
				return new Response(JSON.stringify({ kismet_version: '2024-01' }), { status: 200 });
			}
			throw new Error('refused');
		});
		const result = await detectNetworkDevices();
		const kismet = result.find((r) => r.id === 'kismet-server');
		expect(kismet?.name).toBe('Kismet Server');
		expect((kismet?.capabilities as Record<string, unknown>).version).toBe('2024-01');
	});

	test('returns no kismet when response.ok is false', async () => {
		fetchMock.mockImplementation(async () => new Response('error', { status: 500 }));
		const result = await detectNetworkDevices();
		expect(result.find((r) => r.id === 'kismet-server')).toBeUndefined();
	});

	test('uses AbortSignal.timeout(2000) on every fetch', async () => {
		fetchMock.mockImplementation(async () => new Response('', { status: 200 }));
		await detectNetworkDevices();
		expect(fetchMock).toHaveBeenCalled();
		// Each call has an options object with signal
		for (const call of fetchMock.mock.calls) {
			expect(call[1]).toHaveProperty('signal');
		}
	});

	test('defaults version to "unknown" when kismet_version absent', async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('2501')) return new Response(JSON.stringify({}), { status: 200 });
			throw new Error('refused');
		});
		const result = await detectNetworkDevices();
		const kismet = result.find((r) => r.id === 'kismet-server');
		expect((kismet?.capabilities as Record<string, unknown>).version).toBe('unknown');
	});
});

describe('detectNetworkDevices — network USRP', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetchFailures();
	});

	test('returns empty when uhd_find_devices errors', async () => {
		execMock.mockRejectedValue(new Error('no devices'));
		const result = await detectNetworkDevices();
		expect(result.filter((r) => r.id?.startsWith('usrp-net-'))).toEqual([]);
	});

	test('parses network USRP block ending with last-device finalize', async () => {
		execMock.mockResolvedValue({
			stdout: [
				'  Device Address:',
				'    addr: 192.168.1.50',
				'    serial: BADC0FFEE',
				'    type: n310'
			].join('\n')
		});
		const result = await detectNetworkDevices();
		const usrp = result.find((r) => r.id?.startsWith('usrp-net-'));
		expect(usrp?.ipAddress).toBe('192.168.1.50');
		expect(usrp?.serial).toBe('BADC0FFEE');
		expect(usrp?.model).toBe('n310');
		expect(usrp?.id).toBe('usrp-net-192-168-1-50');
	});

	test('uhd_find_devices called with timeout 5000 (graceful-degradation)', async () => {
		execMock.mockResolvedValue({ stdout: '' });
		await detectNetworkDevices();
		expect(execMock).toHaveBeenCalledWith(
			'/usr/bin/uhd_find_devices',
			['--args=type=usrp'],
			expect.objectContaining({ timeout: 5000 })
		);
	});
});

describe('detectNetworkDevices — OpenWebRX', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		execMock.mockRejectedValue(new Error('no uhd'));
		mockFetchFailures();
	});

	test('detects OpenWebRX on successful response', async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('8073')) return new Response('', { status: 200 });
			throw new Error('refused');
		});
		const result = await detectNetworkDevices();
		expect(result.find((r) => r.id === 'openwebrx-server')).toBeDefined();
	});

	test('no OpenWebRX when status is not ok', async () => {
		fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
		const result = await detectNetworkDevices();
		expect(result.find((r) => r.id === 'openwebrx-server')).toBeUndefined();
	});
});
