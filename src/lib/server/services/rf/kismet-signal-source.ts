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

import { getRFDatabaseReady, type RFDatabase } from '$lib/server/db/database';
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
	 *
	 * Returns either a bare position (legacy contract) OR a Result tuple
	 * `[fix | null, Error | null]` so callers can surface fetch errors
	 * separately from "no fix yet". A bare-null/position return is treated
	 * as `[value, null]` for back-compat with existing test stubs.
	 */
	fetchFallbackGps?: () => Promise<
		{ lat: number; lon: number } | null | [{ lat: number; lon: number } | null, Error | null]
	>;
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

/**
 * Convert Kismet's kHz frequency to MHz, clamping into the DbSignalSchema
 * window (1..6000 MHz). Returns `null` when the device reports no frequency
 * — callers should drop the observation instead of synthesizing a 1 MHz
 * value that misrepresents an unknown frequency.
 */
function kismetFrequencyMHz(d: KismetDevice): number | null {
	const raw = d.frequency;
	if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
	return Math.min(6000, Math.max(1, Math.round(raw / 1000)));
}

function deviceToMarker(d: LocatedDevice, freqMHz: number, sessionId: string): SignalMarker {
	const { latitude: lat, longitude: lon } = d.location;
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
		const freqMHz = kismetFrequencyMHz(d);
		if (freqMHz === null) {
			// Drop observations with unknown frequency rather than fabricating
			// a misleading 1 MHz placeholder.
			logger.debug(
				'[kismet-source] dropping device — unknown frequency',
				{ mac: d.mac },
				'kismet-source-unknown-frequency'
			);
			return;
		}
		try {
			db.insertSignal(deviceToMarker(d, freqMHz, sid));
		} catch (err) {
			logger.debug(
				'[kismet-source] insert failed',
				{ error: String(err) },
				'kismet-source-insert-failed'
			);
		}
	}

	async function getFallbackGps(): Promise<{ lat: number; lon: number } | null> {
		if (!deps.fetchFallbackGps) return defaultArgosGps();
		const result = await deps.fetchFallbackGps();
		// Result-tuple contract `[fix, error]` — log the error so a GPS service
		// outage is visible, then return the fix (which may itself be null).
		if (Array.isArray(result)) {
			const [fix, err] = result;
			if (err) {
				logger.debug(
					'[kismet-source] fallback GPS error surfaced',
					{ error: err.message },
					'kismet-source-fallback-gps-error'
				);
			}
			return fix;
		}
		// Legacy bare-value contract.
		return result;
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
		// Block on `ready()` so migration 006 (session_id column) has finished
		// before we attempt to insert. Without this gate the very first poll
		// after process boot can race the migration and fail with
		// "table signals has no column named session_id".
		const db = deps.db ?? (await getRFDatabaseReady());
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
