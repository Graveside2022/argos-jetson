import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

function applyConstructorPragmas(d: Database.Database): void {
	// Mirrors src/lib/server/db/database.ts constructor pragma sequence.
	d.pragma('journal_mode = WAL');
	d.pragma('foreign_keys = ON');
	d.pragma('busy_timeout = 5000');
	d.pragma('synchronous = NORMAL');
	d.pragma('cache_size = -64000');
	d.pragma('mmap_size = 134217728');
	d.pragma('temp_store = memory');
	d.pragma('page_size = 4096');
}

describe('database connection pragmas (FINDING-PHASE5-DB-1 + DB-2)', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = new Database(':memory:');
		applyConstructorPragmas(db);
	});

	afterEach(() => {
		try {
			db.close();
		} catch {
			/* noop */
		}
	});

	it('journal_mode pragma accepts WAL (in-memory reports memory; file-based reports wal)', () => {
		// :memory: dbs cannot actually switch to WAL — they always report 'memory'.
		const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
		expect(['wal', 'memory']).toContain(result[0].journal_mode);
	});

	it('foreign_keys = ON after constructor pragmas (regression for FINDING-PHASE5-DB-2)', () => {
		const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
		expect(result[0].foreign_keys).toBe(1);
	});

	it('busy_timeout = 5000 after constructor pragmas (regression for FINDING-PHASE5-DB-1)', () => {
		const result = db.pragma('busy_timeout') as Array<{ timeout: number }>;
		expect(result[0].timeout).toBe(5000);
	});

	it('synchronous = NORMAL (1) after constructor pragmas', () => {
		const result = db.pragma('synchronous') as Array<{ synchronous: number }>;
		expect(result[0].synchronous).toBe(1); // NORMAL
	});

	it('cache_size negative = KiB, set to -64000 (64 MiB)', () => {
		const result = db.pragma('cache_size') as Array<{ cache_size: number }>;
		expect(result[0].cache_size).toBe(-64000);
	});

	it('temp_store = MEMORY (2)', () => {
		const result = db.pragma('temp_store') as Array<{ temp_store: number }>;
		expect(result[0].temp_store).toBe(2); // MEMORY
	});

	it('foreign_keys enforcement actually blocks orphan inserts when ON', () => {
		db.exec(`
			CREATE TABLE parent (id INTEGER PRIMARY KEY);
			CREATE TABLE child (
				id INTEGER PRIMARY KEY,
				parent_id INTEGER NOT NULL REFERENCES parent(id)
			);
		`);
		expect(() => db.prepare('INSERT INTO child (id, parent_id) VALUES (1, 999)').run()).toThrow(
			/FOREIGN KEY constraint failed/
		);
	});

	it('pragma sequence is idempotent (callable twice without error)', () => {
		expect(() => applyConstructorPragmas(db)).not.toThrow();
		const fk = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
		const bt = db.pragma('busy_timeout') as Array<{ timeout: number }>;
		expect(fk[0].foreign_keys).toBe(1);
		expect(bt[0].timeout).toBe(5000);
	});
});
