/**
 * C2 (command-and-control) scanner bridge.
 *
 * Argos consumes ZMQ PUB alerts from `argos-c2-scanner.service` via a small
 * Python helper (`c2-subscriber.py`) spawned as a child process. Line-delimited
 * JSON on stdout becomes entries in the `cachedC2` Map (owned by `state.ts`),
 * keyed by `uid = "c2-<centerHz>"`. A stale-entry reaper runs on a 2 s tick.
 *
 * Node has no ZMQ client in deps; spawning the helper avoids pulling in
 * zeromq.js. The helper path is fixed (installed by
 * `scripts/ops/install-dragonsync.sh`) because `import.meta.url` would not
 * work — the bundler does not copy `.py` files into `build/`.
 *
 * @module
 */

import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import type { Readable } from 'node:stream';

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type { DragonSyncC2Signal } from '$lib/types/dragonsync';
import { logger } from '$lib/utils/logger';

import { cachedC2 } from './state';

const C2_OWNER = 'c2-scanner';
const C2_SUBSCRIBER_SCRIPT = '/opt/argos-c2-scanner/c2-subscriber.py';
const C2_STALE_MS = 10_000;

// `stdio: ['ignore', 'pipe', 'pipe']` — stdin=null, stdout+stderr readable.
type C2Child = ChildProcessByStdio<null, Readable, Readable>;
let c2Child: C2Child | null = null;
let c2Reader: Interface | null = null;
let c2StaleTimer: ReturnType<typeof setInterval> | null = null;

/**
 * HackRF is optional for C2 — held by OpenWebRX / NovaSDR / GSM-Evil on a
 * typical deployment. If we can't claim it, skip C2 silently and let the
 * rest of the stack come up. Returns true if claimed.
 */
export async function claimHackRFForC2(): Promise<boolean> {
	const claim = await resourceManager.acquire(C2_OWNER, HardwareDevice.HACKRF);
	if (claim.success || claim.owner === C2_OWNER) return true;
	logger.info('[dragonsync] HackRF held by competitor — skipping C2 scanner', {
		owner: claim.owner
	});
	return false;
}

export async function releaseHackRFFromC2(): Promise<void> {
	await resourceManager.release(C2_OWNER, HardwareDevice.HACKRF).catch(() => undefined);
}

export function startC2Subscriber(): void {
	if (c2Child) return;
	const child: C2Child = spawn('/usr/bin/python3', [C2_SUBSCRIBER_SCRIPT], {
		stdio: ['ignore', 'pipe', 'pipe']
	});
	c2Child = child;
	child.on('error', (err) => {
		logger.error('[dragonsync] c2-subscriber spawn failed', { err });
	});
	child.on('exit', (code) => {
		logger.debug('[dragonsync] c2-subscriber exited', { code });
		c2Child = null;
	});
	c2Reader = createInterface({ input: child.stdout });
	c2Reader.on('line', (raw) => {
		try {
			const msg: unknown = JSON.parse(raw);
			ingestC2Message(msg);
		} catch {
			// ignore malformed line
		}
	});

	// Prune stale C2 entries — if a center wasn't re-detected in C2_STALE_MS,
	// drop it. Keeps the UI list reflective of current air activity.
	c2StaleTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, sig] of cachedC2) {
			if ((sig.last_update_time ?? 0) + C2_STALE_MS < now) cachedC2.delete(key);
		}
	}, 2000);
}

export function stopC2Subscriber(): void {
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
