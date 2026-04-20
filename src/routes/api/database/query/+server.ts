/**
 * Dev-tools ad-hoc SELECT runner.
 *
 * Gated: `if (!dev)` early-returns a disabled response in production.
 *
 * Defense-in-depth stack (all layers must pass before a query runs):
 *
 *   1. Zod body schema       — factory `validateBody:` rejects malformed inputs
 *   2. SQL sanitizer         — strips comments + string literals, then enforces
 *                              SELECT-only + whole-word DML/DDL blocklist +
 *                              sqlite_internals-table ban + multi-statement ban
 *   3. LIMIT wrapper         — wraps query as `SELECT * FROM (<q>) LIMIT 1000`
 *                              so the clamp survives string-literal bypass
 *   4. Readonly DB handle    — driver opens the DB with `readonly: true`; even
 *                              a sanitizer bypass can't write
 *   5. Error opacity         — driver errors log full detail server-side but
 *                              the client sees a generic message (no schema leak)
 *
 * The Zod schema + sanitizer live in `./query-sanitizer` so the security
 * logic is unit-testable without the SvelteKit runtime.
 */

import { dev } from '$app/environment';
import { createHandler } from '$lib/server/api/create-handler';
import { runReadOnlyQuery } from '$lib/server/db/query-runner-repository';
import { logger } from '$lib/utils/logger';

import {
	applyLimitClamp,
	findSanitizerViolation,
	MAX_ROWS,
	type QueryRequest,
	QueryRequestSchema
} from './query-sanitizer';

// Re-export the schema + helpers under underscore-prefixed names for tests.
export { QueryRequestSchema as _QueryRequestSchema } from './query-sanitizer';
export { findSanitizerViolation as _findSanitizerViolation } from './query-sanitizer';
export { applyLimitClamp as _applyLimitClamp } from './query-sanitizer';
export { MAX_ROWS as _MAX_ROWS } from './query-sanitizer';

interface SafeSuccess {
	success: true;
	query: string;
	row_count: number;
	execution_time_ms: number;
	results: unknown[];
}
interface SafeReject {
	success: false;
	error: string;
}

function reject(error: string): SafeReject {
	return { success: false, error };
}

function runSanitizedQuery(body: QueryRequest): SafeSuccess | SafeReject {
	const violation = findSanitizerViolation(body.query);
	if (violation) return reject(violation);
	const finalQuery = applyLimitClamp(body.query, MAX_ROWS);
	try {
		const { rows, durationMs } = runReadOnlyQuery(finalQuery, body.params);
		return {
			success: true,
			query: finalQuery,
			row_count: rows.length,
			execution_time_ms: durationMs,
			results: rows
		};
	} catch (error) {
		logger.warn('database/query: execution failed', {
			query: finalQuery,
			error: error instanceof Error ? error.message : String(error)
		});
		return reject('Query failed to execute');
	}
}

export const POST = createHandler(
	async ({ request }) => {
		if (!dev) return reject('Query endpoint is only available in development mode');
		// The factory already validated via `validateBody`; the re-parse sees the
		// same payload (upstream uses `request.clone().json()`).
		const body = (await request.json()) as QueryRequest;
		return runSanitizedQuery(body);
	},
	{ validateBody: QueryRequestSchema, method: 'POST /api/database/query' }
);
