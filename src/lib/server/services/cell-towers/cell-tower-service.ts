import path from 'path';

import { type CellTower, findCellTowersInBoundingBox } from '$lib/server/db/cell-tower-repository';
import { env } from '$lib/server/env';
import { queryOpenCellID } from '$lib/server/services/cell-towers/opencellid-client';
import { logger } from '$lib/utils/logger';

export interface CellTowerResult {
	success: boolean;
	source?: 'database' | 'opencellid-api';
	towers: CellTower[];
	count: number;
	message?: string;
}

/**
 * Convert kilometers to degree deltas for bounding box calculations
 */
function calculateBoundingBox(lat: number, radiusKm: number) {
	const latDelta = radiusKm / 111.32;
	const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
	return { latDelta, lonDelta };
}

/**
 * Query a local OpenCellID SQLite snapshot via the repository.
 * Returns `null` when the DB file does not exist or the query fails.
 */
function tryQueryDb(
	dbPath: string,
	lat: number,
	lon: number,
	latDelta: number,
	lonDelta: number
): CellTowerResult | null {
	try {
		const towers = findCellTowersInBoundingBox(
			dbPath,
			lat - latDelta,
			lat + latDelta,
			lon - lonDelta,
			lon + lonDelta
		);
		if (towers === null) return null;
		return { success: true, source: 'database', towers, count: towers.length };
	} catch (dbErr) {
		logger.warn('[cell-tower] Database query failed', {
			dbPath,
			error: dbErr instanceof Error ? dbErr.message : String(dbErr)
		});
		return null;
	}
}

async function queryLocalDatabase(
	lat: number,
	lon: number,
	latDelta: number,
	lonDelta: number
): Promise<CellTowerResult | null> {
	const dbPaths = [path.join(process.cwd(), 'data', 'celltowers', 'towers.db')];
	for (const dbPath of dbPaths) {
		const result = tryQueryDb(dbPath, lat, lon, latDelta, lonDelta);
		if (result) return result;
	}
	return null;
}

/**
 * Find cell towers near a GPS position
 * Tries local database first, falls back to OpenCellID API
 *
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @param radiusKm Search radius in kilometers (0.1 to 50)
 * @returns Cell tower data with source and count
 */
export async function findNearbyCellTowers(
	lat: number,
	lon: number,
	radiusKm: number
): Promise<CellTowerResult> {
	const { latDelta, lonDelta } = calculateBoundingBox(lat, radiusKm);

	// Try local database first
	const dbResult = await queryLocalDatabase(lat, lon, latDelta, lonDelta);
	if (dbResult) {
		return dbResult;
	}

	// Fallback to OpenCellID API
	const apiKey = env.OPENCELLID_API_KEY ?? '';
	const towers = await queryOpenCellID(lat, lon, latDelta, lonDelta, apiKey);
	if (towers) {
		return { success: true, source: 'opencellid-api', towers, count: towers.length };
	}

	// No results from either source
	return {
		success: false,
		towers: [],
		count: 0,
		message: !apiKey
			? 'No cell tower database found and OPENCELLID_API_KEY not configured'
			: 'No cell tower database found and API returned no results'
	};
}
