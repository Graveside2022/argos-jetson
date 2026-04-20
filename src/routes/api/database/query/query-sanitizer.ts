/**
 * Zod body schema + SQL sanitizer + LIMIT clamp for
 * `/api/database/query`. Sibling to `+server.ts`.
 *
 * This module intentionally has NO SvelteKit runtime imports (no
 * `$app/environment`, no `@sveltejs/kit`) so vitest can load it in a
 * node environment for direct unit-testing the security logic.
 *
 * See the route file for the higher-level defense-in-depth description.
 */

import { z } from 'zod';

// --- Zod body schema -------------------------------------------------------

const QueryParamSchema = z.union([z.string().max(10_000), z.number(), z.null()]);

export const QueryRequestSchema = z.object({
	query: z.string().min(1).max(10_000),
	params: z.array(QueryParamSchema).max(64).default([])
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// --- SQL sanitizer ---------------------------------------------------------

/**
 * Replace `--` line comments, block comments, and string literals with
 * inert placeholders so the subsequent whole-word keyword scan can't be
 * fooled by payloads buried inside a string literal or comment.
 */
export function stripSqlNoise(sql: string): string {
	return sql
		.replace(/--[^\n]*/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/'(?:[^']|'')*'/g, "''")
		.replace(/"(?:[^"]|"")*"/g, '""');
}

const DML_DDL_RE =
	/\b(delete|update|insert|drop|alter|create|pragma|attach|detach|vacuum|reindex|replace|truncate|rename|load_extension)\b/i;

const SQLITE_INTERNAL_RE = /\bsqlite_(master|schema|temp_master|temp_schema|sequence)\b/i;

/** SELECT followed by any whitespace char (space, tab, newline). */
const SELECT_PREFIX_RE = /^select\s/;

/** A `;` followed by any more non-whitespace content (i.e. a stacked statement). */
const MULTI_STATEMENT_RE = /;.+\S/s;

/**
 * Validate a user-supplied SQL string as a safe read-only query.
 * Returns an error string describing the first violation, or null on pass.
 */
export function findSanitizerViolation(rawSql: string): string | null {
	const stripped = stripSqlNoise(rawSql).trim().toLowerCase();
	if (!SELECT_PREFIX_RE.test(stripped)) return 'Only SELECT queries are allowed';
	const dml = stripped.match(DML_DDL_RE);
	if (dml) return `Query contains disallowed keyword: ${dml[0]}`;
	if (SQLITE_INTERNAL_RE.test(stripped)) {
		return 'Access to sqlite_* internal tables is not permitted';
	}
	if (MULTI_STATEMENT_RE.test(stripped.replace(/;\s*$/, ''))) {
		return 'Multi-statement queries are not allowed';
	}
	return null;
}

/** Wrap the user query in an outer LIMIT so the clamp survives string-literal bypass. */
export function applyLimitClamp(rawSql: string, maxRows: number): string {
	const cleaned = rawSql.trim().replace(/;\s*$/, '');
	return `SELECT * FROM (${cleaned}) LIMIT ${maxRows}`;
}

export const MAX_ROWS = 1000;
