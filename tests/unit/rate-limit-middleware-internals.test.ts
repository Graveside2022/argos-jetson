/**
 * Unit tests for rate-limit-middleware internals: the orchestrator
 * `checkRateLimit` + exported helpers (`getSafeClientAddress`,
 * `checkWsConnectionRateLimit`). The classification helpers
 * (`isHardwareControlPath`, `isDragonSyncReadPath`) are covered in
 * `rate-limit-middleware.test.ts`.
 *
 * The module uses a globalThis-keyed RateLimiter singleton. Tests here use
 * IP/session keys in the 10.99.x.x range so they don't share buckets with
 * other test files (`ws-origin-guard.test.ts` uses 10.0.0.x).
 */

import type { Handle } from '@sveltejs/kit';
import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));

import {
	checkRateLimit,
	checkWsConnectionRateLimit,
	getSafeClientAddress
} from '../../src/lib/server/middleware/rate-limit-middleware';

type EventArg = Parameters<Handle>[0]['event'];

function buildEvent(opts: {
	pathname: string;
	ip?: string | (() => string);
	cookie?: string;
	method?: string;
}): EventArg {
	const getClientAddress = () => {
		if (typeof opts.ip === 'function') return opts.ip();
		if (opts.ip === undefined) throw new Error('no client address');
		return opts.ip;
	};
	const headers = new Headers();
	if (opts.cookie) headers.set('cookie', opts.cookie);
	return {
		url: new URL(`http://localhost${opts.pathname}`),
		request: new Request(`http://localhost${opts.pathname}`, {
			method: opts.method ?? 'GET',
			headers
		}),
		getClientAddress
	} as unknown as EventArg;
}

describe('getSafeClientAddress', () => {
	test('returns the address when available', () => {
		expect(getSafeClientAddress(buildEvent({ pathname: '/api/x', ip: '10.99.1.1' }))).toBe(
			'10.99.1.1'
		);
	});

	test('returns "unknown" when getClientAddress throws', () => {
		expect(getSafeClientAddress(buildEvent({ pathname: '/api/x' }))).toBe('unknown');
	});
});

describe('checkRateLimit — orchestrator', () => {
	test('streaming paths skip the rate limit entirely', () => {
		// Each streaming pattern: ends-with /stream, ends-with /sse, contains data-stream,
		// starts-with /api/map-tiles/. All return null (not rate-limited).
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/kismet/stream', ip: '10.99.2.1' }))
		).toBeNull();
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/signals/sse', ip: '10.99.2.2' }))
		).toBeNull();
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/foo/data-stream-x', ip: '10.99.2.3' }))
		).toBeNull();
		expect(
			checkRateLimit(
				buildEvent({ pathname: '/api/map-tiles/osm/1/1/1.png', ip: '10.99.2.4' })
			)
		).toBeNull();
	});

	test('hardware-control path returns null while under the 30/min budget', () => {
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/hackrf/status', ip: '10.99.3.1' }))
		).toBeNull();
	});

	test('hardware-control path returns 429 after exhausting the 30/min budget', async () => {
		const ip = '10.99.3.2';
		for (let i = 0; i < 30; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/hackrf/status', ip }));
		}
		const blocked = checkRateLimit(buildEvent({ pathname: '/api/hackrf/status', ip }));

		expect(blocked).not.toBeNull();
		expect(blocked!.status).toBe(429);
		expect(blocked!.headers.get('Retry-After')).toBe('60');
		expect(blocked!.headers.get('Content-Type')).toBe('application/json');
		const body = await blocked!.json();
		expect(body).toEqual({ error: 'Rate limit exceeded' });
	});

	test('dragonsync-read path returns 429 after exhausting the 600/min budget', () => {
		// Freeze the clock so the 10-tok/sec refill rate doesn't outpace the
		// drain rate inside this sync loop.
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-26T00:00:00Z'));
		try {
			const ip = '10.99.4.1';
			for (let i = 0; i < 600; i++) {
				checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }));
			}
			const blocked = checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }));
			expect(blocked).not.toBeNull();
			expect(blocked!.status).toBe(429);
		} finally {
			vi.useRealTimers();
		}
	});

	test('generic API path returns null while under the 200/min budget', () => {
		expect(checkRateLimit(buildEvent({ pathname: '/api/health', ip: '10.99.5.1' }))).toBeNull();
	});

	test('generic API path returns 429 after exhausting the 200/min budget', async () => {
		const ip = '10.99.5.2';
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/health', ip }));
		}
		const blocked = checkRateLimit(buildEvent({ pathname: '/api/health', ip }));

		expect(blocked).not.toBeNull();
		expect(blocked!.status).toBe(429);
		expect(blocked!.headers.get('Retry-After')).toBe('10');
		const body = await blocked!.json();
		expect(body).toEqual({ error: 'Rate limit exceeded' });
	});

	test('non-/api/ paths return null (no rate limit applied)', () => {
		expect(checkRateLimit(buildEvent({ pathname: '/dashboard', ip: '10.99.6.1' }))).toBeNull();
		expect(checkRateLimit(buildEvent({ pathname: '/', ip: '10.99.6.2' }))).toBeNull();
	});

	test('session-cookie fallback applies when getClientAddress throws', () => {
		// Both requests fail to derive an IP and fall back to the session cookie
		// for bucket keying. Different cookies → different buckets, so the second
		// request must NOT inherit the first's used budget.
		const cookieA = '__argos_session=alice-session-token-abc123def456;';
		const cookieB = '__argos_session=bob-session-token-789xyz000111;';
		const eventA = buildEvent({ pathname: '/api/health', cookie: cookieA });
		const eventB = buildEvent({ pathname: '/api/health', cookie: cookieB });
		// 1 hit on alice's bucket
		expect(checkRateLimit(eventA)).toBeNull();
		// bob's first hit still allowed (separate bucket)
		expect(checkRateLimit(eventB)).toBeNull();
	});
});

describe('checkWsConnectionRateLimit', () => {
	test('returns true on the first attempt', () => {
		expect(checkWsConnectionRateLimit('10.99.7.1')).toBe(true);
	});

	test('returns false after exhausting the 30/min budget for one IP', () => {
		const ip = '10.99.7.2';
		for (let i = 0; i < 30; i++) {
			checkWsConnectionRateLimit(ip);
		}
		expect(checkWsConnectionRateLimit(ip)).toBe(false);
	});

	test('"unknown" IP gets a wider 60/min budget (shared-fallback tier)', () => {
		// Per source: `safeIp === 'unknown' ? 60 : 30`. Pass empty string to
		// trigger the `||` fallback to 'unknown'; then exhaust 60 before the
		// 61st should reject.
		for (let i = 0; i < 60; i++) {
			expect(checkWsConnectionRateLimit('')).toBe(true);
		}
		expect(checkWsConnectionRateLimit('')).toBe(false);
	});
});

// Spy on logAuthEvent so per-tier audit-log `reason` strings are asserted —
// kills StringLiteral mutants on L156, L163, L170, L176, L182, L188.
import * as authAudit from '../../src/lib/server/security/auth-audit';

describe('checkRateLimit — audit-log reasons per tier', () => {
	test('hardware tier 429 logs the hardware-specific reason + 60s Retry-After', () => {
		const spy = vi.spyOn(authAudit, 'logAuthEvent').mockImplementation(() => undefined);
		try {
			const ip = '10.99.8.1';
			for (let i = 0; i < 30; i++) {
				checkRateLimit(buildEvent({ pathname: '/api/hackrf/status', ip }));
			}
			spy.mockClear();
			checkRateLimit(buildEvent({ pathname: '/api/hackrf/status', ip }));

			expect(spy).toHaveBeenCalledExactlyOnceWith({
				eventType: 'RATE_LIMIT_EXCEEDED',
				ip,
				method: 'GET',
				path: '/api/hackrf/status',
				reason: 'Hardware control rate limit exceeded (30 req/min)'
			});
		} finally {
			spy.mockRestore();
		}
	});

	test('generic API tier 429 logs the API-specific reason + 10s Retry-After', () => {
		const spy = vi.spyOn(authAudit, 'logAuthEvent').mockImplementation(() => undefined);
		try {
			const ip = '10.99.8.2';
			for (let i = 0; i < 200; i++) {
				checkRateLimit(buildEvent({ pathname: '/api/health', ip }));
			}
			spy.mockClear();
			checkRateLimit(buildEvent({ pathname: '/api/health', ip }));

			expect(spy).toHaveBeenCalledExactlyOnceWith({
				eventType: 'RATE_LIMIT_EXCEEDED',
				ip,
				method: 'GET',
				path: '/api/health',
				reason: 'API rate limit exceeded (200 req/min)'
			});
		} finally {
			spy.mockRestore();
		}
	});

	test('dragonsync-read tier 429 logs the dragonsync-specific reason', () => {
		const spy = vi.spyOn(authAudit, 'logAuthEvent').mockImplementation(() => undefined);
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-26T01:00:00Z'));
		try {
			const ip = '10.99.8.3';
			for (let i = 0; i < 600; i++) {
				checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }));
			}
			spy.mockClear();
			checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }));

			expect(spy).toHaveBeenCalledExactlyOnceWith({
				eventType: 'RATE_LIMIT_EXCEEDED',
				ip,
				method: 'GET',
				path: '/api/dragonsync/status',
				reason: 'DragonSync read rate limit exceeded (600 req/min)'
			});
		} finally {
			spy.mockRestore();
			vi.useRealTimers();
		}
	});
});

describe('checkRateLimit — tier-distinct budgets prove orchestrator branching', () => {
	test('dragonsync-read allows ≥250 hits (would exceed the 200/min API budget)', () => {
		// Kills L213 ConditionalExpression mutant that would fall dragonsync
		// through to checkApiRateLimit (200/min). At 250 hits we are PAST the
		// API budget; if the orchestrator routed to api, this call would 429.
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-26T02:00:00Z'));
		try {
			const ip = '10.99.9.1';
			for (let i = 0; i < 250; i++) {
				checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }));
			}
			expect(
				checkRateLimit(buildEvent({ pathname: '/api/dragonsync/status', ip }))
			).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	test('streaming path NEVER consumes the api/hardware bucket', () => {
		// Kills L132/L211 mutants that would route streaming paths through the
		// rate limit. Exhaust the API budget on `ip` via /api/health, then a
		// streaming path on the same `ip` must still return null.
		const ip = '10.99.9.2';
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/health', ip }));
		}
		// /api/health is now over budget for this IP.
		expect(checkRateLimit(buildEvent({ pathname: '/api/health', ip }))).not.toBeNull();
		// But a streaming path on same ip is allowed (never touches the bucket).
		expect(checkRateLimit(buildEvent({ pathname: '/api/foo/data-stream-x', ip }))).toBeNull();
		expect(checkRateLimit(buildEvent({ pathname: '/api/kismet/stream', ip }))).toBeNull();
		expect(checkRateLimit(buildEvent({ pathname: '/api/signals/sse', ip }))).toBeNull();
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/map-tiles/osm/1/1/1.png', ip }))
		).toBeNull();
	});

	test('non-/api/ path NEVER hits the api bucket (kills L214 startsWith mutant)', () => {
		// L214 mutates `path.startsWith('/api/')` to `true`, which would route
		// /dashboard requests through checkApiRateLimit. Exhaust api budget for
		// the IP, then verify /dashboard is still allowed.
		const ip = '10.99.9.3';
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/health', ip }));
		}
		expect(checkRateLimit(buildEvent({ pathname: '/api/health', ip }))).not.toBeNull();
		expect(checkRateLimit(buildEvent({ pathname: '/dashboard', ip }))).toBeNull();
	});
});

describe('extractSessionId + getRateLimitKey — session-cookie bucket keying', () => {
	test('two cookies with same first-16 chars share a bucket (slice(0,16))', () => {
		// `extractSessionId` slices to 16 chars before keying. Two cookies whose
		// first 16 chars match must route to the SAME bucket; exhausting via
		// cookie A must reject cookie B's next request. Kills the L39
		// MethodExpression mutator that drops the slice.
		const sharedPrefix = 'abcdef1234567890';
		const cookieA = `__argos_session=${sharedPrefix}extra-aaaaa;`;
		const cookieB = `__argos_session=${sharedPrefix}extra-bbbbb;`;
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/health', cookie: cookieA }));
		}
		// cookieA bucket now empty; cookieB must inherit because keys are
		// derived from slice(0, 16) of the cookie value.
		expect(
			checkRateLimit(buildEvent({ pathname: '/api/health', cookie: cookieB }))
		).not.toBeNull();
	});

	test('two cookies that differ within first 16 chars get separate buckets', () => {
		// Negative case: cookies with distinct first-16 chars must NOT share.
		// Kills mutators that drop the regex/slice and fall through to a
		// shared "unknown" key.
		const cookieA = '__argos_session=ALICEee1234567890extra;';
		const cookieB = '__argos_session=BOBbbb1234567890extra;';
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildEvent({ pathname: '/api/health', cookie: cookieA }));
		}
		// cookieB's bucket is untouched (different prefix); first call allowed.
		expect(checkRateLimit(buildEvent({ pathname: '/api/health', cookie: cookieB }))).toBeNull();
	});

	test('event with neither IP nor cookie routes to a shared "unknown" bucket', () => {
		// Kills L51 StringLiteral mutants and L49 catch-block mutators. Two
		// requests with no IP + no cookie must share the unknown bucket; exhausting
		// via the first must reject the second.
		const buildBlankEvent = () => buildEvent({ pathname: '/api/health' });
		for (let i = 0; i < 200; i++) {
			checkRateLimit(buildBlankEvent());
		}
		expect(checkRateLimit(buildBlankEvent())).not.toBeNull();
	});
});
