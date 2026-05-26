import type { Handle } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

// `applySecurityHeaders` → `$app/environment` (SvelteKit virtual). In the
// vitest sandbox that module is not resolvable, so stub it before the import
// chain loads. Production code is unaffected.
vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));

import { withSecurityHeaders } from '../../src/lib/server/middleware/response-pipeline';

/**
 * Minimal RequestEvent stub — `withSecurityHeaders` only reads
 * `event.url.pathname` and `event.url.search`, so the rest can be ignored.
 * `resolve` is never invoked by the wrapper itself (the inner handle decides
 * whether to call it), so a never-returning stub is safe.
 */
function buildHandleInput(pathname: string, search = ''): Parameters<Handle>[0] {
	return {
		event: {
			url: new URL(`http://localhost${pathname}${search}`)
		},
		resolve: vi.fn()
	} as unknown as Parameters<Handle>[0];
}

describe('withSecurityHeaders', () => {
	it('applies CSP to a short-circuit response and preserves pre-existing headers', async () => {
		// One representative test covers the wrapper's only behavior: pass-through
		// the inner Response while adding security headers. The wrapper does not
		// branch on status, so additional per-status tests (401/413/200/etc.)
		// would kill the same mutants — deleted as sprawl per Phase 3 audit.
		const short429: Handle = async () =>
			new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});

		const wrapped = withSecurityHeaders(short429);
		const response = await wrapped(buildHandleInput('/api/hackrf/tune'));

		expect(response.status).toBe(429);
		expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
		expect(response.headers.get('Retry-After')).toBe('60');
	});

	it('forwards pathname to applySecurityHeaders so path-dependent CSP works', async () => {
		// Black-box test that exercises the wrapper's ACTUAL call to
		// applySecurityHeaders. PDF embed routes (/api/reports/<id>/view) get
		// `object-src 'self'`; every other path gets `object-src 'none'`.
		// If the wrapper mishandles the path (mutator turns `pathname + search`
		// into anything that fails the PDF regex), object-src stays 'none'.
		const wrapped = withSecurityHeaders(async () => new Response('pdf'));
		const response = await wrapped(buildHandleInput('/api/reports/abc/view'));

		// Path forwarded correctly → PDF-embed branch → object-src 'self'.
		expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'self'");
	});
});
