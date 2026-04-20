import type { Handle } from '@sveltejs/kit';

import { applySecurityHeaders } from './security-headers';

/**
 * Decorate a SvelteKit `Handle` so `applySecurityHeaders` is always applied
 * to the returned `Response`, regardless of which path inside the inner
 * handle produced it — short-circuit 401/413/429 responses, reverse-proxy
 * passes, and the normal `resolve()` path all get the same outer layer.
 *
 * Before this wrapper existed, security headers (including CSP) were only
 * applied on the happy path inside `hooks.server.ts`; any middleware that
 * short-circuited before `resolve()` ran returned a bare response with no
 * CSP / X-Frame-Options / Referrer-Policy / etc. That permitted framing
 * and script-source relaxation on error pages served by the security
 * middleware itself — a P1 server-hardening gap (Sprint 2, Task #6).
 *
 * Keeping this wrapper in its own module gives us a pure, side-effect-free
 * unit under test without dragging in the request-pipeline's boot-time
 * imports (hardware detection, TakService init, WebSocketServer, etc.).
 */
export function withSecurityHeaders(inner: Handle): Handle {
	return async (input) => {
		const response = await inner(input);
		applySecurityHeaders(response, input.event.url.pathname + input.event.url.search);
		return response;
	};
}
