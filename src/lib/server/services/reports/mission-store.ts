/**
 * Mission / capture / report public API.
 *
 * Module of pure functions following the `network-repository` pattern:
 * every function takes the `db` handle as its first argument. The raw
 * prepared-statement cache and row mappers now live in
 * `$lib/server/db/mission-repository` — nothing in this file touches
 * better-sqlite3 directly except via the stmts(db) helper imported from
 * there, which keeps prepared-statement identity stable per-Database.
 */

import type Database from 'better-sqlite3';

import {
	captureEmitterRowFromDb,
	captureRowToCapture,
	missionRowToMission,
	reportRowToReport,
	slugify,
	stmts
} from '$lib/server/db/mission-repository';

import { type CaptureLoadout, hashLoadout } from './loadout-hash';
import type {
	CaptureEmitterRow,
	CaptureRole,
	CaptureRow,
	Mission,
	MissionPatch,
	MissionType,
	ReportInput,
	ReportRow,
	ReportType
} from './types';

type MissionInput = {
	name: string;
	type: MissionType;
	unit?: string | null;
	ao_mgrs?: string | null;
	operator?: string | null;
	target?: string | null;
	link_budget?: number | null;
};

function missionInsertParams(id: string, created_at: number, input: MissionInput) {
	return {
		id,
		name: input.name,
		type: input.type,
		unit: nn(input.unit),
		ao_mgrs: nn(input.ao_mgrs),
		operator: nn(input.operator),
		target: nn(input.target),
		link_budget: nn(input.link_budget),
		created_at,
		active: 0
	};
}

export function createMission(db: Database.Database, input: MissionInput): Mission {
	const created_at = Date.now();
	const id = `m_${created_at}_${slugify(input.name) || 'mission'}`;
	stmts(db).insertMission.run(missionInsertParams(id, created_at, input));
	const mission = getMission(db, id);
	if (!mission) throw new Error(`mission ${id} missing after insert`);
	return mission;
}

/** Pick `patch[key]` when explicitly provided (including null), else fall back. */
function pickField<T>(patch: T | undefined, fallback: T): T {
	return patch !== undefined ? patch : fallback;
}

function missionUpdateParams(existing: Mission, patch: MissionPatch) {
	return {
		id: existing.id,
		name: pickField(patch.name, existing.name),
		unit: pickField(patch.unit, existing.unit),
		ao_mgrs: pickField(patch.ao_mgrs, existing.ao_mgrs),
		operator: pickField(patch.operator, existing.operator),
		target: pickField(patch.target, existing.target),
		link_budget: pickField(patch.link_budget, existing.link_budget)
	};
}

/**
 * Apply a partial update to an existing mission. Only fields present in
 * `patch` are overwritten; absent fields keep their stored values. Returns
 * the merged mission, or null if the id does not exist.
 *
 * Read-merge-write so a single prepared UPDATE statement can be reused
 * regardless of which subset of fields the patch touches.
 */
export function updateMission(
	db: Database.Database,
	id: string,
	patch: MissionPatch
): Mission | null {
	const existing = getMission(db, id);
	if (!existing) return null;
	stmts(db).updateMission.run(missionUpdateParams(existing, patch));
	return getMission(db, id);
}

export function getMission(db: Database.Database, id: string): Mission | null {
	const row = stmts(db).getMission.get(id) as Record<string, unknown> | undefined;
	return row ? missionRowToMission(row) : null;
}

export function listMissions(db: Database.Database): Mission[] {
	const rows = stmts(db).listMissions.all() as Record<string, unknown>[];
	return rows.map(missionRowToMission);
}

export function deleteMission(db: Database.Database, id: string): void {
	stmts(db).deleteMission.run(id);
}

export function setActiveMission(db: Database.Database, id: string): void {
	const s = stmts(db);
	const tx = db.transaction((mid: string) => {
		s.clearActive.run();
		s.setActive.run(mid);
	});
	tx(id);
}

export function getActiveMission(db: Database.Database): Mission | null {
	const row = stmts(db).getActive.get() as Record<string, unknown> | undefined;
	return row ? missionRowToMission(row) : null;
}

export function createCapture(
	db: Database.Database,
	input: { mission_id: string; role: CaptureRole; loadout: CaptureLoadout }
): CaptureRow {
	const start_dtg = Date.now();
	const id = `c_${start_dtg}`;
	stmts(db).insertCapture.run({
		id,
		mission_id: input.mission_id,
		role: input.role,
		start_dtg,
		end_dtg: null,
		loadout_hash: hashLoadout(input.loadout),
		loadout_json: JSON.stringify(input.loadout),
		status: 'running'
	});
	const cap = getCapture(db, id);
	if (!cap) throw new Error(`capture ${id} missing after insert`);
	return cap;
}

export function stopCapture(db: Database.Database, capture_id: string, end_dtg: number): void {
	stmts(db).stopCapture.run(end_dtg, capture_id);
}

export function getCapture(db: Database.Database, id: string): CaptureRow | null {
	const row = stmts(db).getCapture.get(id) as Record<string, unknown> | undefined;
	return row ? captureRowToCapture(row) : null;
}

export function listCapturesForMission(db: Database.Database, mission_id: string): CaptureRow[] {
	const rows = stmts(db).listCapturesForMission.all(mission_id) as Record<string, unknown>[];
	return rows.map(captureRowToCapture);
}

export function getBaselineAndPosture(
	db: Database.Database,
	mission_id: string
): { baseline: CaptureRow | null; posture: CaptureRow | null } {
	const s = stmts(db);
	const b = s.getBaseline.get(mission_id) as Record<string, unknown> | undefined;
	const p = s.getPosture.get(mission_id) as Record<string, unknown> | undefined;
	return {
		baseline: b ? captureRowToCapture(b) : null,
		posture: p ? captureRowToCapture(p) : null
	};
}

function nn<T>(v: T | undefined | null): T | null {
	return v == null ? null : v;
}

function captureEmitterInsertParams(
	capture_id: string,
	r: CaptureEmitterRow
): Record<string, unknown> {
	return {
		capture_id,
		source_table: r.source_table,
		source_id: r.source_id,
		signal_type: r.signal_type,
		identifier: nn(r.identifier),
		fingerprint_key: r.fingerprint_key,
		freq_hz: nn(r.freq_hz),
		power_dbm: nn(r.power_dbm),
		modulation: nn(r.modulation),
		mgrs: nn(r.mgrs),
		classification: nn(r.classification),
		sensor_tool: nn(r.sensor_tool),
		raw_json: r.raw_json
	};
}

export function snapshotCaptureEmitters(
	db: Database.Database,
	capture_id: string,
	rows: CaptureEmitterRow[]
): void {
	const insert = stmts(db).insertCaptureEmitter;
	const tx = db.transaction((batch: CaptureEmitterRow[]) => {
		for (const r of batch) {
			insert.run(captureEmitterInsertParams(capture_id, r));
		}
	});
	tx(rows);
}

export function getCaptureEmitters(db: Database.Database, capture_id: string): CaptureEmitterRow[] {
	const rows = stmts(db).getCaptureEmitters.all(capture_id) as Record<string, unknown>[];
	return rows.map(captureEmitterRowFromDb);
}

function zz(v: number | undefined): number {
	return v ?? 0;
}

function reportInsertParams(
	id: string,
	generated_at: number,
	input: ReportInput
): Record<string, unknown> {
	return {
		id,
		mission_id: input.mission_id,
		type: input.type,
		title: input.title,
		generated_at,
		capture_ids: JSON.stringify(input.capture_ids),
		flagged_hostile: zz(input.flagged_hostile),
		flagged_suspect: zz(input.flagged_suspect),
		emitter_count: zz(input.emitter_count),
		source_qmd_path: input.source_qmd_path,
		html_path: input.html_path,
		pdf_path: nn(input.pdf_path),
		slides_html_path: nn(input.slides_html_path),
		slides_pdf_path: nn(input.slides_pdf_path)
	};
}

export function createReport(db: Database.Database, input: ReportInput): ReportRow {
	const generated_at = Date.now();
	const id = `r_${generated_at}_${slugify(input.title) || 'report'}`;
	stmts(db).insertReport.run(reportInsertParams(id, generated_at, input));
	const report = getReport(db, id);
	if (!report) throw new Error(`report ${id} missing after insert`);
	return report;
}

export function listReports(
	db: Database.Database,
	opts?: { type?: ReportType; limit?: number }
): ReportRow[] {
	const limit = opts?.limit ?? 100;
	const s = stmts(db);
	const rows = opts?.type
		? (s.listReportsByType.all(opts.type, limit) as Record<string, unknown>[])
		: (s.listReports.all(limit) as Record<string, unknown>[]);
	return rows.map(reportRowToReport);
}

export function getReport(db: Database.Database, id: string): ReportRow | null {
	const row = stmts(db).getReport.get(id) as Record<string, unknown> | undefined;
	return row ? reportRowToReport(row) : null;
}

export function deleteReport(db: Database.Database, id: string): void {
	stmts(db).deleteReport.run(id);
}
