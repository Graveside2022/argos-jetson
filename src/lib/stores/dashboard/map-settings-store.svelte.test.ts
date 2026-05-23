import { describe, expect, it } from 'vitest';

import {
	createMapSettingsStore,
	DEFAULT_SATELLITE_SOURCE,
	DEFAULT_VECTOR_SOURCE,
	mapSettingsView,
	navigateBackToHub,
	navigateToMapSettingsView
} from './map-settings-store.svelte';

describe('mapSettings (Phase 3 runes migration)', () => {
	it('seeds the default vector provider with stadia unavailable', () => {
		const store = createMapSettingsStore();
		expect(store.provider).toBe(DEFAULT_VECTOR_SOURCE);
		expect(store.stadiaAvailable).toBe(false);
	});

	it('setProvider replaces the provider wholesale', () => {
		const store = createMapSettingsStore();
		store.setProvider(DEFAULT_SATELLITE_SOURCE);
		expect(store.provider.type).toBe('satellite');
		expect(store.provider.name).toBe('Satellite Hybrid');
	});

	it('setStadiaAvailable flips the flag', () => {
		const store = createMapSettingsStore();
		store.setStadiaAvailable(true);
		expect(store.stadiaAvailable).toBe(true);
	});
});

describe('mapSettingsView navigation', () => {
	it('navigates between subviews and back to hub', () => {
		navigateToMapSettingsView('provider');
		expect(mapSettingsView.current).toBe('provider');
		navigateToMapSettingsView('rf-propagation');
		expect(mapSettingsView.current).toBe('rf-propagation');
		navigateBackToHub();
		expect(mapSettingsView.current).toBe('hub');
	});
});
