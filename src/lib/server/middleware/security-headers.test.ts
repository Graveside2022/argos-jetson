/**
 * Unit tests for security-headers middleware.
 *
 * Pins the IBM Carbon CDN allowlist landed in PR #156 — without these
 * exact hosts in font-src + style-src, the dashboard floods the console
 * with ~250 CSP violations the moment Carbon's Plex fonts try to load.
 *
 * Phase 3 additive pass: extended to cover every CSP directive + every
 * additional header + the dev-mode cache-busting branch (mutation baseline
 * showed 24 survivors on L29-L63 because the original suite asserted only
 * a subset).
 */

import { describe, expect, it, vi } from 'vitest';

// `vi.doMock` lets each describe block re-mock $app/environment with a
// different `dev` value. Bare `vi.mock` is hoisted globally and can't be
// swapped per test.
vi.mock('$app/environment', () => ({ dev: false }));

import { applySecurityHeaders } from './security-headers';

function cspOf(pathWithQuery?: string): string {
	const res = new Response();
	applySecurityHeaders(res, pathWithQuery);
	return res.headers.get('Content-Security-Policy') ?? '';
}

function headersOf(pathWithQuery?: string): Headers {
	const res = new Response();
	applySecurityHeaders(res, pathWithQuery);
	return res.headers;
}

describe('applySecurityHeaders — CSP directives', () => {
	it('sets default-src self', () => {
		expect(cspOf()).toContain("default-src 'self'");
	});

	it('sets script-src self + unsafe-inline (SvelteKit hydration bootstrap)', () => {
		expect(cspOf()).toContain("script-src 'self' 'unsafe-inline'");
	});

	it('allows IBM Carbon CDN + Google Fonts on style-src', () => {
		expect(cspOf()).toContain(
			"style-src 'self' 'unsafe-inline' https://1.www.s81c.com https://fonts.googleapis.com"
		);
	});

	it('sets style-src-elem explicitly (browsers do not fall back to style-src)', () => {
		expect(cspOf()).toContain(
			"style-src-elem 'self' 'unsafe-inline' https://1.www.s81c.com https://fonts.googleapis.com"
		);
	});

	it('allows OSM + Google + ArcGIS tile servers on img-src', () => {
		const csp = cspOf();
		expect(csp).toContain('https://*.tile.openstreetmap.org');
		expect(csp).toContain('https://mt0.google.com');
		expect(csp).toContain('https://server.arcgisonline.com');
		expect(csp).toContain("img-src 'self' data: blob:");
	});

	it('allows Sentry ingest + general sentry.io hosts on connect-src', () => {
		const csp = cspOf();
		expect(csp).toContain('https://*.ingest.us.sentry.io');
		expect(csp).toContain('https://*.sentry.io');
	});

	it('allows ws: + wss: + localhost service ports on connect-src', () => {
		const csp = cspOf();
		expect(csp).toContain('ws:');
		expect(csp).toContain('wss:');
		expect(csp).toContain('http://localhost:8085');
		expect(csp).toContain('http://localhost:8081');
	});

	it('sets worker-src self + blob (required for MapLibre GL JS Web Workers)', () => {
		expect(cspOf()).toContain("worker-src 'self' blob:");
	});

	it('sets child-src self + blob:', () => {
		expect(cspOf()).toContain("child-src 'self' blob:");
	});

	it('allows IBM Carbon CDN + gstatic fonts on font-src', () => {
		expect(cspOf()).toContain(
			"font-src 'self' https://1.www.s81c.com https://fonts.gstatic.com data:"
		);
	});

	it('frame-src allows http/https + service ports (GNU Radio, OpenWebRX, etc)', () => {
		const csp = cspOf();
		expect(csp).toContain('http://*:2501'); // OpenWebRX
		expect(csp).toContain('http://*:8073'); // OpenWebRX RX side
		expect(csp).toContain('https://*:8443'); // alt-TLS
	});

	it('frame-ancestors self (clickjack defense)', () => {
		expect(cspOf()).toContain("frame-ancestors 'self'");
	});

	it('base-uri self', () => {
		expect(cspOf()).toContain("base-uri 'self'");
	});

	it('form-action self (no permissive http: / https:)', () => {
		const csp = cspOf();
		expect(csp).toContain("form-action 'self'");
		// Sanity: confirm the deliberately-removed permissive bare http: / https:
		// has not re-appeared on form-action.
		expect(csp).not.toMatch(/form-action[^;]*\bhttp:/);
		expect(csp).not.toMatch(/form-action[^;]*\bhttps:/);
	});
});

describe('applySecurityHeaders — object-src branch', () => {
	it('keeps object-src none for non-PDF routes', () => {
		expect(cspOf()).toContain("object-src 'none'");
		expect(cspOf('/dashboard')).toContain("object-src 'none'");
		expect(cspOf('/api/reports/abc/list')).toContain("object-src 'none'");
	});

	it("relaxes object-src to 'self' for PDF embed routes", () => {
		expect(cspOf('/api/reports/abc/view')).toContain("object-src 'self'");
		expect(cspOf('/api/reports/abc/view?download=1')).toContain("object-src 'self'");
	});

	it('PDF regex requires the exact /view suffix (not /viewer)', () => {
		// Defends against a regex-broadening mutator that would also match
		// `/api/reports/abc/viewer` (a sibling endpoint that should NOT relax
		// object-src). PR #156 acceptance criterion.
		expect(cspOf('/api/reports/abc/viewer')).toContain("object-src 'none'");
	});
});

describe('applySecurityHeaders — additional headers', () => {
	it('sets X-Content-Type-Options: nosniff', () => {
		expect(headersOf().get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('sets X-Frame-Options: SAMEORIGIN', () => {
		expect(headersOf().get('X-Frame-Options')).toBe('SAMEORIGIN');
	});

	it('sets X-XSS-Protection: 0 (OWASP-recommended; legacy header disabled)', () => {
		expect(headersOf().get('X-XSS-Protection')).toBe('0');
	});

	it('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
		expect(headersOf().get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
	});

	it('sets Permissions-Policy with geo=self + mic/cam/payment/usb=()', () => {
		const pp = headersOf().get('Permissions-Policy');
		expect(pp).toBe('geolocation=(self), microphone=(), camera=(), payment=(), usb=()');
	});
});

describe('applySecurityHeaders — production-mode (dev=false) does NOT set cache-busting headers', () => {
	it('omits Cache-Control / Pragma / Expires in production', () => {
		const h = headersOf();
		expect(h.get('Cache-Control')).toBeNull();
		expect(h.get('Pragma')).toBeNull();
		expect(h.get('Expires')).toBeNull();
	});
});

describe('applySecurityHeaders — dev-mode (dev=true) sets cache-busting headers', () => {
	it('sets no-cache headers when $app/environment.dev is true', async () => {
		// Use vi.doMock + dynamic import to swap the dev flag without affecting
		// the module-level vi.mock at the top of the file.
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ dev: true }));
		const mod = await import('./security-headers');
		const res = new Response();
		mod.applySecurityHeaders(res);

		expect(res.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
		expect(res.headers.get('Pragma')).toBe('no-cache');
		expect(res.headers.get('Expires')).toBe('0');
		vi.doUnmock('$app/environment');
		vi.resetModules();
	});
});
