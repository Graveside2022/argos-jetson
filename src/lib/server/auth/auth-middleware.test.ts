import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { TEST_API_KEY, debugMock } = vi.hoisted(() => ({
	TEST_API_KEY: 'a'.repeat(32),
	debugMock: vi.fn()
}));

vi.mock('$lib/server/env', () => ({
	env: {
		ARGOS_API_KEY: TEST_API_KEY,
		ARGOS_WAL_CHECKPOINT_INTERVAL_MS: 60_000
	}
}));

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: debugMock
	}
}));

import { validateApiKey } from './auth-middleware';

const HMAC_SECRET = 'argos-session-v1';
const SESSION_COOKIE_NAME = '__argos_session';
const sessionToken = createHmac('sha256', HMAC_SECRET).update(TEST_API_KEY).digest('hex');

function makeRequest(cookie: string): Request {
	return new Request('http://localhost/api/x', {
		headers: { cookie }
	});
}

describe('parseCookieValue (via validateApiKey session-cookie path) — FINDING-3', () => {
	beforeEach(() => {
		debugMock.mockClear();
	});

	it('accepts a single valid session cookie', () => {
		const req = makeRequest(`${SESSION_COOKIE_NAME}=${sessionToken}`);
		expect(validateApiKey(req)).toBe(true);
		expect(debugMock).not.toHaveBeenCalled();
	});

	it('picks LAST value when duplicate session cookies appear (RFC 6265 §5.4)', () => {
		// First value is bogus; second is the correct derived session token.
		// If first-match-wins (the buggy pre-fix behavior) auth fails; with
		// last-match-wins (post-fix) auth succeeds.
		const req = makeRequest(
			`${SESSION_COOKIE_NAME}=deadbeef; ${SESSION_COOKIE_NAME}=${sessionToken}`
		);
		expect(validateApiKey(req)).toBe(true);
	});

	it('emits a debug log when duplicate cookies of the same name are seen', () => {
		const req = makeRequest(
			`${SESSION_COOKIE_NAME}=deadbeef; ${SESSION_COOKIE_NAME}=${sessionToken}`
		);
		validateApiKey(req);
		expect(debugMock).toHaveBeenCalledWith(
			expect.stringMatching(/Duplicate cookies/i),
			expect.objectContaining({ name: SESSION_COOKIE_NAME, occurrences: 2 }),
			'duplicate-cookie-header'
		);
	});

	it('does not warn when no duplicate is present', () => {
		const req = makeRequest(`${SESSION_COOKIE_NAME}=${sessionToken}; other=value`);
		validateApiKey(req);
		expect(debugMock).not.toHaveBeenCalled();
	});

	it('rejects when only an invalid duplicate pair is present', () => {
		const req = makeRequest(`${SESSION_COOKIE_NAME}=bad1; ${SESSION_COOKIE_NAME}=bad2`);
		expect(validateApiKey(req)).toBe(false);
	});
});
