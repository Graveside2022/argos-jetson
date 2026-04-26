import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseCleanupService } from './cleanup-service';

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	}
}));

vi.mock('./cleanup-aggregation', () => ({
	runAggregation: vi.fn(),
	exportAggregatedData: vi.fn(),
	cleanupAggregatedData: vi.fn()
}));

vi.mock('./cleanup-statements', () => ({
	prepareCleanupStatements: vi.fn(() => new Map())
}));

function makeService(db: Database.Database, walMs = 1_000): DatabaseCleanupService {
	const service = new DatabaseCleanupService(db, {
		walCheckpointInterval: walMs,
		cleanupInterval: 10 * 60 * 1000,
		aggregateInterval: 10 * 60 * 1000
	});
	// start() eagerly fires runCleanup+runAggregation; stub them so only the
	// WAL timer path is exercised by these tests.
	vi.spyOn(service, 'runCleanup').mockImplementation(() => ({
		signals: 0,
		devices: 0,
		relationships: 0,
		patterns: 0,
		duration: 0
	}));
	vi.spyOn(service, 'runAggregation').mockImplementation(() => undefined);
	return service;
}

describe('DatabaseCleanupService WAL checkpoint', () => {
	let db: Database.Database;
	let service: DatabaseCleanupService | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		db = new Database(':memory:');
		db.pragma('journal_mode = WAL');
	});

	afterEach(() => {
		service?.stop();
		try {
			db.close();
		} catch {
			/* noop */
		}
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('fires PRAGMA wal_checkpoint on the configured interval', () => {
		const pragmaSpy = vi.spyOn(db, 'pragma');
		service = makeService(db, 1_000);
		service.start();

		pragmaSpy.mockClear();
		vi.advanceTimersByTime(1_000);

		expect(pragmaSpy).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
	});

	it('swallows errors thrown by the pragma call', () => {
		vi.spyOn(db, 'pragma').mockImplementation(() => {
			throw new Error('simulated SQLITE_BUSY');
		});
		service = makeService(db, 1_000);
		service.start();

		expect(() => vi.advanceTimersByTime(1_000)).not.toThrow();
	});

	it('clears the WAL timer on stop()', () => {
		service = makeService(db, 1_000);
		service.start();

		const pragmaSpy = vi.spyOn(db, 'pragma');
		service.stop();
		pragmaSpy.mockClear();

		vi.advanceTimersByTime(5_000);

		expect(pragmaSpy).not.toHaveBeenCalled();
	});

	it('logs WARN when the pragma reports busy=1', async () => {
		const { logger } = await import('$lib/utils/logger');
		vi.spyOn(db, 'pragma').mockReturnValue([{ busy: 1, log: 0, checkpointed: 0 }]);

		service = makeService(db, 1_000);
		service.start();

		vi.advanceTimersByTime(1_000);

		expect(logger.warn).toHaveBeenCalledWith(
			'WAL checkpoint skipped: writer active',
			expect.objectContaining({ row: { busy: 1, log: 0, checkpointed: 0 } }),
			'wal-checkpoint-busy'
		);
	});
});
