/**
 * PR-7 — Streaming KML/CSV export for a Flying-Squirrel session.
 *
 * Emits rows as they come out of SQLite without materializing the full
 * result set in memory. A 50 k-observation session ~ 7 MB CSV or ~ 14 MB
 * KML; streaming keeps Node's heap flat during the download.
 */

import type Database from 'better-sqlite3';

const CHUNK_ROWS = 500;

export interface ExportRow {
	signalId: string;
	deviceId: string | null;
	source: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	altitude: number | null;
	power: number;
	frequency: number;
	sessionId: string | null;
}

function selectRows(db: Database.Database, sessionId: string): IterableIterator<ExportRow> {
	return db
		.prepare(
			`SELECT signal_id AS signalId,
			        device_id AS deviceId,
			        source,
			        timestamp,
			        latitude,
			        longitude,
			        altitude,
			        power,
			        frequency,
			        session_id AS sessionId
			   FROM signals
			  WHERE session_id = ?
			  ORDER BY timestamp ASC`
		)
		.iterate(sessionId) as IterableIterator<ExportRow>;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeCsv(s: string): string {
	if (s.includes(',') || s.includes('"') || s.includes('\n')) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

function csvHeader(): string {
	return 'signalId,deviceId,source,timestamp,latitude,longitude,altitude,power,frequency,sessionId\n';
}

function csvRow(r: ExportRow): string {
	return (
		[
			r.signalId,
			r.deviceId ?? '',
			r.source,
			String(r.timestamp),
			String(r.latitude),
			String(r.longitude),
			String(r.altitude ?? ''),
			String(r.power),
			String(r.frequency),
			r.sessionId ?? ''
		]
			.map(escapeCsv)
			.join(',') + '\n'
	);
}

function kmlOpen(sessionId: string): string {
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
		`<name>Argos session ${escapeXml(sessionId)}</name>\n`
	);
}

function kmlClose(): string {
	return `</Document></kml>\n`;
}

function kmlPlacemark(r: ExportRow): string {
	const desc = `${r.power} dBm @ ${r.frequency} Hz | ${new Date(r.timestamp).toISOString()}`;
	const name = r.deviceId ?? r.signalId;
	return (
		`<Placemark>` +
		`<name>${escapeXml(name)}</name>` +
		`<description>${escapeXml(desc)}</description>` +
		`<Point><coordinates>${r.longitude},${r.latitude},${r.altitude ?? 0}</coordinates></Point>` +
		`</Placemark>\n`
	);
}

function fillChunk(
	rows: IterableIterator<ExportRow>,
	format: 'csv' | 'kml'
): { chunks: string[]; emitted: number } {
	const chunks: string[] = [];
	let emitted = 0;
	for (const row of rows) {
		chunks.push(format === 'csv' ? csvRow(row) : kmlPlacemark(row));
		if (++emitted >= CHUNK_ROWS) break;
	}
	return { chunks, emitted };
}

function makeChunkedSource(
	db: Database.Database,
	sessionId: string,
	format: 'csv' | 'kml'
): ReadableStream<Uint8Array> {
	const rows = selectRows(db, sessionId);
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(format === 'csv' ? csvHeader() : kmlOpen(sessionId)));
		},
		pull(controller) {
			const { chunks, emitted } = fillChunk(rows, format);
			if (chunks.length > 0) controller.enqueue(encoder.encode(chunks.join('')));
			if (emitted < CHUNK_ROWS) {
				if (format === 'kml') controller.enqueue(encoder.encode(kmlClose()));
				controller.close();
			}
		}
	});
}

export function exportSession(
	db: Database.Database,
	sessionId: string,
	format: 'csv' | 'kml'
): { stream: ReadableStream<Uint8Array>; contentType: string; filename: string } {
	const stream = makeChunkedSource(db, sessionId, format);
	const contentType = format === 'csv' ? 'text/csv' : 'application/vnd.google-earth.kml+xml';
	const filename = `session-${sessionId}.${format}`;
	return { stream, contentType, filename };
}
