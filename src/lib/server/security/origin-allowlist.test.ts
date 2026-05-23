/**
 * Tests for the shared HTTP Origin allowlist.
 *
 * Covers the contract that BOTH `cors.ts` and `terminal/handler.ts` rely on:
 *   - Missing Origin → allow (non-browser caller)
 *   - Localhost defaults always present
 *   - ARGOS_CORS_ORIGINS additions parsed correctly
 *   - Unknown Origin → reject (CWE-1385 CSWSH)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAllowedOrigins, isAllowedOrigin } from './origin-allowlist';

describe('origin-allowlist', () => {
	const originalEnv = process.env.ARGOS_CORS_ORIGINS;

	beforeEach(() => {
		delete process.env.ARGOS_CORS_ORIGINS;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.ARGOS_CORS_ORIGINS;
		} else {
			process.env.ARGOS_CORS_ORIGINS = originalEnv;
		}
	});

	describe('isAllowedOrigin — non-browser path', () => {
		it('allows missing Origin (null) — non-browser clients', () => {
			expect(isAllowedOrigin(null)).toBe(true);
		});

		it('allows missing Origin (undefined) — non-browser clients', () => {
			expect(isAllowedOrigin(undefined)).toBe(true);
		});

		it('allows missing Origin (empty string) — non-browser clients', () => {
			expect(isAllowedOrigin('')).toBe(true);
		});
	});

	describe('isAllowedOrigin — localhost defaults', () => {
		it.each([
			'http://localhost:5173',
			'http://127.0.0.1:5173',
			'http://localhost:3000',
			'http://127.0.0.1:3000'
		])('allows %s by default', (origin) => {
			expect(isAllowedOrigin(origin)).toBe(true);
		});
	});

	describe('isAllowedOrigin — rejects unknown', () => {
		it.each([
			'http://evil.example.com',
			'https://evil.example.com',
			'http://100.119.153.120:5173', // Tailscale IP without env override
			'http://10.0.0.1:5173', // WireGuard IP without env override
			'http://localhost:9999' // Wrong port
		])('rejects %s without env override', (origin) => {
			expect(isAllowedOrigin(origin)).toBe(false);
		});
	});

	describe('ARGOS_CORS_ORIGINS env var', () => {
		it('adds a single Tailscale origin', () => {
			process.env.ARGOS_CORS_ORIGINS = 'http://100.119.153.120:5173';
			expect(isAllowedOrigin('http://100.119.153.120:5173')).toBe(true);
		});

		it('adds multiple comma-separated origins', () => {
			process.env.ARGOS_CORS_ORIGINS =
				'http://100.119.153.120:5173,http://10.0.0.1:5173,http://192.168.1.10:5173';
			expect(isAllowedOrigin('http://100.119.153.120:5173')).toBe(true);
			expect(isAllowedOrigin('http://10.0.0.1:5173')).toBe(true);
			expect(isAllowedOrigin('http://192.168.1.10:5173')).toBe(true);
		});

		it('trims whitespace around entries', () => {
			process.env.ARGOS_CORS_ORIGINS = ' http://100.x.y.z:5173 , http://10.0.0.1:5173 ';
			expect(isAllowedOrigin('http://100.x.y.z:5173')).toBe(true);
			expect(isAllowedOrigin('http://10.0.0.1:5173')).toBe(true);
		});

		it('drops empty entries from trailing commas', () => {
			process.env.ARGOS_CORS_ORIGINS = 'http://100.x.y.z:5173,,,';
			expect(getAllowedOrigins()).toContain('http://100.x.y.z:5173');
			expect(getAllowedOrigins()).not.toContain('');
		});

		it('still rejects unknown origins when env-extended', () => {
			process.env.ARGOS_CORS_ORIGINS = 'http://100.119.153.120:5173';
			expect(isAllowedOrigin('http://evil.example.com')).toBe(false);
		});
	});

	describe('getAllowedOrigins — composition', () => {
		it('returns the 4 localhost defaults when env is unset', () => {
			const list = getAllowedOrigins();
			expect(list).toHaveLength(4);
			expect(list).toContain('http://localhost:5173');
			expect(list).toContain('http://127.0.0.1:5173');
		});

		it('appends env-var entries after the defaults', () => {
			process.env.ARGOS_CORS_ORIGINS = 'http://a.b.c.d:5173';
			const list = getAllowedOrigins();
			expect(list).toHaveLength(5);
			expect(list[4]).toBe('http://a.b.c.d:5173');
		});
	});
});
