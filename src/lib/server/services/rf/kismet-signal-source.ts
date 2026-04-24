/**
 * Kismet → rf_signals.db bridge.
 *
 * Polls the Kismet proxy on a cadence, converts each device observation to
 * a `SignalMarker`, stamps the active session id, and inserts via the
 * `RFDatabase` facade. Every successful insert fans out on the SignalBus
 * (see database.ts) so the dashboard's SSE stream delivers the event.
 *
 * Prior to this adapter, starting Kismet created a session row but no
 * Kismet signals landed in `rf_signals.db` server-side — only an external
 * pusher hitting /api/signals/batch could populate that session. This
 * closes that gap for the Flying-Squirrel live-refresh flow.
 */

import { randomUUID } from 'node:crypto';

import { getRFDatabase, type RFDatabase } from '$lib/server/db/database';
import type { KismetDevice } from '$lib/server/kismet/types';
import { SignalSource } from '$lib/types/enums';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

import type { SignalSourceAdapter } from './signal-sources';

export interface KismetSignalSourceDeps {
	/** Injectable device fetch so tests don't need a live Kismet. */
	fetchDevices: () => Promise<KismetDevice[]>;
	/** Poll cadence in ms. Real usage: 5000. Tests: 1000. */
	intervalMs: number;
	/** Injectable DB so tests can use an in-memory handle. Prod uses the singleton. */
	db?: RFDatabase;
}

export interface KismetSignalSource extends SignalSourceAdapter {
	readonly name: 'kismet';
}

interface LocatedDevice extends KismetDevice {
	location: { latitude: number; longitude: number; accuracy?: number };
}

function isLocated(d: KismetDevice): d is LocatedDevice {
	return (
		!!d.location &&
		typeof d.location.latitude === 'number' &&
		typeof d.location.longitude === 'number'
	);
}

function deviceDbm(d: KismetDevice): number {
	return d.signal?.last_signal ?? d.signalStrength ?? 0;
}

function deviceToMarker(d: LocatedDevice, sessionId: string): SignalMarker {
	const { latitude: lat, longitude: lon } = d.location;
	return {
		id: `kismet:${d.mac}:${randomUUID()}`,
		lat,
		lon,
		position: { lat, lon },
		altitude: 0,
		frequency: d.frequency ?? 0,
		power: deviceDbm(d),
		timestamp: Date.now(),
		source: SignalSource.Kismet,
		metadata: {
			mac: d.mac,
			ssid: d.ssid,
			channel: d.channel,
			encryption: d.encryptionType ?? d.encryption,
			manufacturer: d.manufacturer
		} as SignalMarker['metadata'],
		sessionId
	};
}

export function createKismetSignalSource(deps: KismetSignalSourceDeps): KismetSignalSource {
	let timer: ReturnType<typeof setInterval> | null = null;
	let running = false;
	let activeSession: string | null = null;

	function persistDevice(db: RFDatabase, d: LocatedDevice, sid: string): void {
		try {
			db.insertSignal(deviceToMarker(d, sid));
		} catch (err) {
			logger.debug(
				'[kismet-source] insert failed',
				{ error: String(err) },
				'kismet-source-insert-failed'
			);
		}
	}

	async function fetchAndPersist(sid: string): Promise<void> {
		const devices = await deps.fetchDevices();
		const db = deps.db ?? getRFDatabase();
		for (const d of devices) if (isLocated(d)) persistDevice(db, d, sid);
	}

	async function pollOnce(): Promise<void> {
		if (!activeSession) return;
		try {
			await fetchAndPersist(activeSession);
		} catch (err) {
			logger.debug(
				'[kismet-source] fetch failed',
				{ error: String(err) },
				'kismet-source-fetch-failed'
			);
		}
	}

	return {
		name: 'kismet',
		isRunning: () => running,
		start(sessionId: string): Promise<void> {
			if (running) return Promise.resolve();
			running = true;
			activeSession = sessionId;
			void pollOnce();
			timer = setInterval(() => {
				void pollOnce();
			}, deps.intervalMs);
			return Promise.resolve();
		},
		stop(): Promise<void> {
			running = false;
			activeSession = null;
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
			return Promise.resolve();
		}
	};
}
