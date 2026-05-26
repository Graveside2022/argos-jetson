import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	getApCentroids,
	getDeviceObservations,
	getDrivePath,
	getRssiHexCells,
	h3ResForZoom
} from './rf-aggregation';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

describe('h3ResForZoom — boundary table', () => {
	it('undefined → 11 (default)', () => expect(h3ResForZoom(undefined)).toBe(11));
	it('NaN → 11', () => expect(h3ResForZoom(NaN)).toBe(11));
	it('-Infinity → 11', () => expect(h3ResForZoom(-Infinity)).toBe(11));
	it('zoom = 0 → 9', () => expect(h3ResForZoom(0)).toBe(9));
	it('zoom = 9.99 → 9', () => expect(h3ResForZoom(9.99)).toBe(9));
	it('zoom = 10 → 11', () => expect(h3ResForZoom(10)).toBe(11));
	it('zoom = 13 → 11', () => expect(h3ResForZoom(13)).toBe(11));
	it('zoom = 13.01 → 13', () => expect(h3ResForZoom(13.01)).toBe(13));
	it('zoom = 22 → 13', () => expect(h3ResForZoom(22)).toBe(13));
});

describe('rf-aggregation queries against in-memory schema', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = new Database(':memory:');
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
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
	});

	afterEach(() => {
		try {
			db.close();
		} catch {
			/* noop */
		}
	});

	function insertSignal(row: {
		signal_id: string;
		device_id?: string | null;
		timestamp: number;
		latitude: number;
		longitude: number;
		power: number;
		frequency?: number;
		source?: string;
		session_id?: string | null;
	}): void {
		db.prepare(
			`INSERT INTO signals (signal_id, device_id, timestamp, latitude, longitude,
				power, frequency, source, session_id)
			 VALUES (@signal_id, @device_id, @timestamp, @latitude, @longitude,
				@power, @frequency, @source, @session_id)`
		).run({
			signal_id: row.signal_id,
			device_id: row.device_id ?? null,
			timestamp: row.timestamp,
			latitude: row.latitude,
			longitude: row.longitude,
			power: row.power,
			frequency: row.frequency ?? 2440,
			source: row.source ?? 'kismet',
			session_id: row.session_id ?? null
		});
	}

	describe('getRssiHexCells', () => {
		it('returns empty array on empty table', () => {
			expect(getRssiHexCells({}, 11, db)).toEqual([]);
		});

		it('bins signals into H3 cells', () => {
			insertSignal({ signal_id: 's1', timestamp: 1000, latitude: 37.7, longitude: -122.4, power: -55 });
			insertSignal({ signal_id: 's2', timestamp: 2000, latitude: 37.7, longitude: -122.4, power: -50 });
			insertSignal({ signal_id: 's3', timestamp: 3000, latitude: 37.8, longitude: -122.5, power: -60 });
			const cells = getRssiHexCells({}, 11, db);
			expect(cells.length).toBeGreaterThanOrEqual(1);
			expect(cells[0]).toHaveProperty('h3');
			expect(cells[0]).toHaveProperty('meanDbm');
			expect(cells[0]).toHaveProperty('count');
		});

		it('respects sessionId filter', () => {
			insertSignal({
				signal_id: 's1', timestamp: 1, latitude: 37.7, longitude: -122.4, power: -50,
				session_id: 'sess-a'
			});
			insertSignal({
				signal_id: 's2', timestamp: 2, latitude: 37.7, longitude: -122.4, power: -50,
				session_id: 'sess-b'
			});
			const cellsA = getRssiHexCells({ sessionId: 'sess-a' }, 11, db);
			const totalA = cellsA.reduce((s, c) => s + c.count, 0);
			expect(totalA).toBe(1);
		});

		it('respects bbox filter', () => {
			insertSignal({ signal_id: 's1', timestamp: 1, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', timestamp: 2, latitude: 50, longitude: 50, power: -50 });
			const cells = getRssiHexCells(
				{ bbox: [-1, -1, 1, 1] }, // minLon, minLat, maxLon, maxLat covers (0,0) only
				11,
				db
			);
			const total = cells.reduce((s, c) => s + c.count, 0);
			expect(total).toBe(1);
		});

		it('respects rssiFloorDbm filter', () => {
			insertSignal({ signal_id: 's1', timestamp: 1, latitude: 0, longitude: 0, power: -90 });
			insertSignal({ signal_id: 's2', timestamp: 2, latitude: 0, longitude: 0, power: -50 });
			const cells = getRssiHexCells({ rssiFloorDbm: -60 }, 11, db);
			const total = cells.reduce((s, c) => s + c.count, 0);
			expect(total).toBe(1);
		});
	});

	describe('getApCentroids', () => {
		it('returns empty for no devices', () => {
			expect(getApCentroids({}, db)).toEqual([]);
		});

		it('produces one centroid per device_id', () => {
			insertSignal({ signal_id: 's1', device_id: 'd1', timestamp: 1, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', device_id: 'd1', timestamp: 2, latitude: 0.1, longitude: 0.1, power: -50 });
			insertSignal({ signal_id: 's3', device_id: 'd2', timestamp: 3, latitude: 10, longitude: 10, power: -50 });
			const centroids = getApCentroids({}, db);
			expect(centroids.map((c) => c.deviceId).sort()).toEqual(['d1', 'd2']);
		});

		it('skips rows without device_id', () => {
			insertSignal({ signal_id: 's1', device_id: null, timestamp: 1, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', device_id: 'd1', timestamp: 2, latitude: 0.1, longitude: 0.1, power: -50 });
			const centroids = getApCentroids({}, db);
			expect(centroids).toHaveLength(1);
			expect(centroids[0].deviceId).toBe('d1');
		});

		it('weights stronger signals more in centroid', () => {
			// 2 weak signals at (0,0), 1 very strong at (10,10).
			// exp((-90+100)/10) ≈ 2.7; exp((-30+100)/10) ≈ 1097. Strong dominates.
			insertSignal({ signal_id: 's1', device_id: 'd1', timestamp: 1, latitude: 0, longitude: 0, power: -90 });
			insertSignal({ signal_id: 's2', device_id: 'd1', timestamp: 2, latitude: 0, longitude: 0, power: -90 });
			insertSignal({ signal_id: 's3', device_id: 'd1', timestamp: 3, latitude: 10, longitude: 10, power: -30 });
			const c = getApCentroids({}, db);
			expect(c[0].lat).toBeGreaterThan(5);
			expect(c[0].lon).toBeGreaterThan(5);
		});
	});

	describe('getDrivePath sampling', () => {
		it('first vertex always pushed (-Infinity initial lastT)', () => {
			insertSignal({ signal_id: 's1', timestamp: 0, latitude: 0, longitude: 0, power: -50 });
			const path = getDrivePath({}, 500, db);
			expect(path).toHaveLength(1);
		});

		it('drops vertices within sampleEveryMs of last', () => {
			insertSignal({ signal_id: 's1', timestamp: 0, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', timestamp: 100, latitude: 1, longitude: 1, power: -50 });
			insertSignal({ signal_id: 's3', timestamp: 600, latitude: 2, longitude: 2, power: -50 });
			const path = getDrivePath({}, 500, db);
			expect(path).toHaveLength(2);
			expect(path[0].t).toBe(0);
			expect(path[1].t).toBe(600);
		});

		it('respects custom sampleEveryMs', () => {
			insertSignal({ signal_id: 's1', timestamp: 0, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', timestamp: 50, latitude: 1, longitude: 1, power: -50 });
			insertSignal({ signal_id: 's3', timestamp: 100, latitude: 2, longitude: 2, power: -50 });
			const path = getDrivePath({}, 50, db);
			expect(path).toHaveLength(3);
		});
	});

	describe('getDeviceObservations', () => {
		it('returns rows for given device only', () => {
			insertSignal({ signal_id: 's1', device_id: 'd1', timestamp: 1, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', device_id: 'd2', timestamp: 2, latitude: 0, longitude: 0, power: -50 });
			const obs = getDeviceObservations({ deviceId: 'd1' }, db);
			expect(obs).toHaveLength(1);
		});

		it('combines deviceId with sessionId filter', () => {
			insertSignal({
				signal_id: 's1', device_id: 'd1', timestamp: 1, latitude: 0, longitude: 0, power: -50,
				session_id: 'sess-a'
			});
			insertSignal({
				signal_id: 's2', device_id: 'd1', timestamp: 2, latitude: 0, longitude: 0, power: -50,
				session_id: 'sess-b'
			});
			const obs = getDeviceObservations({ deviceId: 'd1', sessionId: 'sess-a' }, db);
			expect(obs).toHaveLength(1);
			expect(obs[0].timestamp).toBe(1);
		});

		it('orders by timestamp ASC', () => {
			insertSignal({ signal_id: 's1', device_id: 'd1', timestamp: 2, latitude: 0, longitude: 0, power: -50 });
			insertSignal({ signal_id: 's2', device_id: 'd1', timestamp: 1, latitude: 0, longitude: 0, power: -50 });
			const obs = getDeviceObservations({ deviceId: 'd1' }, db);
			expect(obs[0].timestamp).toBe(1);
			expect(obs[1].timestamp).toBe(2);
		});
	});
});
