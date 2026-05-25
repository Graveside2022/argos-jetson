/**
 * CORS header builder for Argos.
 *
 * Origin allowlist logic lives in `./origin-allowlist` — shared with the
 * terminal WS upgrade handler (which can't import `$lib/*` because
 * vite-plugin-terminal evaluates it before the alias exists). This file is
 * a thin presenter that turns the allowlist into HTTP response headers.
 *
 * Phase 2.2.2 — replaces all wildcard Access-Control-Allow-Origin headers
 * with an origin-validated allowlist (fail-closed).
 */

import { getAllowedOrigins, isAllowedOrigin } from './origin-allowlist';

// Re-export for backward compatibility with callers that import from cors.ts.
export { isAllowedOrigin };

/**
 * Get CORS headers for a given request origin.
 * Returns the origin if it's in the allowlist, otherwise omits the header (fail-closed).
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
		'Access-Control-Max-Age': '86400'
	};

	if (requestOrigin && getAllowedOrigins().includes(requestOrigin)) {
		headers['Access-Control-Allow-Origin'] = requestOrigin;
		headers['Vary'] = 'Origin';
	}
	// If origin not in allowlist, DO NOT set Access-Control-Allow-Origin (fail closed)

	return headers;
}
