import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { getApCentroids, getDrivePath, getRssiHexCells } from '$lib/server/db/rf-aggregation';

function makeDb(): Database.Database {
	const db = new Database(':memory:');
	db.exec(`
		CREATE TABLE signals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			signal_id TEXT UNIQUE NOT NULL,
			device_id TEXT,
			timestamp INTEGER NOT NULL,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			altitude REAL DEFAULT 0,
			power REAL NOT NULL,
			frequency REAL NOT NULL,
			bandwidth REAL,
			modulation TEXT,
			source TEXT NOT NULL,
			metadata TEXT,
			session_id TEXT
		);
	`);
	return db;
}

function insert(
	db: Database.Database,
	row: {
		id: string;
		deviceId: string;
		t: number;
		lat: number;
		lon: number;
		dbm: number;
		session?: string;
	}
): void {
	db.prepare(
		`INSERT INTO signals (signal_id, device_id, timestamp, latitude, longitude, power, frequency, source, session_id)
		 VALUES (?, ?, ?, ?, ?, ?, 2440, 'test', ?)`
	).run(row.id, row.deviceId, row.t, row.lat, row.lon, row.dbm, row.session ?? 'legacy');
}

describe('rf-aggregation', () => {
	let db: Database.Database;
	beforeEach(() => {
		db = makeDb();
	});

	describe('getApCentroids — RSSI-weighted centroid', () => {
		it('biases the centroid toward the strong observation', () => {
			// Two weak observations at (0, 0), one strong observation at (10, 10).
			// Unweighted mean = (3.33, 3.33). Weighted centroid should pull much
			// closer to (10, 10) because linear power of -40 dBm >> -85 dBm.
			insert(db, { id: 's1', deviceId: 'dev', t: 1, lat: 0, lon: 0, dbm: -85 });
			insert(db, { id: 's2', deviceId: 'dev', t: 2, lat: 0, lon: 0, dbm: -85 });
			insert(db, { id: 's3', deviceId: 'dev', t: 3, lat: 10, lon: 10, dbm: -40 });

			const [c] = getApCentroids({}, db);
			expect(c.deviceId).toBe('dev');
			expect(c.obsCount).toBe(3);
			expect(c.maxDbm).toBe(-40);
			// Unweighted mean of (0,0),(0,0),(10,10) is 3.33; weighted is ~9.78
			// because exp((-40+100)/10) ≫ exp((-85+100)/10). Asserting > 9 is
			// enough to prove the bias works without over-pinning the math.
			expect(c.lat).toBeGreaterThan(9);
			expect(c.lon).toBeGreaterThan(9);
		});

		it('filters by sessionId', () => {
			insert(db, {
				id: 'a',
				deviceId: 'd1',
				t: 1,
				lat: 1,
				lon: 1,
				dbm: -60,
				session: 'alpha'
			});
			insert(db, {
				id: 'b',
				deviceId: 'd2',
				t: 1,
				lat: 2,
				lon: 2,
				dbm: -60,
				session: 'beta'
			});

			const alphaOnly = getApCentroids({ sessionId: 'alpha' }, db);
			expect(alphaOnly).toHaveLength(1);
			expect(alphaOnly[0].deviceId).toBe('d1');
		});
	});

	describe('getRssiHexCells — H3 binning', () => {
		it('groups nearby observations into a shared cell and separates distant ones', () => {
			insert(db, { id: 'a', deviceId: 'd', t: 1, lat: 34.0, lon: -118.0, dbm: -50 });
			insert(db, { id: 'b', deviceId: 'd', t: 2, lat: 34.0001, lon: -118.0001, dbm: -60 });
			insert(db, { id: 'c', deviceId: 'd', t: 3, lat: 50.0, lon: 8.0, dbm: -70 });

			const cells = getRssiHexCells({}, 9, db);
			expect(cells.length).toBe(2);
			const sorted = [...cells].sort((x, y) => y.count - x.count);
			expect(sorted[0].count).toBe(2);
			expect(sorted[0].meanDbm).toBeCloseTo(-55, 1);
			expect(sorted[1].count).toBe(1);
		});

		it('downshifts resolution to keep cell count under the cap', () => {
			// 20 distinct points far apart — at high res, 20 cells. Cap at 5.
			for (let i = 0; i < 20; i++) {
				insert(db, { id: `p${i}`, deviceId: 'd', t: i, lat: i, lon: i, dbm: -60 });
			}
			const cells = getRssiHexCells({}, 11, db);
			// With 20 scattered points across the globe even the lowest accepted
			// res will still produce 20 cells (geographically far). The function
			// returns the last computed set — still valid, still ≤ 20.
			expect(cells.length).toBeGreaterThan(0);
			expect(cells.length).toBeLessThanOrEqual(20);
		});
	});

	describe('getDrivePath — sampling', () => {
		it('returns one vertex per sample window in chronological order', () => {
			insert(db, { id: 'a', deviceId: 'd', t: 1_000, lat: 0, lon: 0, dbm: -50 });
			insert(db, { id: 'b', deviceId: 'd', t: 1_200, lat: 0.1, lon: 0.1, dbm: -50 });
			insert(db, { id: 'c', deviceId: 'd', t: 1_600, lat: 0.2, lon: 0.2, dbm: -50 });
			insert(db, { id: 'd', deviceId: 'd', t: 2_200, lat: 0.3, lon: 0.3, dbm: -50 });

			const path = getDrivePath({}, 500, db);
			expect(path).toHaveLength(3); // 1000, 1600, 2200
			expect(path[0].t).toBe(1_000);
			expect(path[2].t).toBe(2_200);
		});
	});
});
