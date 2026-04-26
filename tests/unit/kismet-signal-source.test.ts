/**
 * Unit test for the Kismet SignalSource adapter. Exercises the poll loop
 * with a fake device fetcher + in-memory RFDatabase so nothing real is
 * touched. Covers start/stop idempotency, per-device persistence, and
 * skip-on-missing-location.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RFDatabase } from '$lib/server/db/database';
import type { KismetDevice } from '$lib/server/kismet/types';
import { createKismetSignalSource } from '$lib/server/services/rf/kismet-signal-source';

function dev(overrides: Partial<KismetDevice> = {}): KismetDevice {
	return {
		mac: 'aa:bb:cc:dd:ee:01',
		macaddr: 'aa:bb:cc:dd:ee:01',
		type: 'Wi-Fi AP',
		firstSeen: Date.now() - 60_000,
		lastSeen: Date.now(),
		signal: { last_signal: -50, max_signal: -45, min_signal: -70 },
		signalStrength: -50,
		channel: 36,
		frequency: 5180,
		location: { latitude: 35, longitude: -116 },
		packets: 42,
		dataSize: 1024,
		...overrides
	};
}

describe('kismet-signal-source', () => {
	let db: RFDatabase;
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		db = new RFDatabase(':memory:');
		db.rawDb
			.prepare(`INSERT OR IGNORE INTO sessions (id, started_at, source) VALUES (?, ?, ?)`)
			.run('sess-k', Date.now(), 'manual');
		fetchSpy = vi.fn();
	});

	afterEach(() => {
		db.close();
		vi.useRealTimers();
	});

	it('polls devices on the interval and inserts one signal per device', async () => {
		fetchSpy
			.mockResolvedValueOnce([
				dev({ mac: 'aa:aa:aa:aa:aa:01', macaddr: 'aa:aa:aa:aa:aa:01' })
			])
			.mockResolvedValueOnce([
				dev({ mac: 'aa:aa:aa:aa:aa:01', macaddr: 'aa:aa:aa:aa:aa:01' }),
				dev({ mac: 'bb:bb:bb:bb:bb:02', macaddr: 'bb:bb:bb:bb:bb:02' })
			]);

		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10); // poll-on-start flush
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1050);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		await src.stop();
		const count = db.rawDb
			.prepare(`SELECT COUNT(*) as c FROM signals WHERE session_id = 'sess-k'`)
			.get() as { c: number };
		expect(count.c).toBe(3);
	});

	it('skips devices without a location fix (no lat/lon)', async () => {
		fetchSpy.mockResolvedValue([
			dev({ location: undefined }),
			dev({ mac: 'cc:cc:cc:cc:cc:03', macaddr: 'cc:cc:cc:cc:cc:03' })
		]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10);
		await src.stop();
		const count = db.rawDb
			.prepare(`SELECT COUNT(*) as c FROM signals WHERE session_id = 'sess-k'`)
			.get() as { c: number };
		expect(count.c).toBe(1);
	});

	it('reports isRunning = true while polling, false after stop', async () => {
		fetchSpy.mockResolvedValue([]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		expect(src.isRunning()).toBe(false);
		await src.start('sess-k');
		expect(src.isRunning()).toBe(true);
		await src.stop();
		expect(src.isRunning()).toBe(false);
	});

	it('start is idempotent — double-start does not stack pollers', async () => {
		fetchSpy.mockResolvedValue([]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(1100);
		// Two start() calls should still produce ONE fetch per interval, not two.
		// 1 initial + 1 tick = 2 fetches expected, not 4.
		expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(2);
		await src.stop();
	});

	it('stops cleanly if fetchDevices throws', async () => {
		fetchSpy.mockRejectedValue(new Error('network down'));
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(20);
		expect(() => src.stop()).not.toThrow();
		expect(src.isRunning()).toBe(false);
	});

	it('falls back to operator GPS when a device has no location fix', async () => {
		fetchSpy.mockResolvedValue([dev({ location: undefined })]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve({ lat: 35.5, lon: -116.5 })
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10);
		await src.stop();
		const row = db.rawDb
			.prepare(`SELECT latitude, longitude FROM signals WHERE session_id='sess-k' LIMIT 1`)
			.get() as { latitude: number; longitude: number };
		expect(row.latitude).toBeCloseTo(35.5);
		expect(row.longitude).toBeCloseTo(-116.5);
	});

	it('rejects Null-Island sentinel (lat=0, lon=0) even if reported by Kismet', async () => {
		fetchSpy.mockResolvedValue([dev({ location: { latitude: 0, longitude: 0 } })]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10);
		await src.stop();
		const count = db.rawDb
			.prepare(`SELECT COUNT(*) as c FROM signals WHERE session_id='sess-k'`)
			.get() as { c: number };
		expect(count.c).toBe(0);
	});

	it('converts Kismet frequency kHz → MHz before insertion', async () => {
		fetchSpy.mockResolvedValue([dev({ frequency: 5180000 })]); // 5.18 GHz
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10);
		await src.stop();
		const row = db.rawDb
			.prepare(`SELECT frequency FROM signals WHERE session_id='sess-k' LIMIT 1`)
			.get() as { frequency: number };
		expect(row.frequency).toBe(5180);
	});

	it('stamps every inserted signal with source=kismet', async () => {
		fetchSpy.mockResolvedValue([dev()]);
		const src = createKismetSignalSource({
			fetchDevices: fetchSpy,
			intervalMs: 1000,
			db,
			fetchFallbackGps: () => Promise.resolve(null)
		});
		await src.start('sess-k');
		await vi.advanceTimersByTimeAsync(10);
		await src.stop();
		const row = db.rawDb
			.prepare(`SELECT source FROM signals WHERE session_id = 'sess-k' LIMIT 1`)
			.get() as { source: string };
		expect(row.source).toBe('kismet');
	});
});
