/**
 * CORS origin allowlist for Argos.
 * In tactical deployment, only the RPi's own interfaces should be allowed.
 *
 * Phase 2.2.2 — replaces all wildcard Access-Control-Allow-Origin headers
 * with an origin-validated allowlist (fail-closed).
 */

import { env } from '$lib/server/env';

const ALLOWED_ORIGINS: string[] = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'http://localhost:3000',
	'http://127.0.0.1:3000'
];

// Allow runtime override via environment variable
if (env.ARGOS_CORS_ORIGINS) {
	ALLOWED_ORIGINS.push(...env.ARGOS_CORS_ORIGINS.split(',').map((s) => s.trim()));
}

/**
 * Get CORS headers for a given request origin.
 * Returns the origin if it's in the allowlist, otherwise omits the header.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
		'Access-Control-Max-Age': '86400'
	};

	if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
		headers['Access-Control-Allow-Origin'] = requestOrigin;
		headers['Vary'] = 'Origin';
	}
	// If origin not in allowlist, DO NOT set Access-Control-Allow-Origin (fail closed)

	return headers;
}

/**
 * Validate the Origin header on a WebSocket upgrade or SSE (EventSource) request.
 *
 * Browsers always send an Origin header on cross-origin WS upgrades and
 * EventSource connections, so a forged cross-site request (CSWSH) carries the
 * attacker's origin and is rejected. Non-browser clients (CLI, native `ws`,
 * server-to-server) send no Origin and are allowed — CSWSH requires a browser.
 */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
	if (!origin) return true;
	return ALLOWED_ORIGINS.includes(origin);
}
