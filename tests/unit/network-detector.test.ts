/**
 * Unit tests for `network-detector` telemetry hygiene (BUG-1 reproducer).
 *
 * The detector probes Kismet (:2501), OpenWebRX (:8073), and HackRF API
 * (:8092). When those services are down, `fetch()` throws ECONNREFUSED.
 * That's the EXPECTED branch — it's how we detect absence. But OTel's
 * auto-instrumentation tags the fetch's span as errored, which propagates
 * up to the parent trace and makes 100% of argos-v1 hardware-scan traces
 * appear failed in Jaeger.
 *
 * Fix: each probe runs inside an explicit OTel span that calls
 * `span.setStatus({ code: SpanStatusCode.OK })` on both success and caught
 * failure. The auto-instrumented child fetch span may still show error,
 * but our parent span (and any caller's trace) stays clean.
 *
 * These tests assert that the wrapper span is marked OK on:
 *  - successful 2xx + JSON parse (kismet/hackrf)
 *  - successful 2xx + reachable-only probe (openwebrx)
 *  - ECONNREFUSED (network failure — the BUG-1 case)
 *  - non-2xx response (e.g. 503)
 *  - JSON parse failure on a 2xx response
 *
 * No test path should observe `SpanStatusCode.ERROR`.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mocked span captures every setStatus() call so tests can assert no ERROR
// status leaks out of a caught probe failure.
const capturedStatusCalls: { code: SpanStatusCode }[] = [];
const spanEndCalls: number[] = [];

function makeMockSpan() {
	return {
		setStatus: vi.fn((s: { code: SpanStatusCode }) => {
			capturedStatusCalls.push(s);
		}),
		end: vi.fn(() => {
			spanEndCalls.push(Date.now());
		}),
		setAttribute: vi.fn(),
		recordException: vi.fn()
	};
}

vi.mock('@opentelemetry/api', () => {
	const actual = {
		SpanStatusCode: { OK: 1, ERROR: 2, UNSET: 0 }
	};
	return {
		...actual,
		trace: {
			getTracer: () => ({
				startActiveSpan: async <T>(
					_name: string,
					fn: (span: ReturnType<typeof makeMockSpan>) => Promise<T>
				): Promise<T> => {
					const span = makeMockSpan();
					return fn(span);
				}
			})
		}
	};
});

vi.mock('$lib/server/env', () => ({
	env: {
		PUBLIC_KISMET_API_URL: 'http://localhost:2501',
		PUBLIC_HACKRF_API_URL: 'http://localhost:8092',
		OPENWEBRX_URL: 'http://localhost:8073'
	}
}));

vi.mock('$lib/server/exec', () => ({
	// detectNetworkUSRP shells out — stub to "no devices" so it doesn't taint
	// the parent detectNetworkDevices() call.
	execFileAsync: vi.fn(async () => ({ stdout: '', stderr: '' }))
}));

import { detectNetworkDevices } from '../../src/lib/server/hardware/detection/network-detector';

const fetchSpy = vi.fn();
globalThis.fetch = fetchSpy as unknown as typeof fetch;

function makeOkJsonResponse(body: object): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

function makeOkHtmlResponse(): Response {
	return new Response('<html>OpenWebRX</html>', {
		status: 200,
		headers: { 'content-type': 'text/html' }
	});
}

beforeEach(() => {
	capturedStatusCalls.length = 0;
	spanEndCalls.length = 0;
	fetchSpy.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('network-detector — BUG-1: span status on probe failures', () => {
	test('ECONNREFUSED on all 3 probes does NOT mark any span as ERROR', async () => {
		// Reproduces the production scenario: Kismet, OpenWebRX, and HackRF
		// API are all down. fetch() throws ECONNREFUSED. Before the fix, the
		// auto-instrumented HTTP-client spans would propagate ERROR status to
		// the parent trace. After the fix, each probe's wrapper span sets
		// status=OK in the catch branch.
		fetchSpy.mockRejectedValue(
			Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
		);

		const hardware = await detectNetworkDevices();

		// Behavior is preserved: no devices when services are down.
		expect(hardware).toEqual([]);

		// One span per probe (kismet, hackrf, openwebrx). USRP probe goes
		// through execFileAsync (mocked) so no span is created for it.
		expect(spanEndCalls.length).toBe(3);

		// CORE ASSERTION: every recorded status is OK. Zero ERROR statuses.
		expect(capturedStatusCalls.length).toBe(3);
		for (const status of capturedStatusCalls) {
			expect(status.code).toBe(SpanStatusCode.OK);
		}
	});

	test('successful 2xx JSON probe (kismet) marks span OK', async () => {
		fetchSpy.mockImplementation(async (input: string | URL) => {
			const url = input.toString();
			if (url.includes('2501')) return makeOkJsonResponse({ kismet_version: '2024-01-R1' });
			throw new Error('ECONNREFUSED');
		});

		const hardware = await detectNetworkDevices();

		expect(hardware.some((d) => d.id === 'kismet-server')).toBe(true);
		// All probes wrap their span with OK status — success path AND the
		// other two ECONNREFUSED paths.
		expect(capturedStatusCalls.length).toBe(3);
		for (const status of capturedStatusCalls) {
			expect(status.code).toBe(SpanStatusCode.OK);
		}
	});

	test('successful 2xx reachable probe (openwebrx) marks span OK without parsing JSON', async () => {
		fetchSpy.mockImplementation(async (input: string | URL) => {
			const url = input.toString();
			if (url.includes('8073')) return makeOkHtmlResponse();
			throw new Error('ECONNREFUSED');
		});

		const hardware = await detectNetworkDevices();

		// OpenWebRX detection succeeds even though the body is HTML, because
		// the probe is reachable-only (no JSON parsing).
		expect(hardware.some((d) => d.id === 'openwebrx-server')).toBe(true);
		for (const status of capturedStatusCalls) {
			expect(status.code).toBe(SpanStatusCode.OK);
		}
	});

	test('non-2xx response (503) marks span OK, returns no device', async () => {
		fetchSpy.mockResolvedValue(new Response('service unavailable', { status: 503 }));

		const hardware = await detectNetworkDevices();

		expect(hardware).toEqual([]);
		expect(capturedStatusCalls.length).toBe(3);
		for (const status of capturedStatusCalls) {
			expect(status.code).toBe(SpanStatusCode.OK);
		}
	});

	test('JSON parse failure on 2xx kismet/hackrf response marks span OK', async () => {
		// Service returns 200 but with invalid JSON body. probe()'s catch
		// branch must still set status=OK and return null. OpenWebRX uses a
		// reachable-only probe (no JSON parse) so it still succeeds — we only
		// assert kismet + hackrf return no device.
		fetchSpy.mockResolvedValue(
			new Response('not valid json {', {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);

		const hardware = await detectNetworkDevices();

		// Kismet + HackRF probes JSON-parse and fail; OpenWebRX only checks
		// reachability so it's reported present.
		expect(hardware.some((d) => d.id === 'kismet-server')).toBe(false);
		expect(hardware.some((d) => d.id === 'hackrf-server')).toBe(false);
		expect(capturedStatusCalls.length).toBe(3);
		for (const status of capturedStatusCalls) {
			expect(status.code).toBe(SpanStatusCode.OK);
		}
	});

	test('all spans are ended (no leaked open spans)', async () => {
		fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
		await detectNetworkDevices();
		// Every started span must call span.end() — the finally branch
		// guarantees this.
		expect(spanEndCalls.length).toBe(3);
	});
});
