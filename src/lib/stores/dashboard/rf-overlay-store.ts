/**
 * RF Propagation overlay store — manages coverage overlay entries on the map.
 *
 * Each overlay entry holds a PNG data URI, geographic bounds, and display settings.
 * Supports multi-overlay mode (stacking) and single-overlay mode (replace).
 *
 * @module
 */

import { derived, get, writable } from 'svelte/store';

import { persistedWritable } from '$lib/stores/persisted-writable';
import type { PropagationBounds } from '$lib/types/rf-propagation';

// ── Overlay entries ─────────────────────────────────────────────────

export interface RFOverlayEntry {
	id: string;
	imageDataUri: string;
	bounds: PropagationBounds;
	opacity: number;
	visible: boolean;
	label: string;
	createdAt: number;
}

const overlayEntries = writable<RFOverlayEntry[]>([]);

export { overlayEntries as rfOverlays };

export const rfOverlayCount = derived(overlayEntries, ($entries) => $entries.length);

/** Add an overlay (multi mode appends, single mode replaces) */
export function addOverlay(entry: Omit<RFOverlayEntry, 'id' | 'createdAt'>): string {
	const id = `rf-overlay-${Date.now()}`;
	const full: RFOverlayEntry = { ...entry, id, createdAt: Date.now() };

	if (get(overlayMode) === 'single') {
		overlayEntries.set([full]);
	} else {
		overlayEntries.update((entries) => [...entries, full]);
	}

	return id;
}

/** Clear all overlays */
export function clearOverlays(): void {
	overlayEntries.set([]);
}

/** Update opacity on ALL overlay entries (used by the global opacity slider) */
export function setAllOverlaysOpacity(opacity: number): void {
	overlayEntries.update((entries) => entries.map((e) => ({ ...e, opacity })));
}

// ── Display settings ────────────────────────────────────────────────

type OverlayMode = 'single' | 'multi';

export const overlayMode = persistedWritable<OverlayMode>('rfOverlayMode', 'single');

export const globalOpacity = persistedWritable<number>('rfOverlayOpacity', 0.7, {
	serialize: (v) => String(v),
	deserialize: (raw) => Math.max(0.1, Math.min(1, parseFloat(raw) || 0.7))
});
