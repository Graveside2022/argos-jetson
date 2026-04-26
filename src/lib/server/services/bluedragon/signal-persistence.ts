/**
 * Persist BLE/Classic frame observations into the shared signals table so
 * the Flying-Squirrel-style heatmap / centroid / path layers can aggregate
 * them alongside Kismet WiFi data.
 *
 * GPS is polled on a 2s cadence and cached synchronously — frame ingest is
 * hot and must not block on gpsd. Frames arriving before a GPS fix are
 * dropped from the signals table (but still reach the live-device store).
 */

import { randomUUID } from 'node:crypto';

import { getRFDatabase } from '$lib/server/db/database';
import { SignalSource } from '$lib/types/enums';
import type { Position, SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

import { getGpsPosition } from '../gps/gps-position-service';
import { getCurrentSessionId } from '../session/session-tracker';
import type { FrameObservation } from './device-aggregator';

const GPS_POLL_INTERVAL_MS = 2_000;
const BLE_BAND_CENTER_MHZ = 2440; // 2.4 GHz band — BLE channel index isn't in FrameObservation today

interface GpsCache {
	lat: number;
	lon: number;
	altitude?: number;
	satellites?: number;
	fetchedAt: number;
}

export interface PersistenceHandle {
	pollTimer: ReturnType<typeof setInterval> | null;
	cache: GpsCache | null;
}

function initHandle(): PersistenceHandle {
	return { pollTimer: null, cache: null };
}

function validGpsFix(data: {
	latitude: number | null;
	longitude: number | null;
}): data is { latitude: number; longitude: number } {
	return typeof data.latitude === 'number' && typeof data.longitude === 'number';
}

function applyGpsFix(
	handle: PersistenceHandle,
	data: {
		latitude: number;
		longitude: number;
		altitude: number | null;
		satellites: number | null;
	}
): void {
	handle.cache = {
		lat: data.latitude,
		lon: data.longitude,
		altitude: data.altitude ?? undefined,
		satellites: data.satellites ?? undefined,
		fetchedAt: Date.now()
	};
}

async function refreshGps(handle: PersistenceHandle): Promise<void> {
	try {
		const resp = await getGpsPosition();
		if (!resp.success || !resp.data) return;
		if (!validGpsFix(resp.data)) return;
		applyGpsFix(handle, resp.data);
	} catch (err) {
		logger.debug(
			'[bluedragon-persistence] GPS fetch failed',
			{ error: String(err) },
			'bluedragon-gps-fetch-failed'
		);
	}
}

/** Start periodic GPS polling; returns an opaque handle to pass to buildPersistCallback. */
export function startGpsPoll(): PersistenceHandle {
	const handle = initHandle();
	void refreshGps(handle);
	handle.pollTimer = setInterval(() => {
		void refreshGps(handle);
	}, GPS_POLL_INTERVAL_MS);
	return handle;
}

export function stopGpsPoll(handle: PersistenceHandle | null): void {
	if (!handle?.pollTimer) return;
	clearInterval(handle.pollTimer);
	handle.pollTimer = null;
	handle.cache = null;
}

function frameToSignalMarker(
	frame: FrameObservation,
	addr: string,
	gps: GpsCache,
	sessionId: string
): SignalMarker | null {
	if (frame.rssi == null) return null;
	const position: Position = { lat: gps.lat, lon: gps.lon };
	return {
		id: `bd:${randomUUID()}`,
		lat: gps.lat,
		lon: gps.lon,
		altitude: gps.altitude,
		position,
		frequency: BLE_BAND_CENTER_MHZ,
		power: frame.rssi,
		timestamp: frame.timestamp,
		source: SignalSource.BlueDragon,
		metadata: {
			addr,
			bdClassic: frame.bdClassic,
			phyFlag: frame.phyFlag ?? undefined,
			localName: frame.localName ?? undefined
		},
		sessionId
	};
}

/**
 * Build a frame-persist callback suitable for DeviceAggregator's `persistFrame`.
 * The callback is sync and fire-and-forget: insertion errors are swallowed and
 * logged so a transient DB issue never crashes the capture pipeline.
 */
export function buildPersistCallback(
	handle: PersistenceHandle
): (frame: FrameObservation, addr: string) => void {
	return (frame, addr) => {
		const gps = handle.cache;
		if (!gps) return;
		if (frame.rssi == null) return;
		const sessionId = getCurrentSessionId();
		const marker = frameToSignalMarker(frame, addr, gps, sessionId);
		if (!marker) return;
		try {
			getRFDatabase().insertSignal(marker);
		} catch (err) {
			logger.debug(
				'[bluedragon-persistence] insertSignal failed',
				{ error: String(err), addr },
				'bluedragon-persist-failed'
			);
		}
	};
}
