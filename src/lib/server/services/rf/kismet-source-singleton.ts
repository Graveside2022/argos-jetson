/**
 * Module-scope singleton for the Kismet SignalSource adapter, lazily constructed
 * on first access so tests that never import it do not pay for the poller.
 */

import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { safe } from '$lib/server/result';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { logger } from '$lib/utils/logger';

import { createKismetSignalSource, type KismetSignalSource } from './kismet-signal-source';
import { getSignalSource, registerSignalSource } from './signal-sources';

const POLL_INTERVAL_MS = 5_000;

function isValidCoord(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n);
}

function validFix(lat: unknown, lon: unknown): lat is number {
	return isValidCoord(lat) && isValidCoord(lon) && !(lat === 0 && lon === 0);
}

function extractData(
	resp: Awaited<ReturnType<typeof getGpsPosition>>
): { latitude: number | null; longitude: number | null } | null {
	if (!resp?.success) return null;
	return resp.data ?? null;
}

function extractFix(
	resp: Awaited<ReturnType<typeof getGpsPosition>>
): { lat: number; lon: number } | null {
	const data = extractData(resp);
	if (!data || !validFix(data.latitude, data.longitude)) return null;
	return { lat: data.latitude as number, lon: data.longitude as number };
}

/**
 * Typed error class so callers (and observability) can distinguish a GPS
 * fallback failure from "no fix yet". Wraps the original error rather than
 * silently swallowing it.
 */
export class GpsFetchError extends Error {
	constructor(public readonly cause: Error) {
		super(`GPS fallback fetch failed: ${cause.message}`);
		this.name = 'GpsFetchError';
	}
}

async function fetchArgosGps(): Promise<{ lat: number; lon: number } | null> {
	const [pos, err] = await safe(() => getGpsPosition());
	if (err) {
		// Surface the original error via logger so it isn't lost; return null so
		// the adapter contract (no fix available) is preserved.
		const wrapped = new GpsFetchError(err);
		logger.warn(
			'[kismet-source-singleton] GPS fallback fetch failed',
			{ error: wrapped.message, cause: err.message },
			'kismet-gps-fallback-failed'
		);
		return null;
	}
	return extractFix(pos);
}

let instance: KismetSignalSource | null = null;

export function getKismetSignalSource(): KismetSignalSource {
	if (instance) return instance;
	instance = createKismetSignalSource({
		fetchDevices: () => KismetProxy.getDevices(),
		intervalMs: POLL_INTERVAL_MS,
		fetchFallbackGps: fetchArgosGps
	});
	// Register so `listSignalSources()` surfaces it to the UI.
	if (!getSignalSource('kismet')) registerSignalSource(instance);
	return instance;
}
