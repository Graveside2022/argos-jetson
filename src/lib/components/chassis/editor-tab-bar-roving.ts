// spec-026 Phase 8.6 — pure roving-tabindex helpers for EditorTabBar.
// Extracted from EditorTabBar.svelte so the WAI-ARIA APG Toolbar key dispatch
// + flat-item ordering can be unit-tested without a DOM environment.

export type RovingItemKind = 'tab' | 'close';

export interface RovingItem {
	kind: RovingItemKind;
	tabIdx: number;
}

export interface RovingKeyResult {
	next: number;
	handled: boolean;
}

/**
 * Build the flat ordered list of roving items.
 * Order: [tab0, close0?, tab1, close1?, ...]. Close entries are emitted iff
 * `withClose` is true (consumer passed an `onClose` callback).
 */
export function buildItems(count: number, withClose: boolean): RovingItem[] {
	const out: RovingItem[] = [];
	for (let i = 0; i < count; i++) {
		out.push({ kind: 'tab', tabIdx: i });
		if (withClose) out.push({ kind: 'close', tabIdx: i });
	}
	return out;
}

type RovingKey = 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

const ROVING_KEYS: Record<RovingKey, (current: number, len: number) => number> = {
	ArrowRight: (current, len) => (current + 1) % len,
	ArrowLeft: (current, len) => (current - 1 + len) % len,
	Home: () => 0,
	End: (_current, len) => len - 1
};

/**
 * Compute the next cursor index in response to a roving key. Returns the same
 * cursor + handled=false for keys the toolbar should NOT preventDefault on.
 */
export function computeNextCursor(current: number, len: number, key: string): RovingKeyResult {
	if (len === 0) return { next: current, handled: false };
	const handler = ROVING_KEYS[key as RovingKey];
	if (!handler) return { next: current, handled: false };
	return { next: handler(current, len), handled: true };
}

/**
 * Map a tab index to its item-index in the flat roving list.
 */
export function tabItemIdx(tabIdx: number, withClose: boolean): number {
	return withClose ? tabIdx * 2 : tabIdx;
}

/**
 * Map a tab index to its close-button item-index. Returns -1 when there is
 * no close affordance for this consumer.
 */
export function closeItemIdx(tabIdx: number, withClose: boolean): number {
	return withClose ? tabIdx * 2 + 1 : -1;
}

/**
 * Clamp a cursor index after items shrink (e.g. tab closed). Returns the
 * lower of (current cursor) and (last valid item-index), never negative.
 */
export function clampCursor(cursor: number, len: number): number {
	if (len <= 0) return 0;
	const max = len - 1;
	if (cursor > max) return max;
	if (cursor < 0) return 0;
	return cursor;
}
