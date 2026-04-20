/**
 * DragonSync HTTP API poller. Fetches `/drones` + `/signals` every
 * POLL_INTERVAL_MS, normalises into cached state, and exposes lifecycle
 * start/stop plus a one-shot reachability probe.
 *
 * @module
 */

import type { DragonSyncDrone, DragonSyncFpvSignal } from '$lib/types/dragonsync';
import { logger } from '$lib/utils/logger';

import { setCachedDrones, setCachedFpv, setLastPollError } from './state';

const DRAGONSYNC_API = 'http://127.0.0.1:8088';
const POLL_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 5000;
const STATUS_TIMEOUT_MS = 6000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

function isDroneTrack(item: unknown): item is DragonSyncDrone {
	if (typeof item !== 'object' || item === null) return false;
	const rec = item as Record<string, unknown>;
	return rec['track_type'] === 'drone';
}

function isFpvSignal(item: unknown): item is DragonSyncFpvSignal {
	if (typeof item !== 'object' || item === null) return false;
	const rec = item as Record<string, unknown>;
	return typeof rec['uid'] === 'string';
}

async function pollDronesEndpoint(): Promise<void> {
	const res = await fetch(`${DRAGONSYNC_API}/drones`, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		setLastPollError(`HTTP ${res.status}`);
		return;
	}
	const data: unknown = await res.json();
	const rawDrones = (data as { drones?: unknown[] }).drones ?? [];
	setCachedDrones(rawDrones.filter(isDroneTrack));
}

async function pollSignalsEndpoint(): Promise<void> {
	const res = await fetch(`${DRAGONSYNC_API}/signals`, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) {
		logger.debug(`[dragonsync] /signals returned HTTP ${res.status}`);
		return;
	}
	const data: unknown = await res.json();
	const rawSignals = (data as { signals?: unknown[] }).signals ?? [];
	setCachedFpv(rawSignals.filter(isFpvSignal));
}

async function pollDragonSyncApi(): Promise<void> {
	try {
		await Promise.all([pollDronesEndpoint(), pollSignalsEndpoint()]);
		setLastPollError(null);
	} catch (err) {
		setLastPollError(err instanceof Error ? err.message : 'poll failed');
	}
}

/** One-shot reachability probe — used by `getDragonSyncStatus`. */
export async function checkApiReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${DRAGONSYNC_API}/drones`, {
			signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
		});
		return res.ok;
	} catch {
		return false;
	}
}

export function startDragonSyncPoller(): void {
	if (pollTimer) return;
	logger.info('[dragonsync] Starting API poller (2s interval)');
	void pollDragonSyncApi();
	pollTimer = setInterval(() => void pollDragonSyncApi(), POLL_INTERVAL_MS);
}

export function stopDragonSyncPoller(): void {
	if (!pollTimer) return;
	logger.info('[dragonsync] Stopping API poller');
	clearInterval(pollTimer);
	pollTimer = null;
}
