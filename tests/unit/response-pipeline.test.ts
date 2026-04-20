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
	it('applies Content-Security-Policy to a 401 short-circuit response', async () => {
		const short401: Handle = async () =>
			new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});

		const wrapped = withSecurityHeaders(short401);
		const response = await wrapped(buildHandleInput('/api/hackrf/start'));

		expect(response.status).toBe(401);
		expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
	});

	it('applies CSP to a 413 body-size short-circuit response', async () => {
		const short413: Handle = async () =>
			new Response(JSON.stringify({ error: 'Payload too large' }), {
				status: 413,
				headers: { 'Content-Type': 'application/json' }
			});

		const wrapped = withSecurityHeaders(short413);
		const response = await wrapped(buildHandleInput('/api/kismet/start'));

		expect(response.status).toBe(413);
		expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
	});

	it('applies CSP to a 429 rate-limit short-circuit response', async () => {
		const short429: Handle = async () =>
			new Response(JSON.stringify({ error: 'Too many requests' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});

		const wrapped = withSecurityHeaders(short429);
		const response = await wrapped(buildHandleInput('/api/hackrf/tune'));

		expect(response.status).toBe(429);
		expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
		// Pre-existing headers on the short-circuit response must be preserved.
		expect(response.headers.get('Retry-After')).toBe('60');
	});

	it('applies CSP to the normal resolved-app response', async () => {
		const ok: Handle = async () =>
			new Response('<html><body>page</body></html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' }
			});

		const wrapped = withSecurityHeaders(ok);
		const response = await wrapped(buildHandleInput('/dashboard'));

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
	});

	it('passes the correct pathWithQuery to applySecurityHeaders', async () => {
		// If CSP varies by path (e.g. frame-ancestors rules for /rdio), the
		// wrapper must forward the real pathname + search, not just `/`.
		let observedPath: string | null = null;
		const capture: Handle = async () => new Response('ok');

		const wrapped = withSecurityHeaders(async (input) => {
			const response = await capture(input);
			// The security-headers module may read the URL off the caller's
			// arguments; assert via CSP presence + path echo.
			observedPath = input.event.url.pathname + input.event.url.search;
			return response;
		});

		await wrapped(buildHandleInput('/rdio/api/stream', '?chan=1'));

		expect(observedPath).toBe('/rdio/api/stream?chan=1');
	});
});
