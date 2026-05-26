import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { errorMock, infoMock, startMock, initializeMock, stopMock } = vi.hoisted(() => ({
	errorMock: vi.fn(),
	infoMock: vi.fn(),
	startMock: vi.fn(),
	initializeMock: vi.fn(),
	stopMock: vi.fn()
}));

vi.mock('$lib/server/env', () => ({
	env: {
		ARGOS_WAL_CHECKPOINT_INTERVAL_MS: 60_000
	}
}));

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: infoMock,
		warn: vi.fn(),
		error: errorMock,
		debug: vi.fn()
	}
}));

// Stub the cleanup-service module so we can make start() throw.
vi.mock('./cleanup-service', () => ({
	DatabaseCleanupService: vi.fn().mockImplementation(() => ({
		initialize: initializeMock,
		start: startMock,
		stop: stopMock
	}))
}));

// Stub migrations so we don't depend on the on-disk migrations folder.
vi.mock('./migrations/run-migrations', () => ({
	runMigrations: vi.fn().mockResolvedValue(undefined)
}));

import { RFDatabase } from './database';

describe('RFDatabase cleanup service init — FINDING-7', () => {
	beforeEach(() => {
		startMock.mockReset();
		initializeMock.mockReset();
		stopMock.mockReset();
		errorMock.mockClear();
		infoMock.mockClear();
	});

	afterEach(() => {
		// Clear the globalThis singleton between tests so each one constructs a
		// fresh RFDatabase against the stubbed cleanup-service.
		globalThis.__argos_rfdatabase = undefined;
	});

	it('exposes getCleanupService() === null when start() throws', () => {
		startMock.mockImplementation(() => {
			throw new Error('boom');
		});
		const db = new RFDatabase(':memory:');
		expect(db.getCleanupService()).toBeNull();
		expect(errorMock).toHaveBeenCalledWith(
			'Failed to initialize cleanup service',
			expect.objectContaining({ error: expect.any(Error) }),
			'cleanup-service-init-failed'
		);
		db.close();
	});

	it('calls stop() on the partially-initialized service when start() throws', () => {
		startMock.mockImplementation(() => {
			throw new Error('start fail');
		});
		const db = new RFDatabase(':memory:');
		expect(stopMock).toHaveBeenCalledTimes(1);
		expect(db.getCleanupService()).toBeNull();
		db.close();
	});

	it('exposes the cleanup service when initialize+start succeed', () => {
		startMock.mockImplementation(() => undefined);
		initializeMock.mockImplementation(() => undefined);
		const db = new RFDatabase(':memory:');
		expect(db.getCleanupService()).not.toBeNull();
		expect(infoMock).toHaveBeenCalledWith(
			'Database cleanup service started',
			{},
			'cleanup-service-started'
		);
		db.close();
	});
});
