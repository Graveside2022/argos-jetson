/**
 * mission-store unit tests (PR5a / spec-024).
 *
 * Covers the new MissionStrip metadata round-trip:
 *   - migration 20260423_extend_missions_for_strip.sql adds operator/target/link_budget
 *   - createMission accepts and persists the new optional fields
 *   - updateMission applies a partial patch, leaving untouched fields intact
 *   - explicit `null` in a patch clears the stored value
 *   - re-applying the migration raises a duplicate-column error whose shape
 *     matches `isDuplicateColumnError()` in run-migrations.ts (so the runner
 *     can skip it on partial replay without aborting startup).
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMission, getMission, updateMission } from './mission-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../../db/migrations');
const SCHEMA_SQL = readFileSync(
	join(MIGRATIONS_DIR, '20260412_create_reports_missions.sql'),
	'utf-8'
);
const STRIP_SQL = readFileSync(
	join(MIGRATIONS_DIR, '20260423_extend_missions_for_strip.sql'),
	'utf-8'
);

function makeDb(): Database.Database {
	const db = new Database(':memory:');
	db.exec(SCHEMA_SQL);
	db.exec(STRIP_SQL);
	return db;
}

function isErrorWithCode(err: unknown): err is { code?: string; message?: string } {
	return typeof err === 'object' && err !== null && ('code' in err || 'message' in err);
}

describe('mission-store — strip metadata', () => {
	let db: Database.Database | undefined;

	beforeEach(() => {
		db = makeDb();
	});

	afterEach(() => {
		// guard against setup failure where beforeEach threw before assigning
		if (db) db.close();
		db = undefined;
	});

	function requireDb(): Database.Database {
		if (!db) throw new Error('db not initialized — beforeEach must run');
		return db;
	}

	describe('createMission', () => {
		it('persists operator/target/link_budget', () => {
			const handle = requireDb();
			const m = createMission(handle, {
				name: 'Op Aurora',
				type: 'emcon-survey',
				unit: 'A/1-75',
				ao_mgrs: '11SMS1234567890',
				operator: 'SSG Doe',
				target: 'east ridge',
				link_budget: -84.5
			});
			expect(m.operator).toBe('SSG Doe');
			expect(m.target).toBe('east ridge');
			expect(m.link_budget).toBe(-84.5);

			const fetched = getMission(handle, m.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.operator).toBe('SSG Doe');
			expect(fetched?.target).toBe('east ridge');
			expect(fetched?.link_budget).toBe(-84.5);
		});

		it('defaults new strip fields to null when omitted', () => {
			const m = createMission(requireDb(), { name: 'Op Bravo', type: 'sitrep-loop' });
			expect(m.operator).toBeNull();
			expect(m.target).toBeNull();
			expect(m.link_budget).toBeNull();
		});
	});

	describe('updateMission', () => {
		it('partial patch leaves unrelated fields intact', () => {
			const handle = requireDb();
			const m = createMission(handle, {
				name: 'Op Charlie',
				type: 'sitrep-loop',
				unit: 'B/2-3',
				operator: 'CPT Old'
			});
			const updated = updateMission(handle, m.id, { operator: 'CPT New' });
			expect(updated).not.toBeNull();
			expect(updated?.operator).toBe('CPT New');
			expect(updated?.unit).toBe('B/2-3');
			expect(updated?.name).toBe('Op Charlie');
			expect(updated?.target).toBeNull();
		});

		it('explicit null clears that field', () => {
			const handle = requireDb();
			const m = createMission(handle, {
				name: 'Op Delta',
				type: 'sitrep-loop',
				operator: 'SGT Smith',
				target: 'AO 7'
			});
			const cleared = updateMission(handle, m.id, { target: null });
			expect(cleared?.operator).toBe('SGT Smith');
			expect(cleared?.target).toBeNull();
		});

		it('rewrites name when patch.name present', () => {
			const handle = requireDb();
			const m = createMission(handle, { name: 'Op Echo', type: 'sitrep-loop' });
			const renamed = updateMission(handle, m.id, { name: 'Op Echo Renamed' });
			expect(renamed?.name).toBe('Op Echo Renamed');
			expect(renamed?.id).toBe(m.id);
		});

		it('returns null for unknown id', () => {
			const result = updateMission(requireDb(), 'm_does_not_exist', { operator: 'X' });
			expect(result).toBeNull();
		});

		it('preserves link_budget precision (REAL)', () => {
			const handle = requireDb();
			const m = createMission(handle, { name: 'Op Foxtrot', type: 'sitrep-loop' });
			const updated = updateMission(handle, m.id, { link_budget: -73.125 });
			expect(updated?.link_budget).toBe(-73.125);
		});
	});
});

describe('migration 20260423_extend_missions_for_strip idempotency contract', () => {
	it('re-applying the strip migration raises a duplicate-column error matching isDuplicateColumnError()', () => {
		const db = new Database(':memory:');
		try {
			db.exec(SCHEMA_SQL);
			db.exec(STRIP_SQL);
			let caught: unknown;
			try {
				db.exec(STRIP_SQL);
			} catch (err) {
				caught = err;
			}
			expect(caught).toBeDefined();
			expect(isErrorWithCode(caught)).toBe(true);
			if (!isErrorWithCode(caught))
				throw new Error(`unexpected error shape: ${String(caught)}`);
			expect(caught.code).toBe('SQLITE_ERROR');
			expect(String(caught.message)).toMatch(/duplicate column name/);
		} finally {
			db.close();
		}
	});
});
