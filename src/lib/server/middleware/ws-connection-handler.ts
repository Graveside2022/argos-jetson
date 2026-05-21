/**
 * WebSocket connection handler for Kismet
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 * Handles WS authentication and client registration on the noServer WSS.
 */

import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

import { validateApiKey, validateSessionToken } from '$lib/server/auth/auth-middleware';
import { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import { logAuthEvent } from '$lib/server/security/auth-audit';
import { isAllowedOrigin } from '$lib/server/security/cors';

import { checkWsConnectionRateLimit } from './rate-limit-middleware';

/**
 * Authenticate a WebSocket connection via session token, header, or cookie.
 *
 * The ?token= param accepts the HMAC-derived session token (NOT the raw API key)
 * to prevent key exposure in URLs/logs per OWASP A07:2021.
 */
// fallow-ignore-next-line complexity
function tryAuthenticate(url: URL, request: IncomingMessage): boolean {
	try {
		// 1. Check ?token= as session token (non-browser clients)
		const wsToken = url.searchParams.get('token');
		if (wsToken) return validateSessionToken(wsToken);

		// 2. Check X-API-Key header or cookie via standard validateApiKey
		const mockHeaders: Record<string, string> = {};
		const apiKey = request.headers['x-api-key'] as string;
		if (apiKey) mockHeaders['X-API-Key'] = apiKey;
		const cookieHeader = request.headers.cookie;
		if (cookieHeader) mockHeaders['cookie'] = cookieHeader;
		return validateApiKey(new Request('http://localhost', { headers: mockHeaders }));
	} catch {
		return false; // fail closed
	}
}

/** Split a comma-separated query param into a string array, or undefined. */
function splitParam(url: URL, name: string): string[] | undefined {
	return url.searchParams.get(name)?.split(',') ?? undefined;
}

/** Parse an optional integer query param. */
function intParam(url: URL, name: string): number | undefined {
	const v = url.searchParams.get(name);
	return v ? parseInt(v, 10) : undefined;
}

/** Parse subscription preferences from URL query params. */
function parseSubscriptionPreferences(url: URL) {
	const types = splitParam(url, 'types');
	return {
		types: types ? new Set(types) : undefined,
		filters: {
			minSignal: intParam(url, 'minSignal'),
			deviceTypes: splitParam(url, 'deviceTypes')
		}
	};
}

/** Derive the request URL and client IP for a raw WS upgrade. */
function wsRequestContext(request: IncomingMessage): { url: URL; ip: string } {
	return {
		url: new URL(request.url || '', `http://${request.headers.host || 'localhost'}`),
		ip: request.socket.remoteAddress || 'unknown'
	};
}

/**
 * Pre-auth gate for a raw WS upgrade: rate-limit by IP, then Origin allowlist.
 * Closes the socket and audit-logs on rejection. Returns true if it may proceed.
 *
 * CWE-1385: SvelteKit's csrf.checkOrigin does not cover raw `ws`, so a
 * cookie-authenticated browser at another origin could otherwise open this
 * socket (CSWSH).
 */
function passWsPreAuthGate(ws: WebSocket, request: IncomingMessage, url: URL, ip: string): boolean {
	if (!checkWsConnectionRateLimit(ip)) {
		logAuthEvent({
			eventType: 'RATE_LIMIT_EXCEEDED',
			ip,
			method: 'WS',
			path: url.pathname,
			reason: 'WebSocket connection rate limit exceeded'
		});
		ws.close(1013, 'Try again later'); // 1013 = Try Again Later
		return false;
	}
	if (!isAllowedOrigin(request.headers.origin)) {
		logAuthEvent({
			eventType: 'WS_AUTH_FAILURE',
			ip,
			method: 'WS',
			path: url.pathname,
			reason: 'Origin not in allowlist (possible CSWSH)'
		});
		ws.close(1008, 'Forbidden origin'); // 1008 = Policy Violation
		return false;
	}
	return true;
}

/**
 * Handle a new WebSocket connection: authenticate, log audit events,
 * parse subscription preferences, and register with WebSocketManager.
 *
 * Phase 2.1.6: authentication enforced here because noServer mode does not
 * support the verifyClient callback.
 */
// fallow-ignore-next-line complexity
export function handleWsConnection(
	ws: WebSocket,
	request: IncomingMessage,
	wsManager: WebSocketManager
): void {
	const { url, ip } = wsRequestContext(request);

	// Pre-auth gate: per-IP connection rate-limit + Origin allowlist. Both run
	// before tryAuthenticate because raw `ws` upgrades bypass the SvelteKit
	// handle hook (no checkRateLimit, no csrf.checkOrigin).
	if (!passWsPreAuthGate(ws, request, url, ip)) return;

	if (!tryAuthenticate(url, request)) {
		logAuthEvent({
			eventType: 'WS_AUTH_FAILURE',
			ip,
			method: 'WS',
			path: url.pathname,
			reason: 'Invalid or missing API key on WebSocket connection'
		});
		ws.close(1008, 'Unauthorized'); // 1008 = Policy Violation
		return;
	}

	logAuthEvent({ eventType: 'WS_AUTH_SUCCESS', ip, method: 'WS', path: url.pathname });
	wsManager.addClient(ws, parseSubscriptionPreferences(url));
}
