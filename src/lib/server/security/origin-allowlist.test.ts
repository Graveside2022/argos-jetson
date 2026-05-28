/**
 * Tests for the shared HTTP Origin allowlist.
 *
 * Covers the contract that BOTH `cors.ts` and `terminal/handler.ts` rely on:
 *   - Missing Origin → allow (non-browser caller)
 *   - Localhost defaults always present (incl. :5174 + :5180 Argos dev ports)
 *   - VITE_PORT env var → auto-inject `http://localhost:${VITE_PORT}` +
 *     `http://127.0.0.1:${VITE_PORT}` (covers aoe-worktree dev band 5191-5269)
 *   - ARGOS_CORS_ORIGINS additions parsed correctly
 *   - Unknown Origin → reject (CWE-1385 CSWSH)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAllowedOrigins, isAllowedOrigin } from './origin-allowlist';

describe('origin-allowlist', () => {
	const originalEnv = process.env.ARGOS_CORS_ORIGINS;
	const originalVitePort = process.env.VITE_PORT;

	beforeEach(() => {
		delete process.env.ARGOS_CORS_ORIGINS;
		delete process.env.VITE_PORT;
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.ARGOS_CORS_ORIGINS;
		} else {
			process.env.ARGOS_CORS_ORIGINS = originalEnv;
		}
		if (originalVitePort === undefined) {
			delete process.env.VITE_PORT;
		} else {
			process.env.VITE_PORT = originalVitePort;
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
			'http://localhost:5174',
			'http://127.0.0.1:5174',
			'http://localhost:5180',
			'http://127.0.0.1:5180',
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
			'http://100.119.153.120:5173',
			'http://10.0.0.1:5173',
			'http://localhost:9999'
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

	describe('VITE_PORT auto-injection', () => {
		it('returns no extra origins when VITE_PORT is unset (production)', () => {
			const list = getAllowedOrigins();
			expect(list).not.toContain('http://localhost:9999');
		});

		it('injects localhost + 127.0.0.1 variants for a numeric VITE_PORT', () => {
			process.env.VITE_PORT = '5198';
			expect(isAllowedOrigin('http://localhost:5198')).toBe(true);
			expect(isAllowedOrigin('http://127.0.0.1:5198')).toBe(true);
		});

		it('ignores non-numeric VITE_PORT values (defense in depth)', () => {
			process.env.VITE_PORT = '5180; rm -rf /';
			expect(isAllowedOrigin('http://localhost:5180; rm -rf /')).toBe(false);
		});

		it('ignores empty VITE_PORT', () => {
			process.env.VITE_PORT = '';
			const list = getAllowedOrigins();
			expect(list).toHaveLength(8);
		});

		it('does not inject when VITE_PORT contains letters', () => {
			process.env.VITE_PORT = '5180abc';
			expect(isAllowedOrigin('http://localhost:5180abc')).toBe(false);
		});
	});

	describe('getAllowedOrigins — composition', () => {
		it('returns the 8 localhost defaults when env is unset', () => {
			const list = getAllowedOrigins();
			expect(list).toHaveLength(8);
			expect(list).toContain('http://localhost:5173');
			expect(list).toContain('http://127.0.0.1:5173');
			expect(list).toContain('http://localhost:5174');
			expect(list).toContain('http://127.0.0.1:5174');
			expect(list).toContain('http://localhost:5180');
			expect(list).toContain('http://127.0.0.1:5180');
			expect(list).toContain('http://localhost:3000');
			expect(list).toContain('http://127.0.0.1:3000');
		});

		it('appends env-var entries after the defaults', () => {
			process.env.ARGOS_CORS_ORIGINS = 'http://a.b.c.d:5173';
			const list = getAllowedOrigins();
			expect(list).toHaveLength(9);
			expect(list[8]).toBe('http://a.b.c.d:5173');
		});

		it('composes defaults + VITE_PORT + ARGOS_CORS_ORIGINS', () => {
			process.env.VITE_PORT = '5197';
			process.env.ARGOS_CORS_ORIGINS = 'http://100.x.y.z:5173';
			const list = getAllowedOrigins();
			expect(list).toHaveLength(11);
			expect(list).toContain('http://localhost:5197');
			expect(list).toContain('http://127.0.0.1:5197');
			expect(list).toContain('http://100.x.y.z:5173');
		});
	});
});
