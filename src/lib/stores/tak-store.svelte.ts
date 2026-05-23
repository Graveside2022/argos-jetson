/**
 * TAK store — connection status + CoT message feed for the tactical map.
 *
 * Phase 3 refactor (svelte-core-bestpractices): migrated from two `svelte/store`
 * `writable`s to a single Svelte 5 runes factory. Both fields are replaced
 * wholesale (`setStatus`/`setCotMessages`), so they use `$state.raw`.
 * `cotMessages` feeds `buildMilSymFC` on the map; `setCotMessages` is its
 * wiring point (no producer yet — CoT ingest lands in a later phase).
 */

import type { TakStatus } from '$lib/types/tak';

const DEFAULT_STATUS: TakStatus = { status: 'disconnected' };

/** Exported for unit isolation — each call yields a fresh reactive instance. */
export function createTakStore() {
	let status = $state.raw<TakStatus>(DEFAULT_STATUS);
	let cotMessages = $state.raw<string[]>([]);

	return {
		get status() {
			return status;
		},
		setStatus(next: TakStatus): void {
			status = next;
		},
		get cotMessages() {
			return cotMessages;
		},
		setCotMessages(next: string[]): void {
			cotMessages = next;
		}
	};
}

export const takStore = createTakStore();
