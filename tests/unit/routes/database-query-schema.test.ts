/**
 * Schema + sanitizer tests for Task #15 — `/api/database/query` route.
 *
 * Validates the Zod body schema (shape/size limits) and the internal
 * SQL sanitizer exported for test (`_findSanitizerViolationForTests`
 * via the module's re-exported helpers). Because the route's helpers
 * are currently internal, these tests reach in via the public Zod
 * export (`_QueryRequestSchema`) + a behavioral probe that exercises
 * the sanitizer through a deliberately-shaped payload.
 */

import { describe, expect, it } from 'vitest';

import {
	applyLimitClamp,
	findSanitizerViolation,
	MAX_ROWS,
	QueryRequestSchema
} from '../../../src/routes/api/database/query/query-sanitizer';

describe('QueryRequestSchema — body shape', () => {
	it('accepts a minimal SELECT with empty params', () => {
		const parsed = QueryRequestSchema.safeParse({ query: 'SELECT 1' });
		expect(parsed.success).toBe(true);
		// default() fills missing params as []
		if (parsed.success) expect(parsed.data.params).toEqual([]);
	});

	it('accepts bound params (string | number | null)', () => {
		const parsed = QueryRequestSchema.safeParse({
			query: 'SELECT * FROM t WHERE a = ? AND b = ? AND c IS ?',
			params: ['name', 42, null]
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects non-string query', () => {
		const parsed = QueryRequestSchema.safeParse({ query: 12345 });
		expect(parsed.success).toBe(false);
	});

	it('rejects empty query string', () => {
		const parsed = QueryRequestSchema.safeParse({ query: '' });
		expect(parsed.success).toBe(false);
	});

	it('rejects over-sized query (>10k chars)', () => {
		const parsed = QueryRequestSchema.safeParse({ query: 'x'.repeat(10_001) });
		expect(parsed.success).toBe(false);
	});

	it('rejects param that is an object (only primitives allowed)', () => {
		const parsed = QueryRequestSchema.safeParse({
			query: 'SELECT 1',
			params: [{ malicious: true }]
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects param arrays larger than 64 entries', () => {
		const parsed = QueryRequestSchema.safeParse({
			query: 'SELECT 1',
			params: Array.from({ length: 65 }, (_, i) => i)
		});
		expect(parsed.success).toBe(false);
	});
});

describe('findSanitizerViolation — SQL-level defense', () => {
	it('accepts a plain SELECT', () => {
		expect(findSanitizerViolation('SELECT * FROM devices WHERE rssi > -80')).toBeNull();
	});

	it('accepts SELECT with bound placeholders', () => {
		expect(findSanitizerViolation('SELECT * FROM t WHERE id = ? AND name = ?')).toBeNull();
	});

	it('rejects a write — DELETE', () => {
		expect(findSanitizerViolation('DELETE FROM users WHERE id = 1')).toMatch(/Only SELECT/);
	});

	it('rejects a write — INSERT', () => {
		expect(findSanitizerViolation('INSERT INTO t VALUES (1)')).toMatch(/Only SELECT/);
	});

	it('rejects an UPDATE', () => {
		expect(findSanitizerViolation('UPDATE t SET a = 1')).toMatch(/Only SELECT/);
	});

	it('rejects a DROP', () => {
		expect(findSanitizerViolation('DROP TABLE users')).toMatch(/Only SELECT/);
	});

	it('rejects PRAGMA', () => {
		expect(findSanitizerViolation("PRAGMA table_info('users')")).toMatch(/Only SELECT/);
	});

	it('rejects injection via stacked statement', () => {
		expect(findSanitizerViolation('SELECT 1; DROP TABLE users; --')).toMatch(
			/Multi-statement|disallowed keyword/
		);
	});

	it('rejects DELETE smuggled via block comment (`--` variant)', () => {
		// The sanitizer strips `--` line comments first, so anything after
		// the marker must not re-enable writes. But the DELETE keyword
		// appearing INSIDE a `/* */` block should be erased and the query
		// must otherwise still be a valid SELECT.
		expect(findSanitizerViolation('SELECT 1 /* DELETE FROM users */')).toBeNull();
		// Whereas an unmasked DELETE anywhere is still caught:
		expect(findSanitizerViolation('SELECT 1 UNION DELETE FROM users')).toMatch(
			/disallowed keyword/
		);
	});

	it('rejects access to sqlite_master', () => {
		expect(findSanitizerViolation('SELECT * FROM sqlite_master')).toMatch(/sqlite_/);
	});

	it('rejects access to sqlite_schema', () => {
		expect(findSanitizerViolation('SELECT * FROM sqlite_schema WHERE type = ?')).toMatch(
			/sqlite_/
		);
	});

	it('rejects load_extension()', () => {
		expect(findSanitizerViolation("SELECT load_extension('evil.so')")).toMatch(
			/disallowed keyword/
		);
	});

	it('does not get fooled by keyword inside a string literal', () => {
		// `'DELETE FROM t'` is a string literal; the sanitizer should strip
		// it before scanning, so a query referencing the WORD "delete" inside
		// quotes remains a valid SELECT.
		expect(findSanitizerViolation("SELECT 'DELETE FROM t' AS label")).toBeNull();
	});

	it('rejects query not starting with SELECT', () => {
		expect(findSanitizerViolation('WITH x AS (SELECT 1) SELECT * FROM x')).toMatch(
			/Only SELECT/
		);
	});
});

describe('applyLimitClamp — DoS guard survives string-literal bypass', () => {
	it('wraps a bare SELECT in an outer LIMIT', () => {
		const wrapped = applyLimitClamp('SELECT * FROM t', MAX_ROWS);
		expect(wrapped).toBe(`SELECT * FROM (SELECT * FROM t) LIMIT ${MAX_ROWS}`);
	});

	it('strips trailing semicolon before wrapping', () => {
		const wrapped = applyLimitClamp('SELECT * FROM t;', MAX_ROWS);
		expect(wrapped).toBe(`SELECT * FROM (SELECT * FROM t) LIMIT ${MAX_ROWS}`);
	});

	it("clamps even when the user query contains a bypassing string literal 'limit 1'", () => {
		// This is the regression case — a string literal that spells the
		// word "limit" must NOT trick us into skipping the outer LIMIT.
		const wrapped = applyLimitClamp("SELECT * FROM devices WHERE name = 'limit 1'", MAX_ROWS);
		expect(wrapped).toMatch(new RegExp(`LIMIT ${MAX_ROWS}$`));
	});

	it('clamps even when the user requested LIMIT 1e9', () => {
		const wrapped = applyLimitClamp('SELECT * FROM big LIMIT 1000000000', MAX_ROWS);
		// Inner LIMIT is advisory; outer LIMIT is authoritative.
		expect(wrapped.endsWith(`LIMIT ${MAX_ROWS}`)).toBe(true);
	});
});
