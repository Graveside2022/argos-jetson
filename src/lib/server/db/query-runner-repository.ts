/**
 * Ad-hoc read-only query runner for the `/api/database/query` dev-tools route.
 *
 * Opens a fresh readonly connection per query and closes it when done.
 * A process-lifetime handle was removed because the lingering connection
 * could hold SQLite read snapshots that blocked WAL auto-checkpointing,
 * causing rf_signals.db-wal to grow to multi-GB scale. The route is
 * dev-only and rate-limited (~30 req/min), so open/close overhead is
 * negligible.
 */

import Database from 'better-sqlite3';

import { getRFDatabase } from './database';

export type QueryParam = string | number | null;

export interface QueryResult {
	rows: unknown[];
	durationMs: number;
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
	const dbPath = getRFDatabase().rawDb.name;
	const db = new Database(dbPath, { readonly: true, fileMustExist: true });
	try {
		const stmt = db.prepare(sql);
		const started = Date.now();
		const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as unknown[];
		return { rows, durationMs: Date.now() - started };
	} finally {
		try {
			db.close();
		} catch {
			/* already closed */
		}
	}
}

/** Test-only hook: retained as a no-op so any existing test imports don't break. */
export function _resetReadOnlyHandleForTests(): void {
	/* no-op: handle is no longer memoized */
}
