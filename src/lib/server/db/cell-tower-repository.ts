/**
 * Cell-tower repository: read-only access to the OpenCellID SQLite snapshot
 * at data/celltowers/towers.db.
 *
 * The repository owns the better-sqlite3 handle and prepared statement,
 * memoized per-dbPath. Opening the DB and preparing the statement on every
 * call was expensive (the snapshot is typically >500MB); caching the handle
 * keeps the prepared statement identity stable across requests.
 *
 * Nothing outside src/lib/server/db/ should touch better-sqlite3 directly.
 */

import Database from 'better-sqlite3';
import fs from 'fs';

import { logger } from '$lib/utils/logger';

/** Raw row shape returned from the OpenCellID SQLite schema. */
interface TowerRow {
	radio: string;
	mcc: number;
	net: number;
	area: number;
	cell: number;
	lat: number;
	lon: number;
	range: number;
	samples: number;
	created: number;
	updated: number;
	averageSignal: number;
}

/** Public cell tower shape used by the service layer. */
export interface CellTower {
	radio: string;
	mcc: number;
	mnc: number;
	lac: number;
	ci: number;
	lat: number;
	lon: number;
	range: number;
	samples: number;
	updated: number;
	avgSignal: number;
}

interface CachedHandle {
	db: Database.Database;
	findInBoundingBox: Database.Statement;
}

/** Cache of open read-only DB handles + prepared statements, keyed by dbPath. */
const handleCache = new Map<string, CachedHandle>();

/** Coerce possibly-nullish numeric columns to 0. */
function toNumber(val: number): number {
	return val || 0;
}

/** Map an OpenCellID row to the public CellTower shape. */
function rowToTower(r: TowerRow): CellTower {
	return {
		radio: r.radio || 'Unknown',
		mcc: r.mcc,
		mnc: r.net,
		lac: r.area,
		ci: r.cell,
		lat: r.lat,
		lon: r.lon,
		range: toNumber(r.range),
		samples: toNumber(r.samples),
		updated: toNumber(r.updated),
		avgSignal: toNumber(r.averageSignal)
	};
}

/**
 * Get (or lazily create) a cached read-only handle and prepared statement
 * for the given OpenCellID DB path. Returns null if the file does not exist.
 */
function getHandle(dbPath: string): CachedHandle | null {
	const existing = handleCache.get(dbPath);
	if (existing) return existing;
	if (!fs.existsSync(dbPath)) return null;

	const db = new Database(dbPath, { readonly: true });
	const findInBoundingBox = db.prepare(
		`SELECT radio, mcc, net, area, cell, lat, lon, range, samples, created, updated, averageSignal
		 FROM towers
		 WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
		 ORDER BY samples DESC
		 LIMIT 500`
	);
	const handle: CachedHandle = { db, findInBoundingBox };
	handleCache.set(dbPath, handle);
	return handle;
}

/** Evict a cached handle (used after a query failure so the next call reopens). */
function evict(dbPath: string): void {
	const existing = handleCache.get(dbPath);
	if (!existing) return;
	try {
		existing.db.close();
	} catch {
		// Swallow: the handle is already being discarded.
	}
	handleCache.delete(dbPath);
}

/**
 * Find cell towers inside a lat/lon bounding box.
 * Returns `null` when the DB file does not exist at the given path,
 * and `[]` when the file exists but the query matched nothing.
 * Throws on unexpected I/O errors after evicting the cached handle.
 */
export function findCellTowersInBoundingBox(
	dbPath: string,
	latMin: number,
	latMax: number,
	lonMin: number,
	lonMax: number
): CellTower[] | null {
	const handle = getHandle(dbPath);
	if (!handle) return null;

	try {
		const rows = handle.findInBoundingBox.all(latMin, latMax, lonMin, lonMax) as TowerRow[];
		return rows.map(rowToTower);
	} catch (err) {
		logger.warn('[cell-tower-repo] Bounding-box query failed', {
			dbPath,
			error: err instanceof Error ? err.message : String(err)
		});
		evict(dbPath);
		throw err;
	}
}
