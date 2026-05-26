import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

import { env } from '$lib/server/env';
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
		expect(kismet?.name).toBe('Kismet Server');
		expect(kismet?.port).toBe(2501);
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
		const openwebrx = result.find((r) => r.id === 'openwebrx-server');
		expect(openwebrx?.name).toBe('OpenWebRX Server');
		expect(openwebrx?.port).toBe(8073);
	});

	test('no OpenWebRX when status is not ok', async () => {
		fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
		const result = await detectNetworkDevices();
		expect(result.find((r) => r.id === 'openwebrx-server')).toBeUndefined();
	});
});

describe('detectNetworkDevices — port-fallback edge cases (buildServiceDevice)', () => {
	const originalKismetUrl = env.PUBLIC_KISMET_API_URL;

	beforeEach(() => {
		vi.clearAllMocks();
		execMock.mockRejectedValue(new Error('no uhd'));
		mockFetchFailures();
	});

	afterEach(() => {
		env.PUBLIC_KISMET_API_URL = originalKismetUrl;
	});

	test('parseInt(url.port) for port=0 falls back to defaultPort 2501', async () => {
		// URL with explicit :0 port — parseInt("0") is 0, which is falsy → defaultPort wins
		env.PUBLIC_KISMET_API_URL = 'http://localhost:0';
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('localhost')) {
				return new Response(JSON.stringify({ kismet_version: '2024-02' }), { status: 200 });
			}
			throw new Error('refused');
		});
		const result = await detectNetworkDevices();
		const kismet = result.find((r) => r.id === 'kismet-server');
		expect(kismet?.port).toBe(2501);
	});

	test('parseInt(url.port) for empty port falls back to defaultPort 2501', async () => {
		// URL without explicit port — url.port === "", parseInt("") is NaN → defaultPort wins
		env.PUBLIC_KISMET_API_URL = 'http://localhost';
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes('localhost')) {
				return new Response(JSON.stringify({ kismet_version: '2024-03' }), { status: 200 });
			}
			throw new Error('refused');
		});
		const result = await detectNetworkDevices();
		const kismet = result.find((r) => r.id === 'kismet-server');
		expect(kismet?.port).toBe(2501);
	});
});

describe('detectNetworkDevices — parseNetworkUSRPLineFields malformed addr', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetchFailures();
	});

	test('addr line without IP captures empty/short → zod safeParse rejects', async () => {
		// "addr: " with no numeric IP. /addr:\s*([0-9.]+)/i needs ≥1 char, so addrMatch
		// fails → ipAddress stays undefined → no flush + final ipAddress check skips push.
		// This guards against the bug where matchgroup[1] could become an empty string
		// and silently flow through DetectedHardwareSchema as an invalid hardware row.
		execMock.mockResolvedValue({
			stdout: ['  Device Address:', '    addr: ', '    serial: ABC123', '    type: x'].join('\n')
		});
		const result = await detectNetworkDevices();
		expect(result.filter((r) => r.id?.startsWith('usrp-net-'))).toEqual([]);
	});
});
