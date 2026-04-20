/**
 * GSM Evil repository: health-probe access to the GsmEvil SQLite database.
 *
 * GsmEvil writes its IMSI capture log to a dbPath determined at runtime by
 * `resolveGsmDatabasePath()`. This module is the ONLY place that touches
 * better-sqlite3 for the GSM domain; the health-check service consumes
 * the functions exported here.
 *
 * Handles are intentionally NOT cached: the GsmEvil runtime sometimes
 * deletes or recreates its DB file between scans, so every call opens a
 * fresh read-only handle and closes it immediately after the probe. The
 * overhead is trivial for health-check cadence (every few seconds), and
 * it eliminates the risk of holding a stale inode after GsmEvil rotates
 * its file.
 */

import Database from 'better-sqlite3';

import { logger } from '$lib/utils/logger';

/**
 * Probe the GSM database file by opening and immediately closing a
 * read-only handle. Returns true when the file can be opened as a
 * valid SQLite database. Does not execute any SQL.
 */
export function isGsmDatabaseAccessible(dbPath: string): boolean {
	try {
		const db = new Database(dbPath, { readonly: true });
		db.close();
		return true;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-repo] Database connectivity test failed', { error: msg });
		return false;
	}
}

interface ImsiCountRow {
	count: number;
}

/**
 * Return true when the imsi_data table has at least one record captured
 * within the last 10 minutes. Opens a short-lived read-only handle; the
 * handle is always closed before returning (even on query failure).
 */
function queryImsiCount(db: Database.Database): number {
	const row = db
		.prepare(
			"SELECT COUNT(*) as count FROM imsi_data WHERE datetime(date_time) > datetime('now', '-10 minutes')"
		)
		.get() as ImsiCountRow | undefined;
	return row ? row.count : 0;
}

export function hasRecentImsiData(dbPath: string): boolean {
	let db: Database.Database | null = null;
	try {
		db = new Database(dbPath, { readonly: true });
		return queryImsiCount(db) > 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-repo] Recent data check failed', { error: msg });
		return false;
	} finally {
		// Only close if construction actually succeeded — prevents calling
		// .close() on an undefined handle when the Database(...) ctor throws.
		if (db) db.close();
	}
}
