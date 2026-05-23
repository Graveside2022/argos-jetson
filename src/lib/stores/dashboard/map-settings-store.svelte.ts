import type { StyleSpecification } from 'maplibre-gl';

import { browser } from '$app/environment';

import { activePanel } from './dashboard-store.svelte';

export type MapProviderType = 'vector' | 'satellite' | 'custom';

export interface MapSourceConfig {
	name: string;
	type: MapProviderType;
	url: string; // URL template or style JSON URL
	attribution?: string;
}

export const DEFAULT_VECTOR_SOURCE: MapSourceConfig = {
	name: 'Tactical Dark',
	type: 'vector',
	url: '/api/map-tiles/styles/alidade_smooth_dark.json',
	attribution: '© Stadia Maps'
};

export const DEFAULT_SATELLITE_SOURCE: MapSourceConfig = {
	name: 'Satellite Hybrid',
	type: 'satellite',
	url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
	attribution: '© Google'
};

// Minimal MapLibre style spec for Google satellite tiles — used when Stadia is not configured.
// Raster tiles from mt0-mt3.google.com; glyphs from demotiles.maplibre.org for label rendering.
export const GOOGLE_SATELLITE_STYLE: StyleSpecification = {
	version: 8,
	name: 'Google Satellite Fallback',
	glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
	sources: {
		'google-satellite': {
			type: 'raster',
			tiles: [
				'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
			],
			tileSize: 256,
			attribution: '© Google'
		}
	},
	layers: [
		{
			id: 'google-satellite-layer',
			type: 'raster',
			source: 'google-satellite'
		}
	]
};

/**
 * Phase 3 refactor (svelte-core-bestpractices): migrated from `svelte/store`
 * `writable` to Svelte 5 runes. `provider` is replaced wholesale → `$state.raw`.
 * `reset()` was dead (zero callers) and removed. Exported for unit isolation.
 */
export function createMapSettingsStore() {
	let provider = $state.raw<MapSourceConfig>(DEFAULT_VECTOR_SOURCE);
	let stadiaAvailable = $state(false);

	return {
		get provider() {
			return provider;
		},
		setProvider(config: MapSourceConfig): void {
			provider = config;
		},
		get stadiaAvailable() {
			return stadiaAvailable;
		},
		setStadiaAvailable(value: boolean): void {
			stadiaAvailable = value;
		}
	};
}

export const mapSettings = createMapSettingsStore();

// ── Map Settings panel navigation ────────────────────────────────────

export type MapSettingsView = 'hub' | 'provider' | 'layers' | 'rf-propagation';

let activeView = $state<MapSettingsView>('hub');

/** Read-only reactive accessor for the active Map Settings subview. */
export const mapSettingsView = {
	get current(): MapSettingsView {
		return activeView;
	}
};

export function navigateToMapSettingsView(view: MapSettingsView): void {
	activeView = view;
}

export function navigateBackToHub(): void {
	activeView = 'hub';
}

// Reset subview to hub when the Map Settings panel is closed. A module-level
// `$effect.root` mirrors the old `activePanel.subscribe` now that dashboard-store
// is rune-based; the root is never disposed (app-lifetime), browser-only.
if (browser) {
	$effect.root(() => {
		$effect(() => {
			if (activePanel.current !== 'map-settings') activeView = 'hub';
		});
	});
}
