/**
 * Per-device cooperative mutex. Not a real OS mutex — just a boolean Map
 * that `ResourceManager` guards its acquire/release/forceRelease critical
 * sections with. Extracted so the class body stays under the LOC budget.
 *
 * @module
 */

import { delay } from '$lib/utils/delay';

import type { HardwareDevice } from './types';

type MutexMap = Map<HardwareDevice, boolean>;

const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 50;

/**
 * Acquire the per-device mutex, polling until free or timing out.
 *
 * Safety note: the `while (mutex.get(device))` → `mutex.set(device, true)`
 * check-then-set pattern looks racy but is effectively atomic here. Node.js
 * is single-threaded; `await delay(...)` is the only suspension point, and
 * there is NO await between the loop exit (line below the while) and the
 * `mutex.set(...)` call. Two concurrent callers that both see `false` cannot
 * both run `mutex.set(...)` — the event loop serializes the two microtasks.
 * If Node ever grows preemptive scheduling this needs to become a real
 * Promise-queue lock; today it does not.
 */
export async function acquireMutex(mutex: MutexMap, device: HardwareDevice): Promise<boolean> {
	const start = Date.now();
	while (mutex.get(device)) {
		if (Date.now() - start > MAX_WAIT_MS) return false;
		await delay(POLL_INTERVAL_MS);
	}
	mutex.set(device, true);
	return true;
}

export function releaseMutex(mutex: MutexMap, device: HardwareDevice): void {
	mutex.set(device, false);
}
