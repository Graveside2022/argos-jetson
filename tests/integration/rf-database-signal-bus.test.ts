/**
 * End-to-end integration: inserting a signal through the RFDatabase facade
 * fans out on the SignalBus. Covers both the single-insert hot path used
 * by Blue Dragon persistence and the batch path used by `/api/signals/batch`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RFDatabase } from '$lib/server/db/database';
import {
	getSignalBus,
	type ObservationEvent,
	resetSignalBusForTests
} from '$lib/server/services/rf/signal-bus';
import { SignalSource } from '$lib/types/enums';
import type { SignalMarker } from '$lib/types/signals';

function makeMarker(overrides: Partial<SignalMarker> = {}): SignalMarker {
	return {
		id: `test-${Math.random().toString(36).slice(2, 10)}`,
		lat: 35.0,
		lon: -116.0,
		position: { lat: 35.0, lon: -116.0 },
		altitude: 0,
		frequency: 2440,
		power: -60,
		timestamp: Date.now(),
		source: SignalSource.BlueDragon,
		metadata: { addr: 'aa:bb:cc:dd:ee:ff' },
		sessionId: 'sess-test',
		...overrides
	};
}

describe('RFDatabase → SignalBus', () => {
	let db: RFDatabase;

	beforeEach(() => {
		resetSignalBusForTests();
		db = new RFDatabase(':memory:');
		db.rawDb
			.prepare(`INSERT OR IGNORE INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-test', Date.now(), 'manual');
		db.rawDb
			.prepare(`INSERT OR IGNORE INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-A', Date.now(), 'manual');
		db.rawDb
			.prepare(`INSERT OR IGNORE INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-B', Date.now(), 'manual');
	});

	afterEach(() => {
		db.close();
		resetSignalBusForTests();
	});

	it('emits one observation per insertSignal call', () => {
		const received: ObservationEvent[] = [];
		getSignalBus().subscribe({}, (e) => received.push(e));
		const marker = makeMarker({ id: 'emit-test-1' });
		db.insertSignal(marker);
		expect(received).toHaveLength(1);
		expect(received[0].signalId).toBe('emit-test-1');
		expect(received[0].sessionId).toBe('sess-test');
		expect(received[0].dbm).toBe(-60);
	});

	it('emits one observation per row in insertSignalsBatch', () => {
		const received: ObservationEvent[] = [];
		getSignalBus().subscribe({}, (e) => received.push(e));
		const markers = [
			makeMarker({ id: 'batch-1' }),
			makeMarker({ id: 'batch-2' }),
			makeMarker({ id: 'batch-3' })
		];
		db.insertSignalsBatch(markers);
		expect(received).toHaveLength(3);
		expect(received.map((e) => e.signalId).sort()).toEqual(['batch-1', 'batch-2', 'batch-3']);
	});

	it('subscriber exceptions do not fail the insert', () => {
		getSignalBus().subscribe({}, () => {
			throw new Error('bus listener boom');
		});
		expect(() => db.insertSignal(makeMarker({ id: 'resilient' }))).not.toThrow();
	});

	it('sessionId filter selects only matching inserts', () => {
		const received: ObservationEvent[] = [];
		getSignalBus().subscribe({ sessionId: 'sess-A' }, (e) => received.push(e));
		db.insertSignal(makeMarker({ id: 'in', sessionId: 'sess-A' }));
		db.insertSignal(makeMarker({ id: 'out', sessionId: 'sess-B' }));
		expect(received).toHaveLength(1);
		expect(received[0].signalId).toBe('in');
	});
});
