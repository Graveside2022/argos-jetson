/**
 * Module-scope singleton for the Kismet SignalSource adapter, lazily constructed
 * on first access so tests that never import it do not pay for the poller.
 */

import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';

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

async function fetchArgosGps(): Promise<{ lat: number; lon: number } | null> {
	try {
		return extractFix(await getGpsPosition());
	} catch {
		return null;
	}
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
