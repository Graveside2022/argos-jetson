/**
 * Flying-Squirrel-style RF aggregation.
 *
 *   getRssiHexCells — H3 binning of per-observation RSSI. Feeds the
 *                     heatmap layer (cell mean dBm → color).
 *   getApCentroids  — RSSI-weighted centroid per device (AP). Places the
 *                     marker where the transmitter probably is, not at
 *                     some arbitrary observation sample.
 *   getDrivePath    — sampled operator track (approximated from the
 *                     operator-GPS-tagged signals for the session).
 *
 * All aggregation is done in Node: SQLite's built-in math is thin and a
 * proper H3 extension is not available. Rows are filtered server-side via
 * the existing spatial-grid + (device_id, timestamp) indexes, then reduced
 * in TS. For Argos-scale datasets (10k–500k rows/session) this keeps the
 * path simple without sacrificing throughput.
 */

import type Database from 'better-sqlite3';
import { cellToLatLng, latLngToCell } from 'h3-js';

import { getRFDatabase } from './database';

export interface RfQueryFilters {
	sessionId?: string;
	deviceIds?: string[];
	bbox?: [minLon: number, minLat: number, maxLon: number, maxLat: number];
	startTs?: number;
	endTs?: number;
}

export interface HexCell {
	h3: string;
	lat: number;
	lon: number;
	meanDbm: number;
	maxDbm: number;
	minDbm: number;
	count: number;
}

export interface ApCentroid {
	deviceId: string;
	lat: number;
	lon: number;
	maxDbm: number;
	obsCount: number;
}

export interface PathVertex {
	lat: number;
	lon: number;
	t: number;
}

export interface ObservationPoint {
	lat: number;
	lon: number;
	dbm: number;
	timestamp: number;
}

interface SignalRow {
	device_id: string | null;
	timestamp: number;
	latitude: number;
	longitude: number;
	power: number;
}

const HEX_FEATURE_CAP = 10_000;
const DEFAULT_H3_RES = 11;
const MIN_H3_RES = 5;

/**
 * Pick an H3 resolution for a given MapLibre zoom.
 *   zoom <  10 → 9   (~0.1 km²)
 *   zoom 10–13 → 11  (~0.006 km² — prior default)
 *   zoom >  13 → 13  (~0.0001 km²)
 * NaN / undefined → prior default (11) so old clients keep working.
 */
export function h3ResForZoom(zoom: number | undefined): number {
	if (zoom === undefined || !Number.isFinite(zoom)) return DEFAULT_H3_RES;
	if (zoom < 10) return 9;
	if (zoom <= 13) return 11;
	return 13;
}

interface ClauseBuilder {
	clauses: string[];
	params: unknown[];
}

function addSessionClause(b: ClauseBuilder, sessionId: string | undefined): void {
	if (!sessionId) return;
	b.clauses.push('session_id = ?');
	b.params.push(sessionId);
}

function addDeviceClause(b: ClauseBuilder, deviceIds: string[] | undefined): void {
	if (!deviceIds?.length) return;
	b.clauses.push(`device_id IN (${deviceIds.map(() => '?').join(',')})`);
	b.params.push(...deviceIds);
}

function addBboxClause(b: ClauseBuilder, bbox: RfQueryFilters['bbox']): void {
	if (!bbox) return;
	const [minLon, minLat, maxLon, maxLat] = bbox;
	b.clauses.push('latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
	b.params.push(minLat, maxLat, minLon, maxLon);
}

function addTimeClauses(b: ClauseBuilder, startTs?: number, endTs?: number): void {
	if (startTs !== undefined) {
		b.clauses.push('timestamp >= ?');
		b.params.push(startTs);
	}
	if (endTs !== undefined) {
		b.clauses.push('timestamp <= ?');
		b.params.push(endTs);
	}
}

function buildWhere(filters: RfQueryFilters): { sql: string; params: unknown[] } {
	const b: ClauseBuilder = { clauses: [], params: [] };
	addSessionClause(b, filters.sessionId);
	addDeviceClause(b, filters.deviceIds);
	addBboxClause(b, filters.bbox);
	addTimeClauses(b, filters.startTs, filters.endTs);
	return {
		sql: b.clauses.length ? `WHERE ${b.clauses.join(' AND ')}` : '',
		params: b.params
	};
}

function readSignalRows(db: Database.Database, filters: RfQueryFilters): SignalRow[] {
	const where = buildWhere(filters);
	const stmt = db.prepare(
		`SELECT device_id, timestamp, latitude, longitude, power
		 FROM signals ${where.sql}`
	);
	return stmt.all(...where.params) as SignalRow[];
}

interface HexAccum {
	sum: number;
	max: number;
	min: number;
	count: number;
}

function updateHexBin(bin: HexAccum, power: number): void {
	bin.sum += power;
	bin.count += 1;
	if (power > bin.max) bin.max = power;
	if (power < bin.min) bin.min = power;
}

function binRow(bins: Map<string, HexAccum>, r: SignalRow, h3Res: number): void {
	const h3 = latLngToCell(r.latitude, r.longitude, h3Res);
	const bin = bins.get(h3);
	if (bin) updateHexBin(bin, r.power);
	else bins.set(h3, { sum: r.power, max: r.power, min: r.power, count: 1 });
}

function binToCell(h3: string, bin: HexAccum): HexCell {
	const [lat, lon] = cellToLatLng(h3);
	return {
		h3,
		lat,
		lon,
		meanDbm: bin.sum / bin.count,
		maxDbm: bin.max,
		minDbm: bin.min,
		count: bin.count
	};
}

function aggregateToHexCells(rows: SignalRow[], h3Res: number): HexCell[] {
	const bins = new Map<string, HexAccum>();
	for (const r of rows) binRow(bins, r, h3Res);
	const cells: HexCell[] = [];
	for (const [h3, bin] of bins) cells.push(binToCell(h3, bin));
	return cells;
}

/**
 * Return H3-binned RSSI cells. If the initial bucketing exceeds
 * HEX_FEATURE_CAP, progressively lowers the resolution (larger hexes)
 * until the feature count fits. Prevents blowing up the wire response
 * when zoomed out over a wide survey area.
 */
function downshiftUntilUnderCap(rows: SignalRow[], startRes: number): HexCell[] {
	let res = Math.max(MIN_H3_RES, Math.min(startRes, 15));
	let cells = aggregateToHexCells(rows, res);
	while (cells.length > HEX_FEATURE_CAP && res > MIN_H3_RES) {
		res -= 1;
		cells = aggregateToHexCells(rows, res);
	}
	return cells;
}

export function getRssiHexCells(
	filters: RfQueryFilters,
	h3Res = DEFAULT_H3_RES,
	db: Database.Database = getRFDatabase().rawDb
): HexCell[] {
	const rows = readSignalRows(db, filters);
	if (rows.length === 0) return [];
	return downshiftUntilUnderCap(rows, h3Res);
}

interface CentroidAccum {
	numLat: number;
	numLon: number;
	den: number;
	maxDbm: number;
	count: number;
}

/**
 * RSSI-weighted centroid of each device's observations. Weight is
 * `exp((dbm + 100) / 10)` — the linear-power scale — so the strong
 * observations dominate. A naive unweighted mean lands the AP dot at
 * the mid-point of the drive route, which is almost always wrong.
 */
function updateCentroidBin(bin: CentroidAccum, r: SignalRow, w: number): void {
	bin.numLat += r.latitude * w;
	bin.numLon += r.longitude * w;
	bin.den += w;
	bin.count += 1;
	if (r.power > bin.maxDbm) bin.maxDbm = r.power;
}

function seedCentroidBin(r: SignalRow, w: number): CentroidAccum {
	return {
		numLat: r.latitude * w,
		numLon: r.longitude * w,
		den: w,
		maxDbm: r.power,
		count: 1
	};
}

function accumulateOne(acc: Map<string, CentroidAccum>, r: SignalRow): void {
	if (!r.device_id) return;
	const w = Math.exp((r.power + 100) / 10);
	const bin = acc.get(r.device_id);
	if (bin) updateCentroidBin(bin, r, w);
	else acc.set(r.device_id, seedCentroidBin(r, w));
}

function accumulateCentroids(rows: SignalRow[]): Map<string, CentroidAccum> {
	const acc = new Map<string, CentroidAccum>();
	for (const r of rows) accumulateOne(acc, r);
	return acc;
}

function centroidBinToOutput(deviceId: string, bin: CentroidAccum): ApCentroid | null {
	if (bin.den === 0) return null;
	return {
		deviceId,
		lat: bin.numLat / bin.den,
		lon: bin.numLon / bin.den,
		maxDbm: bin.maxDbm,
		obsCount: bin.count
	};
}

export function getApCentroids(
	filters: RfQueryFilters,
	db: Database.Database = getRFDatabase().rawDb
): ApCentroid[] {
	const rows = readSignalRows(db, filters);
	const acc = accumulateCentroids(rows);
	const out: ApCentroid[] = [];
	for (const [deviceId, bin] of acc) {
		const c = centroidBinToOutput(deviceId, bin);
		if (c) out.push(c);
	}
	return out;
}

/**
 * Operator drive path reconstructed from signal (lat, lon, timestamp).
 * Samples the row stream at `sampleEveryMs` to avoid returning every
 * observation as a path vertex. 500 ms default ≈ 2 Hz path smoothness.
 */
export function getDrivePath(
	filters: RfQueryFilters,
	sampleEveryMs = 500,
	db: Database.Database = getRFDatabase().rawDb
): PathVertex[] {
	const where = buildWhere(filters);
	const rows = db
		.prepare(
			`SELECT timestamp, latitude, longitude
			 FROM signals ${where.sql}
			 ORDER BY timestamp ASC`
		)
		.all(...where.params) as Array<Pick<SignalRow, 'timestamp' | 'latitude' | 'longitude'>>;

	const out: PathVertex[] = [];
	let lastT = -Infinity;
	for (const r of rows) {
		if (r.timestamp - lastT < sampleEveryMs) continue;
		out.push({ lat: r.latitude, lon: r.longitude, t: r.timestamp });
		lastT = r.timestamp;
	}
	return out;
}

/**
 * Raw observation rows for a single BSSID / device_id. Consumed by the
 * Flying-Squirrel "highlight-on-select" UI: when the operator clicks an
 * AP centroid, we draw rays from the centroid to each row returned here
 * so the observer sees every data point that shaped the centroid
 * estimate. `sessionId` / `bbox` / time filters inherit from the shared
 * RfQueryFilters shape.
 */
export function getDeviceObservations(
	filters: RfQueryFilters & { deviceId: string },
	db: Database.Database = getRFDatabase().rawDb
): ObservationPoint[] {
	// Compose the standard WHERE (session/bbox/time) and AND in a
	// device_id filter. Reusing buildWhere keeps filter semantics
	// identical to the other aggregators (hex / centroid / path).
	const base = buildWhere({
		sessionId: filters.sessionId,
		bbox: filters.bbox,
		startTs: filters.startTs,
		endTs: filters.endTs
	});
	const devClause = base.sql === '' ? 'WHERE device_id = ?' : `${base.sql} AND device_id = ?`;
	const params = [...base.params, filters.deviceId];
	const rows = db
		.prepare(
			`SELECT timestamp, latitude, longitude, power
			 FROM signals ${devClause}
			 ORDER BY timestamp ASC`
		)
		.all(...params) as Array<Pick<SignalRow, 'timestamp' | 'latitude' | 'longitude' | 'power'>>;

	return rows.map((r) => ({
		lat: r.latitude,
		lon: r.longitude,
		dbm: r.power,
		timestamp: r.timestamp
	}));
}
