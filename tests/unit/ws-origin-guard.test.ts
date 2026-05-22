/**
 * Unit tests for the WebSocket/SSE hardening helpers added in the v1 audit
 * remediation (findings A1/A2/A9/A-X1):
 *
 *  - `isAllowedOrigin()` — CSWSH defense. Browsers always send Origin on a
 *    cross-origin WS upgrade / EventSource, so a forged cross-site connection
 *    is rejected; non-browser clients (no Origin) are allowed.
 *  - `checkWsConnectionRateLimit()` — per-IP throttle for raw WS upgrades,
 *    which bypass the SvelteKit handle hook (and thus checkRateLimit).
 */

import { describe, expect, test } from 'vitest';

import { checkWsConnectionRateLimit } from '../../src/lib/server/middleware/rate-limit-middleware';
import { isAllowedOrigin } from '../../src/lib/server/security/cors';

describe('isAllowedOrigin', () => {
	test('allows the dev/default allowlisted origins', () => {
		expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
		expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
	});

	test('rejects an unlisted cross-site origin (CSWSH)', () => {
		expect(isAllowedOrigin('http://evil.example.com')).toBe(false);
		expect(isAllowedOrigin('https://attacker.test')).toBe(false);
	});

	test('allows requests with no Origin (non-browser clients)', () => {
		expect(isAllowedOrigin(undefined)).toBe(true);
		expect(isAllowedOrigin(null)).toBe(true);
		expect(isAllowedOrigin('')).toBe(true);
	});
});

describe('checkWsConnectionRateLimit', () => {
	test('allows the first connection attempt from an IP', () => {
		expect(checkWsConnectionRateLimit('10.0.0.1')).toBe(true);
	});

	test('throttles after the 30/min budget is exhausted for one IP', () => {
		const ip = '10.0.0.2';
		// 30-token bucket starts full; 30 immediate attempts drain it.
		for (let i = 0; i < 30; i++) {
			expect(checkWsConnectionRateLimit(ip)).toBe(true);
		}
		// 31st attempt within the same window is rejected.
		expect(checkWsConnectionRateLimit(ip)).toBe(false);
	});

	test('keeps a separate bucket per IP', () => {
		const flooded = '10.0.0.3';
		for (let i = 0; i < 31; i++) checkWsConnectionRateLimit(flooded);
		expect(checkWsConnectionRateLimit(flooded)).toBe(false);
		// A different IP is unaffected.
		expect(checkWsConnectionRateLimit('10.0.0.4')).toBe(true);
	});
});
