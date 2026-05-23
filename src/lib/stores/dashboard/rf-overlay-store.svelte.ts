/**
 * RF Propagation overlay store — manages coverage overlay entries on the map.
 *
 * Each overlay entry holds a PNG data URI, geographic bounds, and display settings.
 * Supports multi-overlay mode (stacking) and single-overlay mode (replace).
 *
 * Phase 3 / ADR-0003: migrated from `svelte/store` (`writable` + `derived` +
 * `persistedWritable`) to the rune state layer. `overlayMode`/`globalOpacity`
 * use `persistedState`; `rfOverlays`/`rfOverlayCount` are getter accessors over
 * a module `$state.raw` (entries are replaced wholesale).
 *
 * @module
 */

import { persistedState } from '$lib/state/persisted.svelte';
import type { PropagationBounds } from '$lib/types/rf-propagation';

export interface RFOverlayEntry {
	id: string;
	imageDataUri: string;
	bounds: PropagationBounds;
	opacity: number;
	visible: boolean;
	label: string;
	createdAt: number;
}

// ── Display settings (persisted) ────────────────────────────────────

type OverlayMode = 'single' | 'multi';

export const overlayMode = persistedState<OverlayMode>('rfOverlayMode', 'single');

export const globalOpacity = persistedState<number>('rfOverlayOpacity', 0.7, {
	serialize: (v) => String(v),
	deserialize: (raw) => Math.max(0.1, Math.min(1, parseFloat(raw) || 0.7))
});

// ── Overlay entries (in-memory) ─────────────────────────────────────

let entries = $state.raw<RFOverlayEntry[]>([]);

export const rfOverlays = {
	get current() {
		return entries;
	},
	set(next: RFOverlayEntry[]) {
		entries = next;
	}
};

export const rfOverlayCount = {
	get current() {
		return entries.length;
	}
};

/** Add an overlay (multi mode appends, single mode replaces). */
export function addOverlay(entry: Omit<RFOverlayEntry, 'id' | 'createdAt'>): string {
	const id = `rf-overlay-${Date.now()}`;
	const full: RFOverlayEntry = { ...entry, id, createdAt: Date.now() };
	entries = overlayMode.current === 'single' ? [full] : [...entries, full];
	return id;
}

/** Clear all overlays. */
export function clearOverlays(): void {
	entries = [];
}

/** Update opacity on ALL overlay entries (used by the global opacity slider). */
export function setAllOverlaysOpacity(opacity: number): void {
	entries = entries.map((e) => ({ ...e, opacity }));
}
