/**
 * Ad-hoc read-only query runner for the `/api/database/query` dev-tools route.
 *
 * Opens a process-lifetime readonly handle to the same SQLite file the
 * read/write `RFDatabase` instance uses, so even if the route-level sanitizer
 * is bypassed the DB driver itself will reject any INSERT/UPDATE/DELETE/DDL.
 *
 * The handle is lazily initialized and cached module-scoped (same file per
 * process). This mirrors the WeakMap prepared-statement pattern used by the
 * other repositories under `src/lib/server/db/` — here we cache a handle
 * instead of per-statement compilations because the SQL text is dynamic.
 *
 * NOTE: this module is the ONLY caller allowed to open a readonly handle to
 * the main RF database. All other reads go through `getRFDatabase()`'s shared
 * read/write handle plus prepared statements in their dedicated repositories.
 */

import Database from 'better-sqlite3';

import { getRFDatabase } from './database';

export type QueryParam = string | number | null;

export interface QueryResult {
	rows: unknown[];
	durationMs: number;
}

let roHandle: Database.Database | null = null;

/** Lazily open (and memoize) a readonly handle to the RF database file. */
function getReadOnlyHandle(): Database.Database {
	if (roHandle) return roHandle;
	const dbPath = getRFDatabase().rawDb.name;
	roHandle = new Database(dbPath, { readonly: true, fileMustExist: true });
	return roHandle;
}

/**
 * Execute an already-validated read-only SQL statement.
 *
 * The caller (route handler) is responsible for sanitizing the query text
 * and wrapping it with any LIMIT-enforcement SQL before calling this. The
 * readonly handle provides a belt-and-braces check: any DML/DDL that slips
 * past the route-level sanitizer still fails at the DB driver.
 */
export function runReadOnlyQuery(sql: string, params: readonly QueryParam[]): QueryResult {
	const db = getReadOnlyHandle();
	const stmt = db.prepare(sql);
	const started = Date.now();
	const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as unknown[];
	return { rows, durationMs: Date.now() - started };
}

/** Test-only hook: drop the cached handle so a test can force re-init. */
export function _resetReadOnlyHandleForTests(): void {
	if (roHandle) {
		try {
			roHandle.close();
		} catch {
			/* already closed */
		}
	}
	roHandle = null;
}
