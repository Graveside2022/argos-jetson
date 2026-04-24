/**
 * PR-4: mission metadata persists through session-tracker + survives round-trip.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RFDatabase } from '$lib/server/db/database';

vi.mock('$lib/server/db/database', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/db/database')>('$lib/server/db/database');
	let instance: import('$lib/server/db/database').RFDatabase | null = null;
	return {
		...actual,
		getRFDatabase: () => {
			if (!instance) instance = new actual.RFDatabase(':memory:');
			return instance;
		},
		// Explicitly export the class so the test can also construct one.
		RFDatabase: actual.RFDatabase
	};
});

import {
	getSession,
	startNewSession,
	updateSessionMetadata
} from '$lib/server/services/session/session-tracker';

describe('updateSessionMetadata', () => {
	beforeEach(() => {
		// Reset singleton so every test starts on a fresh :memory: DB.
		vi.resetModules();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	function expectAllFields(s: ReturnType<typeof getSession>): void {
		expect(s?.operatorId).toBe('op-1');
		expect(s?.assetId).toBe('asset-9');
		expect(s?.areaName).toBe('Fort Irwin NTC');
		expect(s?.notes).toBe('shakedown run');
	}

	it('saves operatorId/assetId/areaName/notes and round-trips on getSession', () => {
		const id = startNewSession('manual', 'mission-1');
		const out = updateSessionMetadata(id, {
			operatorId: 'op-1',
			assetId: 'asset-9',
			areaName: 'Fort Irwin NTC',
			notes: 'shakedown run'
		});
		expectAllFields(out);
		expectAllFields(getSession(id));
	});

	it('partial update preserves fields not mentioned in the patch', () => {
		const id = startNewSession('manual', 'mission-2');
		updateSessionMetadata(id, { operatorId: 'op-2', assetId: 'asset-1' });
		updateSessionMetadata(id, { areaName: 'Area 51' });
		const fetched = getSession(id);
		expect(fetched?.operatorId).toBe('op-2');
		expect(fetched?.assetId).toBe('asset-1');
		expect(fetched?.areaName).toBe('Area 51');
	});

	it('explicit null clears a field (operator removed)', () => {
		const id = startNewSession('manual', 'mission-3');
		updateSessionMetadata(id, { operatorId: 'op-3' });
		updateSessionMetadata(id, { operatorId: null });
		expect(getSession(id)?.operatorId).toBeNull();
	});

	it('returns null for a non-existent session id', () => {
		expect(updateSessionMetadata('no-such-id', { operatorId: 'op-x' })).toBeNull();
	});

	it('empty patch is a no-op that still returns the current session', () => {
		const id = startNewSession('manual', 'mission-5');
		const before = getSession(id);
		const out = updateSessionMetadata(id, {});
		expect(out?.id).toBe(before?.id);
	});
});

describe('RFDatabase PR-4 migration', () => {
	it('new sessions columns accept NULL for backward compat', () => {
		const db = new RFDatabase(':memory:');
		db.rawDb
			.prepare(`INSERT INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-a', Date.now(), 'manual');
		const row = db.rawDb
			.prepare('SELECT operator_id, asset_id, area_name, notes FROM sessions WHERE id = ?')
			.get('sess-a') as Record<string, unknown>;
		expect(row.operator_id).toBeNull();
		expect(row.asset_id).toBeNull();
		expect(row.area_name).toBeNull();
		expect(row.notes).toBeNull();
		db.close();
	});
});
