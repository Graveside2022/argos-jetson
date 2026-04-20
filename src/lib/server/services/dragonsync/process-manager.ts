/**
 * DragonSync + droneid-go process manager.
 *
 * Manages two EXTERNAL systemd services (zmq-decoder.service, dragonsync.service).
 * Argos does NOT spawn these processes — it starts/stops them via systemctl
 * and polls the DragonSync HTTP API for drone detections.
 *
 * @module
 */

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type {
	DragonSyncC2Signal,
	DragonSyncControlResult,
	DragonSyncDrone,
	DragonSyncFpvSignal,
	DragonSyncServiceStatus,
	DragonSyncStatusResult
} from '$lib/types/dragonsync';
import { logger } from '$lib/utils/logger';

const FPV_OWNER = 'wardragon-fpv-detect';
const C2_OWNER = 'c2-scanner';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const DRAGONSYNC_API = 'http://127.0.0.1:8088';
const POLL_INTERVAL_MS = 2000;
const FETCH_TIMEOUT_MS = 5000;
const STATUS_TIMEOUT_MS = 6000;

const ZMQ_DECODER_SERVICE = 'zmq-decoder.service';
const DRAGONSYNC_SERVICE = 'dragonsync.service';
const FPV_SERVICE = 'wardragon-fpv-detect.service';
const C2_SERVICE = 'argos-c2-scanner.service';

// C2 subscriber — Argos server-side ZMQ SUB via a tiny Python helper.
// Node has no ZMQ client in deps; spawning the helper avoids adding zeromq.js.
// Fixed path: installed by scripts/ops/install-dragonsync.sh alongside c2_scan.py.
// (Cannot use import.meta.url — bundler doesn't copy .py files into build/.)
const C2_SUBSCRIBER_SCRIPT = '/opt/argos-c2-scanner/c2-subscriber.py';
const C2_STALE_MS = 10_000; // a C2 center stale if not re-detected within this window

let pollTimer: ReturnType<typeof setInterval> | null = null;
let cachedDrones: DragonSyncDrone[] = [];
let cachedFpv: DragonSyncFpvSignal[] = [];
const cachedC2: Map<string, DragonSyncC2Signal> = new Map();
let lastPollError: string | null = null;

let c2Child: ChildProcessWithoutNullStreams | null = null;
let c2Reader: Interface | null = null;
let c2StaleTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Systemd helpers
// ---------------------------------------------------------------------------

async function isServiceActive(serviceName: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('sudo', ['systemctl', 'is-active', serviceName]);
		return stdout.trim() === 'active';
	} catch {
		return false;
	}
}

async function startService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'start', serviceName]);
		return true;
	} catch {
		return false;
	}
}

async function stopService(serviceName: string): Promise<boolean> {
	try {
		await execFileAsync('sudo', ['systemctl', 'stop', serviceName]);
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// API polling
// ---------------------------------------------------------------------------

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
		lastPollError = `HTTP ${res.status}`;
		return;
	}
	const data: unknown = await res.json();
	const rawDrones = (data as { drones?: unknown[] }).drones ?? [];
	cachedDrones = rawDrones.filter(isDroneTrack);
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
	cachedFpv = rawSignals.filter(isFpvSignal);
}

async function pollDragonSyncApi(): Promise<void> {
	try {
		await Promise.all([pollDronesEndpoint(), pollSignalsEndpoint()]);
		lastPollError = null;
	} catch (err) {
		lastPollError = err instanceof Error ? err.message : 'poll failed';
	}
}

// ---------------------------------------------------------------------------
// Public API — status
// ---------------------------------------------------------------------------

async function checkApiReachable(): Promise<boolean> {
	try {
		const res = await fetch(`${DRAGONSYNC_API}/drones`, {
			signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
		});
		return res.ok;
	} catch {
		return false;
	}
}

function deriveServiceStatus(
	droneidGo: boolean,
	dragonSync: boolean,
	_apiReachable: boolean,
	fpvScanner: boolean,
	_c2Scanner: boolean
): DragonSyncServiceStatus {
	// apiReachable intentionally ignored in state derivation — HTTP probe races with
	// systemd on RPi5 (node event-loop lag under load). Unit state is authoritative.
	// c2Scanner intentionally NOT in the overall-running flag set — C2 is an optional
	// add-on (HackRF may be claimed by another tool); status stays 'running' even
	// if c2 is inactive. Callers read c2ScannerRunning directly for the C2 dot.
	const flags = [droneidGo, dragonSync, fpvScanner];
	if (flags.every((f) => f)) return 'running';
	if (flags.every((f) => !f)) return 'stopped';
	return 'starting';
}

export async function getDragonSyncStatus(): Promise<DragonSyncStatusResult> {
	const [droneidGo, dragonSync, apiReachable, fpvScanner, c2Scanner] = await Promise.all([
		isServiceActive(ZMQ_DECODER_SERVICE),
		isServiceActive(DRAGONSYNC_SERVICE),
		checkApiReachable(),
		isServiceActive(FPV_SERVICE),
		isServiceActive(C2_SERVICE)
	]);

	return {
		success: true,
		droneidGoRunning: droneidGo,
		dragonSyncRunning: dragonSync,
		fpvScannerRunning: fpvScanner,
		c2ScannerRunning: c2Scanner,
		status: deriveServiceStatus(droneidGo, dragonSync, apiReachable, fpvScanner, c2Scanner),
		droneCount: cachedDrones.length,
		apiReachable,
		error: lastPollError ?? undefined
	};
}

export function getDragonSyncDrones(): DragonSyncDrone[] {
	return cachedDrones;
}

export function getDragonSyncFpvSignals(): DragonSyncFpvSignal[] {
	return cachedFpv;
}

export function isDragonSyncApiReachable(): boolean {
	return lastPollError === null;
}

export function getLastPollError(): string | null {
	return lastPollError;
}

// ---------------------------------------------------------------------------
// Public API — control
// ---------------------------------------------------------------------------

async function claimB205ForFpv(): Promise<DragonSyncControlResult | null> {
	const claim = await resourceManager.acquire(FPV_OWNER, HardwareDevice.B205);
	if (claim.success || claim.owner === FPV_OWNER) return null;
	logger.info('[dragonsync] B205 held by competitor, force-releasing', { owner: claim.owner });
	await resourceManager.forceRelease(HardwareDevice.B205);
	const retry = await resourceManager.acquire(FPV_OWNER, HardwareDevice.B205);
	if (retry.success) return null;
	return {
		success: false,
		message: `B205 unavailable (held by ${retry.owner})`,
		error: 'b205-locked'
	};
}

/**
 * Try to claim HackRF for C2 scanner. Unlike B205, HackRF is optional — if
 * it's held by OpenWebRX / NovaSDR / GSM-Evil / etc, we skip C2 silently and
 * let the rest of the stack come up. Returns true if claimed.
 */
async function claimHackRFForC2(): Promise<boolean> {
	const claim = await resourceManager.acquire(C2_OWNER, HardwareDevice.HACKRF);
	if (claim.success || claim.owner === C2_OWNER) return true;
	logger.info('[dragonsync] HackRF held by competitor — skipping C2 scanner', {
		owner: claim.owner
	});
	return false;
}

/**
 * Spawn the Python c2-subscriber helper. Line-delimited JSON on its stdout
 * becomes entries in cachedC2, keyed by `center_hz` (each band center
 * shows the most-recent detection, stale entries pruned every tick).
 */
function startC2Subscriber(): void {
	if (c2Child) return;
	c2Child = spawn('/usr/bin/python3', [C2_SUBSCRIBER_SCRIPT], {
		stdio: ['ignore', 'pipe', 'pipe']
	});
	c2Child.on('error', (err) => {
		logger.error('[dragonsync] c2-subscriber spawn failed', { err });
	});
	c2Child.on('exit', (code) => {
		logger.debug('[dragonsync] c2-subscriber exited', { code });
		c2Child = null;
	});
	c2Reader = createInterface({ input: c2Child.stdout });
	c2Reader.on('line', (raw) => {
		try {
			const msg = JSON.parse(raw);
			ingestC2Message(msg);
		} catch {
			// ignore malformed line
		}
	});

	// Prune stale C2 entries — if a center wasn't re-detected in C2_STALE_MS,
	// drop it. This keeps the UI list reflective of current air activity.
	c2StaleTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, sig] of cachedC2) {
			if ((sig.last_update_time ?? 0) + C2_STALE_MS < now) cachedC2.delete(key);
		}
	}, 2000);
}

function stopC2Subscriber(): void {
	if (c2StaleTimer) {
		clearInterval(c2StaleTimer);
		c2StaleTimer = null;
	}
	if (c2Reader) {
		c2Reader.close();
		c2Reader = null;
	}
	if (c2Child && !c2Child.killed) {
		c2Child.kill('SIGTERM');
		c2Child = null;
	}
	cachedC2.clear();
}

interface RawC2AlertBlock {
	'Basic ID'?: { id?: string; description?: string };
	'Self-ID Message'?: { text?: string };
	'Frequency Message'?: { frequency?: number };
	'Location/Vector Message'?: {
		latitude?: number;
		longitude?: number;
		geodetic_altitude?: number;
	};
	'Signal Info'?: {
		source?: string;
		center_hz?: number;
		bandwidth_hz?: number;
		rssi?: number;
		band?: string;
	};
}

function mergeC2Blocks(msg: unknown): RawC2AlertBlock {
	const merged: Record<string, unknown> = {};
	if (!Array.isArray(msg)) return merged as RawC2AlertBlock;
	for (const block of msg) {
		if (block && typeof block === 'object') Object.assign(merged, block as RawC2AlertBlock);
	}
	return merged as RawC2AlertBlock;
}

function extractCenterHz(merged: RawC2AlertBlock): number {
	const info = merged['Signal Info'];
	const freq = merged['Frequency Message'];
	return info?.center_hz ?? freq?.frequency ?? 0;
}

type SignalInfoBlock = NonNullable<RawC2AlertBlock['Signal Info']>;
type LocationBlock = NonNullable<RawC2AlertBlock['Location/Vector Message']>;

function c2Source(info: SignalInfoBlock): DragonSyncC2Signal['source'] {
	return (info.source ?? 'c2-energy') as DragonSyncC2Signal['source'];
}

function c2AlertId(basic: NonNullable<RawC2AlertBlock['Basic ID']>, centerHz: number): string {
	return basic.id ?? `c2-${centerHz}`;
}

function c2Description(basic: NonNullable<RawC2AlertBlock['Basic ID']>): string | null {
	return basic.description ?? null;
}

function c2SelfId(selfId: NonNullable<RawC2AlertBlock['Self-ID Message']>): string | null {
	return selfId.text ?? null;
}

function buildC2Identity(merged: RawC2AlertBlock, centerHz: number) {
	const basic = merged['Basic ID'] ?? {};
	const selfId = merged['Self-ID Message'] ?? {};
	const info = merged['Signal Info'] ?? {};
	return {
		uid: `c2-${centerHz}`,
		source: c2Source(info),
		alert_id: c2AlertId(basic, centerHz),
		description: c2Description(basic),
		self_id: c2SelfId(selfId)
	};
}

function buildC2Signal(info: SignalInfoBlock, centerHz: number) {
	return {
		center_hz: centerHz,
		bandwidth_hz: info.bandwidth_hz ?? 0,
		rssi: info.rssi ?? null,
		band: info.band ?? 'unknown'
	};
}

function buildC2Location(loc: LocationBlock) {
	return {
		lat: loc.latitude ?? 0,
		lon: loc.longitude ?? 0,
		alt: loc.geodetic_altitude ?? 0
	};
}

function buildC2Entry(merged: RawC2AlertBlock, centerHz: number): DragonSyncC2Signal {
	return {
		...buildC2Identity(merged, centerHz),
		...buildC2Signal(merged['Signal Info'] ?? {}, centerHz),
		...buildC2Location(merged['Location/Vector Message'] ?? {}),
		last_update_time: Date.now()
	};
}

function ingestC2Message(msg: unknown): void {
	const merged = mergeC2Blocks(msg);
	const centerHz = extractCenterHz(merged);
	if (!centerHz) return;
	const entry = buildC2Entry(merged, centerHz);
	cachedC2.set(entry.uid, entry);
}

export function getDragonSyncC2Signals(): DragonSyncC2Signal[] {
	return Array.from(cachedC2.values());
}

async function rollbackDragonSyncPrereqs(): Promise<void> {
	await stopService(DRAGONSYNC_SERVICE);
	await stopService(ZMQ_DECODER_SERVICE);
}

function startFailure(service: string): DragonSyncControlResult {
	return {
		success: false,
		message: `Failed to start ${service}`,
		error: 'systemctl start failed'
	};
}

async function startPrereqsOrFail(): Promise<DragonSyncControlResult | null> {
	if (!(await startService(ZMQ_DECODER_SERVICE))) return startFailure(ZMQ_DECODER_SERVICE);
	if (!(await startService(DRAGONSYNC_SERVICE))) {
		await stopService(ZMQ_DECODER_SERVICE);
		return startFailure(DRAGONSYNC_SERVICE);
	}
	return null;
}

async function startFpvOrRollback(): Promise<DragonSyncControlResult | null> {
	const claimFailure = await claimB205ForFpv();
	if (claimFailure) {
		await rollbackDragonSyncPrereqs();
		return claimFailure;
	}
	if (await startService(FPV_SERVICE)) return null;
	await resourceManager.release(FPV_OWNER, HardwareDevice.B205).catch(() => undefined);
	await rollbackDragonSyncPrereqs();
	return startFailure(FPV_SERVICE);
}

/** C2 scanner = best-effort add-on. Failure never fails the whole UAS start. */
async function startC2BestEffort(): Promise<void> {
	if (!(await claimHackRFForC2())) return;
	if (await startService(C2_SERVICE)) {
		startC2Subscriber();
		return;
	}
	logger.warn('[dragonsync] C2 scanner failed to start — releasing HackRF');
	await resourceManager.release(C2_OWNER, HardwareDevice.HACKRF).catch(() => undefined);
}

export async function startDragonSync(): Promise<DragonSyncControlResult> {
	logger.info('[dragonsync] Starting zmq-decoder + dragonsync + wardragon-fpv-detect');
	const prereqsFail = await startPrereqsOrFail();
	if (prereqsFail) return prereqsFail;
	const fpvFail = await startFpvOrRollback();
	if (fpvFail) return fpvFail;
	await startC2BestEffort();
	startDragonSyncPoller();
	return { success: true, message: 'DragonSync services started' };
}

const STOP_SERVICES: readonly [string, string][] = [
	[FPV_SERVICE, 'wardragon-fpv-detect'],
	[DRAGONSYNC_SERVICE, 'dragonsync'],
	[ZMQ_DECODER_SERVICE, 'zmq-decoder'],
	[C2_SERVICE, 'argos-c2-scanner']
];

async function releaseAllSdrClaims(): Promise<void> {
	await resourceManager.release(FPV_OWNER, HardwareDevice.B205).catch(() => undefined);
	await resourceManager.release(C2_OWNER, HardwareDevice.HACKRF).catch(() => undefined);
}

export async function stopDragonSync(): Promise<DragonSyncControlResult> {
	logger.info(
		'[dragonsync] Stopping wardragon-fpv-detect + dragonsync + zmq-decoder + c2-scanner'
	);
	stopDragonSyncPoller();
	stopC2Subscriber();

	const results = await Promise.all(STOP_SERVICES.map(([svc]) => stopService(svc)));
	await releaseAllSdrClaims();
	cachedDrones = [];
	cachedFpv = [];
	cachedC2.clear();

	const failed = STOP_SERVICES.filter((_, i) => !results[i]).map(([, label]) => label);
	if (failed.length === 0) return { success: true, message: 'DragonSync services stopped' };
	logger.warn(`[dragonsync] Failed to stop: ${failed.join(', ')}`);
	return { success: false, message: `Failed to stop: ${failed.join(', ')}` };
}

// ---------------------------------------------------------------------------
// Public API — poller lifecycle
// ---------------------------------------------------------------------------

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
