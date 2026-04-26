/**
 * PR-7: session-export streams KML/CSV row-by-row without OOM.
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { exportSession } from '$lib/server/services/rf/session-export';

function makeDb(): Database.Database {
	const db = new Database(':memory:');
	db.exec(`
		CREATE TABLE sessions (id TEXT PRIMARY KEY, started_at INTEGER, ended_at INTEGER,
			label TEXT, source TEXT, metadata TEXT);
		CREATE TABLE signals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			signal_id TEXT UNIQUE NOT NULL,
			device_id TEXT,
			timestamp INTEGER NOT NULL,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			altitude REAL,
			power REAL NOT NULL,
			frequency REAL NOT NULL,
			source TEXT NOT NULL,
			metadata TEXT,
			session_id TEXT
		);
	`);
	db.prepare(`INSERT INTO sessions (id, started_at, source) VALUES (?, ?, ?)`).run(
		'sess-E',
		Date.now(),
		'manual'
	);
	return db;
}

function insert(db: Database.Database, i: number): void {
	db.prepare(
		`INSERT INTO signals (signal_id, device_id, timestamp, latitude, longitude, altitude, power, frequency, source, session_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		`sig-${i}`,
		`aa:bb:${i}`,
		1_000_000 + i * 1000,
		35 + i * 0.0001,
		-116 + i * 0.0001,
		0,
		-60 - i,
		2400 + i,
		'kismet',
		'sess-E'
	);
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let out = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		if (value) out += decoder.decode(value, { stream: true });
	}
	return out;
}

describe('exportSession', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = makeDb();
		for (let i = 0; i < 5; i++) insert(db, i);
	});

	afterEach(() => {
		db.close();
	});

	it('CSV header + one row per signal', async () => {
		const { stream, contentType, filename } = exportSession(db, 'sess-E', 'csv');
		expect(contentType).toBe('text/csv');
		expect(filename).toBe('session-sess-E.csv');
		const text = await readAll(stream);
		const lines = text.trim().split('\n');
		expect(lines[0]).toContain('signalId');
		expect(lines.length).toBe(6); // header + 5 rows
		expect(lines[1]).toContain('sig-0');
	});

	it('KML wraps rows in a Document with Placemarks', async () => {
		const { stream, contentType, filename } = exportSession(db, 'sess-E', 'kml');
		expect(contentType).toBe('application/vnd.google-earth.kml+xml');
		expect(filename).toBe('session-sess-E.kml');
		const text = await readAll(stream);
		expect(text).toContain('<?xml');
		expect(text).toContain('<kml');
		expect(text).toContain('</kml>');
		expect((text.match(/<Placemark>/g) ?? []).length).toBe(5);
	});

	it('returns a single empty-but-well-formed document for an empty session', async () => {
		db.prepare(`INSERT INTO sessions (id, started_at, source) VALUES (?, ?, ?)`).run(
			'sess-empty',
			Date.now(),
			'manual'
		);
		const { stream } = exportSession(db, 'sess-empty', 'kml');
		const text = await readAll(stream);
		expect(text).toContain('<kml');
		expect(text).toContain('</kml>');
		expect(text).not.toContain('<Placemark>');
	});

	it('CSV escapes embedded commas + quotes in device ids', async () => {
		db.prepare(
			`INSERT INTO signals (signal_id, device_id, timestamp, latitude, longitude, power, frequency, source, session_id)
			 VALUES ('sig-x', 'weird,"name"', 2000000, 35, -116, -50, 2440, 'kismet', 'sess-E')`
		).run();
		const { stream } = exportSession(db, 'sess-E', 'csv');
		const text = await readAll(stream);
		expect(text).toContain('"weird,""name"""');
	});

	it('KML escapes xml entities in device ids', async () => {
		db.prepare(
			`INSERT INTO signals (signal_id, device_id, timestamp, latitude, longitude, power, frequency, source, session_id)
			 VALUES ('sig-xml', 'a<b&c', 2000000, 35, -116, -50, 2440, 'kismet', 'sess-E')`
		).run();
		const { stream } = exportSession(db, 'sess-E', 'kml');
		const text = await readAll(stream);
		expect(text).toContain('a&lt;b&amp;c');
	});

	it('orders rows by timestamp ascending', async () => {
		const { stream } = exportSession(db, 'sess-E', 'csv');
		const text = await readAll(stream);
		const rows = text.trim().split('\n').slice(1); // skip header
		const timestamps = rows.map((r) => Number(r.split(',')[3]));
		for (let i = 1; i < timestamps.length; i++) {
			expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
		}
	});
});
