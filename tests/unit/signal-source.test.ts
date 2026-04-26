/**
 * SignalSource interface contract test.
 *
 * Every signal-producing adapter (Blue Dragon, Kismet, GSM Evil, future SDR
 * pipelines) implements this interface so the persistence + session + bus
 * plumbing is uniform. The test exercises the interface against a small
 * in-memory implementation.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { RFDatabase } from '$lib/server/db/database';
import {
	listSignalSources,
	registerSignalSource,
	type SignalSourceAdapter,
	unregisterSignalSource
} from '$lib/server/services/rf/signal-sources';
import { SignalSource } from '$lib/types/enums';
import type { SignalMarker } from '$lib/types/signals';

function mkMarker(id: string, sessionId: string): SignalMarker {
	return {
		id,
		lat: 35,
		lon: -116,
		position: { lat: 35, lon: -116 },
		altitude: 0,
		frequency: 2440,
		power: -60,
		timestamp: Date.now(),
		source: SignalSource.Kismet,
		metadata: {},
		sessionId
	};
}

describe('SignalSource registry', () => {
	afterEach(() => {
		for (const s of listSignalSources()) unregisterSignalSource(s.name);
	});

	it('registers an adapter and exposes it via listSignalSources()', () => {
		const fake: SignalSourceAdapter = {
			name: 'fake-wifi',
			start: () => Promise.resolve(),
			stop: () => Promise.resolve(),
			isRunning: () => false
		};
		registerSignalSource(fake);
		expect(listSignalSources().map((s) => s.name)).toContain('fake-wifi');
	});

	it('does NOT allow duplicate names — second register throws', () => {
		const a: SignalSourceAdapter = {
			name: 'dup',
			start: () => Promise.resolve(),
			stop: () => Promise.resolve(),
			isRunning: () => false
		};
		registerSignalSource(a);
		expect(() => registerSignalSource(a)).toThrow(/already registered/);
	});

	it('unregister() removes the named adapter', () => {
		const a: SignalSourceAdapter = {
			name: 'removable',
			start: () => Promise.resolve(),
			stop: () => Promise.resolve(),
			isRunning: () => false
		};
		registerSignalSource(a);
		unregisterSignalSource('removable');
		expect(listSignalSources().map((s) => s.name)).not.toContain('removable');
	});

	it('adapter start() calls insertSignal with the provided session', async () => {
		const db = new RFDatabase(':memory:');
		db.rawDb
			.prepare(`INSERT OR IGNORE INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-x', Date.now(), 'manual');
		let running = false;
		const adapter: SignalSourceAdapter = {
			name: 'inline-test',
			start: (sessionId) => {
				running = true;
				db.insertSignal(mkMarker('inline-1', sessionId));
				return Promise.resolve();
			},
			stop: () => {
				running = false;
				return Promise.resolve();
			},
			isRunning: () => running
		};
		registerSignalSource(adapter);
		await adapter.start('sess-x');
		expect(adapter.isRunning()).toBe(true);
		const row = db.rawDb
			.prepare('SELECT session_id FROM signals WHERE signal_id = ?')
			.get('inline-1') as { session_id: string } | undefined;
		expect(row?.session_id).toBe('sess-x');
		await adapter.stop();
		expect(adapter.isRunning()).toBe(false);
		db.close();
	});
});
