/**
 * Unit tests for the WebSocket connection handler.
 *
 * `handleWsConnection` is the entry point on `wss.on('connection', ...)` for
 * raw WS upgrades that bypass the SvelteKit handle hook. It enforces, in order:
 *
 *  1. Per-IP connection rate-limit (CWE-770)
 *  2. Origin allowlist (CWE-1385 CSWSH)
 *  3. Session-token / X-API-Key / cookie auth (OWASP A07:2021)
 *  4. Subscription parsing + WebSocketManager registration
 *
 * Each rejection logs an audit event and closes the socket with the
 * appropriate WS close code. Coverage was previously 0% — all gates here
 * are security-critical, so every reject path needs a distinct test.
 */

import type { IncomingMessage } from 'http';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));

// Mock the auth + audit + cors + rate-limit dependencies. Each test arms the
// mocks to exercise a specific path through `handleWsConnection`.
const validateApiKey = vi.fn();
const validateSessionToken = vi.fn();
const logAuthEvent = vi.fn();
const isAllowedOrigin = vi.fn();
const checkWsConnectionRateLimit = vi.fn();
const addClient = vi.fn();

vi.mock('$lib/server/auth/auth-middleware', () => ({
	validateApiKey: (...args: unknown[]) => validateApiKey(...args),
	validateSessionToken: (...args: unknown[]) => validateSessionToken(...args)
}));

vi.mock('$lib/server/security/auth-audit', () => ({
	logAuthEvent: (...args: unknown[]) => logAuthEvent(...args)
}));

vi.mock('$lib/server/security/cors', () => ({
	isAllowedOrigin: (...args: unknown[]) => isAllowedOrigin(...args)
}));

vi.mock('$lib/server/kismet/web-socket-manager', () => ({
	WebSocketManager: { getInstance: vi.fn(() => ({ addClient })) }
}));

vi.mock('../../src/lib/server/middleware/rate-limit-middleware', () => ({
	checkWsConnectionRateLimit: (...args: unknown[]) => checkWsConnectionRateLimit(...args)
}));

import { handleWsConnection } from '../../src/lib/server/middleware/ws-connection-handler';

interface FakeWs {
	close: ReturnType<typeof vi.fn>;
}

function buildWs(): FakeWs {
	return { close: vi.fn() };
}

function buildHeaders(overrides: {
	origin?: string;
	cookie?: string;
	apiKey?: string;
}): Record<string, string> {
	const h: Record<string, string> = { host: 'localhost' };
	if (overrides.origin !== undefined) h.origin = overrides.origin;
	if (overrides.cookie !== undefined) h.cookie = overrides.cookie;
	if (overrides.apiKey !== undefined) h['x-api-key'] = overrides.apiKey;
	return h;
}

function buildRequest(
	url: string,
	overrides: { origin?: string; cookie?: string; apiKey?: string; ip?: string } = {}
): IncomingMessage {
	return {
		url,
		headers: buildHeaders(overrides),
		socket: { remoteAddress: overrides.ip ?? '10.0.0.5' }
	} as unknown as IncomingMessage;
}

interface FakeWsManager {
	addClient: ReturnType<typeof vi.fn>;
}

function buildWsManager(): FakeWsManager {
	return { addClient };
}

beforeEach(() => {
	validateApiKey.mockReset();
	validateSessionToken.mockReset();
	logAuthEvent.mockReset();
	isAllowedOrigin.mockReset();
	checkWsConnectionRateLimit.mockReset();
	addClient.mockReset();

	// Defaults: rate-limit + origin allow; auth fails (override in happy-path tests).
	checkWsConnectionRateLimit.mockReturnValue(true);
	isAllowedOrigin.mockReturnValue(true);
	validateApiKey.mockReturnValue(false);
	validateSessionToken.mockReturnValue(false);
});

describe('handleWsConnection — pre-auth gate', () => {
	test('rate-limit reject closes with 1013 and audit-logs RATE_LIMIT_EXCEEDED', () => {
		checkWsConnectionRateLimit.mockReturnValue(false);

		const ws = buildWs();
		const req = buildRequest('/api/kismet/ws', { ip: '10.0.0.99' });
		handleWsConnection(ws as never, req, buildWsManager() as never);

		expect(ws.close).toHaveBeenCalledExactlyOnceWith(1013, 'Try again later');
		expect(logAuthEvent).toHaveBeenCalledExactlyOnceWith({
			eventType: 'RATE_LIMIT_EXCEEDED',
			ip: '10.0.0.99',
			method: 'WS',
			path: '/api/kismet/ws',
			reason: 'WebSocket connection rate limit exceeded'
		});
		expect(isAllowedOrigin).not.toHaveBeenCalled();
		expect(addClient).not.toHaveBeenCalled();
	});

	test('origin-allowlist reject closes with 1008 and audit-logs WS_AUTH_FAILURE', () => {
		isAllowedOrigin.mockReturnValue(false);

		const ws = buildWs();
		const req = buildRequest('/api/kismet/ws', { origin: 'http://evil.example' });
		handleWsConnection(ws as never, req, buildWsManager() as never);

		expect(ws.close).toHaveBeenCalledExactlyOnceWith(1008, 'Forbidden origin');
		expect(logAuthEvent).toHaveBeenCalledExactlyOnceWith({
			eventType: 'WS_AUTH_FAILURE',
			ip: '10.0.0.5',
			method: 'WS',
			path: '/api/kismet/ws',
			reason: 'Origin not in allowlist (possible CSWSH)'
		});
		expect(addClient).not.toHaveBeenCalled();
	});

	test('falls back to "unknown" ip when socket.remoteAddress is missing', () => {
		checkWsConnectionRateLimit.mockReturnValue(false);

		const ws = buildWs();
		const req = {
			url: '/api/kismet/ws',
			headers: { host: 'localhost' },
			socket: {}
		} as unknown as IncomingMessage;
		handleWsConnection(ws as never, req, buildWsManager() as never);

		expect(checkWsConnectionRateLimit).toHaveBeenCalledExactlyOnceWith('unknown');
		expect(logAuthEvent).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ ip: 'unknown' })
		);
	});
});

describe('handleWsConnection — authentication', () => {
	test('rejects when no token, no api-key header, no cookie', () => {
		const ws = buildWs();
		handleWsConnection(ws as never, buildRequest('/api/kismet/ws'), buildWsManager() as never);

		expect(ws.close).toHaveBeenCalledExactlyOnceWith(1008, 'Unauthorized');
		expect(logAuthEvent).toHaveBeenCalledExactlyOnceWith({
			eventType: 'WS_AUTH_FAILURE',
			ip: '10.0.0.5',
			method: 'WS',
			path: '/api/kismet/ws',
			reason: 'Invalid or missing API key on WebSocket connection'
		});
		expect(addClient).not.toHaveBeenCalled();
	});

	test('accepts ?token= via validateSessionToken (does NOT call validateApiKey)', () => {
		validateSessionToken.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws?token=session-abc'),
			buildWsManager() as never
		);

		expect(validateSessionToken).toHaveBeenCalledExactlyOnceWith('session-abc');
		expect(validateApiKey).not.toHaveBeenCalled();
		expect(ws.close).not.toHaveBeenCalled();
		expect(addClient).toHaveBeenCalledOnce();
		expect(logAuthEvent).toHaveBeenCalledExactlyOnceWith({
			eventType: 'WS_AUTH_SUCCESS',
			ip: '10.0.0.5',
			method: 'WS',
			path: '/api/kismet/ws'
		});
	});

	test('rejects when ?token= present but validateSessionToken returns false', () => {
		// Token IS present, so X-API-Key/cookie branch must NOT be tried — this
		// kills a mutator that swaps the early `return validateSessionToken(...)`
		// for a fall-through to validateApiKey.
		validateSessionToken.mockReturnValue(false);
		validateApiKey.mockReturnValue(true); // would erroneously succeed if reached

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws?token=stale', { apiKey: 'real-key' }),
			buildWsManager() as never
		);

		expect(validateSessionToken).toHaveBeenCalledExactlyOnceWith('stale');
		expect(validateApiKey).not.toHaveBeenCalled();
		expect(ws.close).toHaveBeenCalledExactlyOnceWith(1008, 'Unauthorized');
	});

	test('falls through to X-API-Key header when no ?token=', () => {
		validateApiKey.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws', { apiKey: 'header-key' }),
			buildWsManager() as never
		);

		expect(validateSessionToken).not.toHaveBeenCalled();
		expect(validateApiKey).toHaveBeenCalledOnce();
		const reqArg = validateApiKey.mock.calls[0][0] as Request;
		expect(reqArg.headers.get('X-API-Key')).toBe('header-key');
		expect(addClient).toHaveBeenCalledOnce();
	});

	test('falls through to cookie when no token and no X-API-Key', () => {
		validateApiKey.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws', { cookie: '__argos_session=abc' }),
			buildWsManager() as never
		);

		const reqArg = validateApiKey.mock.calls[0][0] as Request;
		expect(reqArg.headers.get('cookie')).toBe('__argos_session=abc');
		expect(addClient).toHaveBeenCalledOnce();
	});

	test('fails closed when validateApiKey throws', () => {
		validateApiKey.mockImplementation(() => {
			throw new Error('boom');
		});

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws', { apiKey: 'k' }),
			buildWsManager() as never
		);

		expect(ws.close).toHaveBeenCalledExactlyOnceWith(1008, 'Unauthorized');
		expect(addClient).not.toHaveBeenCalled();
	});
});

describe('handleWsConnection — subscription preferences', () => {
	test('addClient gets parsed types Set and filters from query params', () => {
		validateApiKey.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws?types=wifi,bt&minSignal=-70&deviceTypes=ap,client', {
				apiKey: 'k'
			}),
			buildWsManager() as never
		);

		expect(addClient).toHaveBeenCalledOnce();
		const prefs = addClient.mock.calls[0][1] as {
			types: Set<string>;
			filters: { minSignal: number; deviceTypes: string[] };
		};
		expect(prefs.types).toBeInstanceOf(Set);
		expect([...prefs.types]).toEqual(['wifi', 'bt']);
		expect(prefs.filters.minSignal).toBe(-70);
		expect(prefs.filters.deviceTypes).toEqual(['ap', 'client']);
	});

	test('omits types Set when ?types= absent', () => {
		validateApiKey.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws', { apiKey: 'k' }),
			buildWsManager() as never
		);

		const prefs = addClient.mock.calls[0][1] as {
			types: Set<string> | undefined;
			filters: { minSignal: number | undefined; deviceTypes: string[] | undefined };
		};
		expect(prefs.types).toBeUndefined();
		expect(prefs.filters.minSignal).toBeUndefined();
		expect(prefs.filters.deviceTypes).toBeUndefined();
	});

	test('parses minSignal=0 (not falsy-coerced away)', () => {
		// Kills an EqualityOperator mutant that swaps `v ? parseInt(v) : undefined`
		// to `v == null ? undefined : parseInt(v)` etc — "0" should still parse.
		validateApiKey.mockReturnValue(true);

		const ws = buildWs();
		handleWsConnection(
			ws as never,
			buildRequest('/api/kismet/ws?minSignal=0', { apiKey: 'k' }),
			buildWsManager() as never
		);

		const prefs = addClient.mock.calls[0][1] as {
			filters: { minSignal: number | undefined };
		};
		// Note: source uses `v ? parseInt(v,10) : undefined` — the empty-string
		// "" branch is falsy, so '0' is the only edge that proves we are parsing
		// non-empty strings rather than just length-checking.
		expect(prefs.filters.minSignal).toBe(0);
	});
});
