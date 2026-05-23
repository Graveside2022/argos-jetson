import { beforeEach, describe, expect, it } from 'vitest';

import type { PropagationBounds } from '$lib/types/rf-propagation';

import {
	addOverlay,
	clearOverlays,
	overlayMode,
	rfOverlayCount,
	rfOverlays,
	setAllOverlaysOpacity
} from './rf-overlay-store.svelte';

const sample = () => ({
	imageDataUri: 'data:,',
	bounds: {} as PropagationBounds,
	opacity: 0.5,
	visible: true,
	label: 'x'
});

describe('rf-overlay-store (Phase 3 / ADR-0003 runes migration)', () => {
	beforeEach(() => {
		clearOverlays();
		overlayMode.set('multi');
	});

	it('addOverlay appends in multi mode', () => {
		addOverlay(sample());
		addOverlay(sample());
		expect(rfOverlayCount.current).toBe(2);
	});

	it('addOverlay replaces in single mode', () => {
		overlayMode.set('single');
		addOverlay(sample());
		addOverlay(sample());
		expect(rfOverlayCount.current).toBe(1);
	});

	it('clearOverlays empties the list', () => {
		addOverlay(sample());
		clearOverlays();
		expect(rfOverlayCount.current).toBe(0);
		expect(rfOverlays.current).toEqual([]);
	});

	it('setAllOverlaysOpacity updates every entry', () => {
		addOverlay(sample());
		addOverlay(sample());
		setAllOverlaysOpacity(0.9);
		expect(rfOverlays.current.every((e) => e.opacity === 0.9)).toBe(true);
	});
});
