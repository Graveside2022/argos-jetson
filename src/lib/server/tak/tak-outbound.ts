/**
 * CoT outbound throttling.
 *
 * Each entity UID is throttled to at most one CoT write per
 * `COT_THROTTLE_MS` window:
 *   - First sighting of a UID → write immediately, record timestamp.
 *   - Window elapsed since last write → write immediately, reset.
 *   - Within window → replace any pending CoT for that UID (latest wins);
 *     a timer fires at the window boundary and flushes whatever is pending
 *     at that moment.
 *
 * CoTs without a UID are passed straight through (no throttle).
 *
 * The throttler captures the live TAK handle via a callback so that after a
 * reconnect (which swaps the `tak` field on TakService) subsequent sends
 * target the new socket, not a stale reference. `clear()` drains pending
 * timers — call it from `disconnect()`.
 *
 * @module
 */

import type CoT from '@tak-ps/node-cot';
import type TAK from '@tak-ps/node-tak';

const COT_THROTTLE_MS = 1000;

interface ThrottleEntry {
	lastSent: number;
	pendingTimeout: NodeJS.Timeout | null;
	pendingCot: CoT | null;
}

export class CotThrottler {
	private throttleMap = new Map<string, ThrottleEntry>();

	constructor(private readonly getTak: () => TAK | null) {}

	/**
	 * Enqueue a CoT for throttled per-UID delivery. CoTs without a UID pass
	 * through unthrottled. If the TAK socket is not open, drops silently
	 * (matches original behavior).
	 */
	send(cot: CoT): void {
		const tak = this.getTak();
		if (!tak?.open) return;
		const uid = cot.uid();
		if (!uid) {
			tak.write([cot]);
			return;
		}
		this.dispatch(uid, cot);
	}

	/** Route to immediate-send or deferred-send based on throttle state. */
	private dispatch(uid: string, cot: CoT): void {
		const now = Date.now();
		const entry = this.throttleMap.get(uid);
		if (!entry) {
			this.sendImmediate(uid, cot, undefined);
			return;
		}
		if (now - entry.lastSent >= COT_THROTTLE_MS) {
			this.sendImmediate(uid, cot, entry);
			return;
		}
		this.scheduleDeferred(entry, cot, now);
	}

	/** Send now + reset the entry's timer/pending-CoT slot. */
	private sendImmediate(uid: string, cot: CoT, entry: ThrottleEntry | undefined): void {
		if (entry?.pendingTimeout) clearTimeout(entry.pendingTimeout);
		this.throttleMap.set(uid, {
			lastSent: Date.now(),
			pendingTimeout: null,
			pendingCot: null
		});
		this.getTak()?.write([cot]);
	}

	/** Schedule a deferred send at the next window boundary. */
	private scheduleDeferred(entry: ThrottleEntry, cot: CoT, now: number): void {
		if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
		entry.pendingCot = cot;
		entry.pendingTimeout = setTimeout(
			() => {
				const tak = this.getTak();
				if (tak?.open && entry.pendingCot) {
					tak.write([entry.pendingCot]);
					entry.lastSent = Date.now();
					entry.pendingCot = null;
					entry.pendingTimeout = null;
				}
			},
			COT_THROTTLE_MS - (now - entry.lastSent)
		);
	}

	/** Clear all pending timeouts + throttle state. Call on disconnect. */
	clear(): void {
		for (const entry of this.throttleMap.values()) {
			if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
		}
		this.throttleMap.clear();
	}
}
