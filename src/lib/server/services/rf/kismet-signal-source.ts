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
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
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
	/**
	 * Optional fallback GPS fetch. When Kismet reports a device without a
	 * location (or the sentinel 0,0), the adapter stamps the observation
	 * with the operator's current position instead. Prod default: the
	 * Argos GPS service; tests inject a stub.
	 */
	fetchFallbackGps?: () => Promise<{ lat: number; lon: number } | null>;
}

export interface KismetSignalSource extends SignalSourceAdapter {
	readonly name: 'kismet';
}

interface LocatedDevice extends KismetDevice {
	location: { latitude: number; longitude: number; accuracy?: number };
}

function finiteNumber(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n);
}

function validLatLon(lat: unknown, lon: unknown): boolean {
	return finiteNumber(lat) && finiteNumber(lon) && !(lat === 0 && lon === 0);
}

function extractGpsData(
	resp: Awaited<ReturnType<typeof getGpsPosition>>
): { latitude: number | null; longitude: number | null } | null {
	if (!resp?.success) return null;
	return resp.data ?? null;
}

async function defaultArgosGps(): Promise<{ lat: number; lon: number } | null> {
	try {
		const data = extractGpsData(await getGpsPosition());
		if (!data || !validLatLon(data.latitude, data.longitude)) return null;
		return { lat: data.latitude as number, lon: data.longitude as number };
	} catch {
		return null;
	}
}

function isLocated(d: KismetDevice): d is LocatedDevice {
	return !!d.location && validLatLon(d.location.latitude, d.location.longitude);
}

function deviceDbm(d: KismetDevice): number {
	return d.signal?.last_signal ?? d.signalStrength ?? 0;
}

function deviceToMarker(d: LocatedDevice, sessionId: string): SignalMarker {
	const { latitude: lat, longitude: lon } = d.location;
	// Kismet reports `kismet.device.base.frequency` in kHz; DbSignalSchema
	// validates MHz (max 6000). Convert and clamp so a 5 GHz WiFi device
	// doesn't fail Zod with "Must be <= 6000".
	const freqMHz = Math.min(6000, Math.max(1, Math.round((d.frequency ?? 0) / 1000)));
	return {
		id: `kismet:${d.mac}:${randomUUID()}`,
		lat,
		lon,
		position: { lat, lon },
		altitude: 0,
		frequency: freqMHz,
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

	async function getFallbackGps(): Promise<{ lat: number; lon: number } | null> {
		if (deps.fetchFallbackGps) return deps.fetchFallbackGps();
		return defaultArgosGps();
	}

	function withFallback(
		d: KismetDevice,
		gps: { lat: number; lon: number } | null
	): LocatedDevice | null {
		if (isLocated(d)) return d;
		if (!gps) return null;
		return { ...d, location: { latitude: gps.lat, longitude: gps.lon } };
	}

	async function fetchAndPersist(sid: string): Promise<void> {
		const devices = await deps.fetchDevices();
		const db = deps.db ?? getRFDatabase();
		const gps = await getFallbackGps();
		for (const d of devices) {
			const located = withFallback(d, gps);
			if (located) persistDevice(db, located, sid);
		}
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
