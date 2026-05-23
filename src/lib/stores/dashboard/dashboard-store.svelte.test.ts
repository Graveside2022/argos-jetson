import { beforeEach, describe, expect, it } from 'vitest';

import {
	activeBands,
	activeBottomTab,
	activePanel,
	activeView,
	closeBottomPanel,
	isBottomPanelOpen,
	isolatedDeviceMAC,
	isolateDevice,
	layerVisibility,
	resetBands,
	toggleBand,
	toggleBottomTab,
	toggleLayerVisibility,
	togglePanel
} from './dashboard-store.svelte';

describe('dashboard-store (Phase 3 / ADR-0003 runes migration)', () => {
	beforeEach(() => {
		// Reset shared module state to defaults between tests
		activeView.set('map');
		activePanel.set(null);
		activeBottomTab.set('terminal');
		isolatedDeviceMAC.set(null);
		resetBands();
	});

	it('activeView: defaults to "map" and is settable', () => {
		expect(activeView.current).toBe('map');
		activeView.set('webtak');
		expect(activeView.current).toBe('webtak');
	});

	it('togglePanel toggles open/closed', () => {
		togglePanel('tools');
		expect(activePanel.current).toBe('tools');
		togglePanel('tools');
		expect(activePanel.current).toBeNull();
	});

	it('isBottomPanelOpen derives from activeBottomTab', () => {
		expect(isBottomPanelOpen.current).toBe(true);
		closeBottomPanel();
		expect(activeBottomTab.current).toBeNull();
		expect(isBottomPanelOpen.current).toBe(false);
	});

	it('toggleBottomTab opens then closes the same tab', () => {
		toggleBottomTab('logs');
		expect(activeBottomTab.current).toBe('logs');
		toggleBottomTab('logs');
		expect(activeBottomTab.current).toBeNull();
	});

	it('isolateDevice sets MAC and auto-opens the dashboard tab', () => {
		isolateDevice('AA:BB:CC:DD:EE:FF');
		expect(isolatedDeviceMAC.current).toBe('AA:BB:CC:DD:EE:FF');
		expect(activeBottomTab.current).toBe('dashboard');
		isolateDevice(null);
		expect(isolatedDeviceMAC.current).toBeNull();
	});

	it('toggleBand removes then re-adds a band; resetBands restores all', () => {
		expect(activeBands.current.has('weak')).toBe(true);
		toggleBand('weak');
		expect(activeBands.current.has('weak')).toBe(false);
		toggleBand('weak');
		expect(activeBands.current.has('weak')).toBe(true);
		toggleBand('strong');
		resetBands();
		expect(activeBands.current.size).toBe(6);
	});

	it('toggleLayerVisibility flips a single layer key', () => {
		const before = layerVisibility.current.milSyms;
		toggleLayerVisibility('milSyms');
		expect(layerVisibility.current.milSyms).toBe(!before);
	});
});
