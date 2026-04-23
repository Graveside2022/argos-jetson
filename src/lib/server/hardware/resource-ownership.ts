/**
 * Pure ownership reconciliation — no I/O, no shared state. Operates on a
 * single `ResourceState` row; callers in `resource-refresh` compose these
 * with the live scan data.
 *
 * Why a separate module: `resource-manager.ts` was a 376-LOC god class.
 * The "given new owner/containers, update state row" logic is the purest
 * seam in the file and splits out cleanly without touching the class API.
 *
 * @module
 */

import { canonicalizeWebRxOwner } from './hackrf-owner-aliases';
import type { ResourceState } from './types';

/**
 * Canonical tool names used when a service calls `acquire(toolName, device)`.
 * When the background refresh scan detects a live process or container on the
 * device, we compare the current owner against this set: if the owner is a
 * known tool name (from an explicit acquire()), we preserve it instead of
 * overwriting with the container/process name from the scan. This keeps the
 * status endpoint's `owner` field stable as 'novasdr' / 'openwebrx' / etc.
 * rather than drifting to 'novasdr-hackrf' / 'GSM Evil' / etc. on each tick.
 */
const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set([
	'openwebrx',
	'novasdr',
	'gsm-evil',
	'kismet',
	'kismet-wifi',
	'bluehood',
	'spiderfoot',
	'sightline',
	'pagermon',
	'sdrpp',
	'sparrow-wifi',
	'wardragon-fpv-detect',
	'uas-scanner',
	'c2-scanner'
]);

/**
 * True when the current app-level owner should be preserved across a
 * refresh tick instead of being overwritten by the scanned process/
 * container name. See KNOWN_TOOL_NAMES for rationale.
 */
export function shouldPreserveExplicitOwner(
	state: ResourceState,
	ownerName: string | null
): boolean {
	return (
		ownerName !== null &&
		state.owner !== null &&
		state.owner !== ownerName &&
		KNOWN_TOOL_NAMES.has(state.owner)
	);
}

/** Mark the device as held; preserve existing connectedSince if set. */
export function markOwned(state: ResourceState, ownerName: string): void {
	state.owner = ownerName;
	state.isAvailable = false;
	if (!state.connectedSince) state.connectedSince = Date.now();
}

/** Clear all ownership fields on the device. */
export function markFree(state: ResourceState): void {
	state.owner = null;
	state.isAvailable = true;
	state.connectedSince = null;
}

/**
 * A freshly-claimed known tool may not yet appear in the OS scan
 * (process hasn't spawned, container still pulling, docker daemon
 * slow to enumerate). Preserve the explicit owner this long before
 * trusting a null OS scan to mean "gone". After the window expires,
 * the scheduled refresh resumes normal "scan says gone → markFree"
 * semantics, so truly-crashed tools still get reclaimed.
 */
const OWNER_PRESERVE_GRACE_MS = 10_000;

function isFreshKnownOwner(state: ResourceState): boolean {
	if (!state.owner) return false;
	if (!KNOWN_TOOL_NAMES.has(state.owner)) return false;
	if (state.connectedSince === null) return false;
	return Date.now() - state.connectedSince < OWNER_PRESERVE_GRACE_MS;
}

function preserveExplicit(state: ResourceState): void {
	state.isAvailable = false;
	if (!state.connectedSince) state.connectedSince = Date.now();
}

function applyNullScan(state: ResourceState): void {
	if (isFreshKnownOwner(state)) return;
	if (state.owner) markFree(state);
}

export function applyOwnership(state: ResourceState, ownerName: string | null): void {
	if (shouldPreserveExplicitOwner(state, ownerName)) return preserveExplicit(state);
	if (ownerName) return markOwned(state, ownerName);
	applyNullScan(state);
}

export function resolveHackrfOwner(
	processes: { name: string }[],
	containers: { isRunning: boolean; name: string }[]
): string | null {
	const raw = processes.length > 0 ? processes[0].name : null;
	if (raw) return canonicalizeWebRxOwner(raw);
	const running = containers.find((c) => c.isRunning);
	return running ? canonicalizeWebRxOwner(running.name) : null;
}
