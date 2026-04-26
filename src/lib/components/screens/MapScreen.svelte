<script lang="ts">
	// spec-024 PR6 T035-T037 — Mk II MAP screen.
	//
	// Mounts a MapLibre canvas inside the chassis main slot and layers
	// onto it the spec-023 RF visualization (heatmap / centroids / drive
	// path / highlight rays-on-select), the operator GPS marker, and a
	// new "current detections" bearing-ray overlay computed from PR5c's
	// detectionsStore. Layer visibility is gated by the LayerChips
	// component (T038) bound to the map-overlay store.
	//
	// The screen is intentionally NOT a wrapper around DashboardMap.
	// DashboardMap carries a large legacy panel surface (DeviceOverlay,
	// TowerPopup, cell-tower fetch state, panel containers) that the
	// Mk II screen does not need. Reusing the *layer specs* from
	// $lib/map/layers and the *store* from rf-visualization.svelte.ts
	// keeps the visual contract identical without dragging the legacy
	// machinery in.

	import 'maplibre-gl/dist/maplibre-gl.css';

	import { onDestroy, onMount } from 'svelte';
	import {
		CircleLayer,
		GeoJSONSource,
		HeatmapLayer,
		LineLayer,
		MapLibre,
		Marker,
		NavigationControl
	} from 'svelte-maplibre-gl';

	import LayerChips from '$lib/components/screens/parts/LayerChips.svelte';
	import {
		RF_CENTROID_HALO_LAYER_ID,
		RF_CENTROID_LAYER_ID,
		RF_CENTROID_SOURCE_ID,
		rfCentroidHaloLayer,
		rfCentroidLayer
	} from '$lib/map/layers/rf-centroid-layer';
	import {
		RF_HEATMAP_LAYER_ID,
		RF_HEATMAP_SOURCE_ID,
		rfHeatmapLayer
	} from '$lib/map/layers/rf-heatmap-layer';
	import {
		RF_HIGHLIGHT_RAYS_LAYER_ID,
		RF_HIGHLIGHT_RAYS_SOURCE_ID,
		rfHighlightRaysLayer
	} from '$lib/map/layers/rf-highlight-layer';
	import {
		RF_PATH_CASING_LAYER_ID,
		RF_PATH_LAYER_ID,
		RF_PATH_SOURCE_ID,
		rfPathCasingLayer,
		rfPathLayer
	} from '$lib/map/layers/rf-path-layer';
	import { detectionsStore } from '$lib/state/detections.svelte';
	import {
		overlayCentroids,
		overlayDetections,
		overlayHeatmap,
		overlayOwnPosition,
		overlayPath
	} from '$lib/state/map-overlay.svelte';
	import { rfVisualization } from '$lib/stores/rf-visualization.svelte';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { buildBearingFC } from '$lib/utils/bearing-rays';

	const MAP_STYLE_URL = '/api/map-tiles/styles/alidade_smooth_dark.json';
	const RELOAD_INTERVAL_MS = 30_000;

	let observerLat = $state<number | null>(null);
	let observerLon = $state<number | null>(null);
	let headingDeg = $state<number | null>(null);
	let gpsUnsubscribe: (() => void) | null = null;
	let reloadTimer: ReturnType<typeof setInterval> | null = null;

	const observerLngLat = $derived<[number, number] | null>(
		observerLat !== null && observerLon !== null ? [observerLon, observerLat] : null
	);

	const bearingFC = $derived(buildBearingFC(observerLat, observerLon, detectionsStore.ranked));

	const mapCenter = $derived<[number, number]>(
		observerLngLat ?? [-117.2333, 35.2611] // Ft. Irwin centroid; fallback only when GPS missing
	);

	function fitToObserver(): void {
		// no-op placeholder; future enhancement could flyTo(observer) on first fix
	}

	onMount(() => {
		// Kick a load on mount; rfVisualization's load() pulls heatmap +
		// centroids + path with current filters (defaults to all sessions).
		void rfVisualization.load();
		reloadTimer = setInterval(() => void rfVisualization.load(), RELOAD_INTERVAL_MS);
		gpsUnsubscribe = gpsStore.subscribe((s) => {
			if (s.status.hasGPSFix) {
				observerLat = s.position.lat;
				observerLon = s.position.lon;
			} else {
				observerLat = null;
				observerLon = null;
			}
			headingDeg = s.status.heading;
		});
		// Start detections SSE for bearing rays (the same store the
		// OVERVIEW DetectionsList reads).
		detectionsStore.start();
		fitToObserver();
	});

	onDestroy(() => {
		if (reloadTimer !== null) clearInterval(reloadTimer);
		reloadTimer = null;
		gpsUnsubscribe?.();
		gpsUnsubscribe = null;
		detectionsStore.stop();
	});

	const headingTransform = $derived(
		headingDeg === null ? 'rotate(0deg)' : `rotate(${headingDeg}deg)`
	);
</script>

<div class="map-screen" data-screen="map">
	<MapLibre
		style={MAP_STYLE_URL}
		center={mapCenter}
		zoom={observerLngLat ? 14 : 11}
		attributionControl={false}
		autoloadGlobalCss={false}
		class="mk2-map-canvas"
	>
		<NavigationControl position="bottom-right" showCompass={false} />

		{#if overlayHeatmap.value}
			<GeoJSONSource id={RF_HEATMAP_SOURCE_ID} data={rfVisualization.features.heatmap}>
				<HeatmapLayer
					id={RF_HEATMAP_LAYER_ID}
					layout={rfHeatmapLayer.layout}
					paint={rfHeatmapLayer.paint}
				/>
			</GeoJSONSource>
		{/if}

		{#if overlayPath.value}
			<GeoJSONSource
				id={RF_PATH_SOURCE_ID}
				data={rfVisualization.features.path}
				lineMetrics={true}
			>
				<LineLayer
					id={RF_PATH_CASING_LAYER_ID}
					layout={rfPathCasingLayer.layout}
					paint={rfPathCasingLayer.paint}
				/>
				<LineLayer
					id={RF_PATH_LAYER_ID}
					layout={rfPathLayer.layout}
					paint={rfPathLayer.paint}
				/>
			</GeoJSONSource>
		{/if}

		{#if overlayCentroids.value}
			<GeoJSONSource id={RF_CENTROID_SOURCE_ID} data={rfVisualization.features.centroids}>
				<CircleLayer
					id={RF_CENTROID_HALO_LAYER_ID}
					layout={rfCentroidHaloLayer.layout}
					paint={rfCentroidHaloLayer.paint}
				/>
				<CircleLayer
					id={RF_CENTROID_LAYER_ID}
					layout={rfCentroidLayer.layout}
					paint={rfCentroidLayer.paint}
				/>
			</GeoJSONSource>
		{/if}

		<GeoJSONSource id={RF_HIGHLIGHT_RAYS_SOURCE_ID} data={rfVisualization.selectedObservations}>
			<LineLayer
				id={RF_HIGHLIGHT_RAYS_LAYER_ID}
				layout={rfHighlightRaysLayer.layout}
				paint={rfHighlightRaysLayer.paint}
			/>
		</GeoJSONSource>

		{#if overlayDetections.value}
			<GeoJSONSource id="mk2-detection-bearings" data={bearingFC}>
				<LineLayer
					id="mk2-detection-bearings-layer"
					paint={{
						'line-color': '#A8B8E0',
						'line-width': 1.25,
						'line-opacity': 0.55,
						'line-dasharray': [2, 3]
					}}
				/>
			</GeoJSONSource>
		{/if}

		{#if overlayOwnPosition.value && observerLngLat}
			<Marker lnglat={observerLngLat} anchor="center">
				{#snippet content()}
					<div class="own-pos">
						<div class="own-cone" style="transform: {headingTransform};"></div>
						<div class="own-dot"></div>
					</div>
				{/snippet}
			</Marker>
		{/if}
	</MapLibre>

	<div class="overlay-chips" aria-label="Layer controls">
		<LayerChips />
	</div>
</div>

<style>
	.map-screen {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}

	:global(.mk2-map-canvas) {
		width: 100%;
		height: 100%;
	}

	.overlay-chips {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 10;
		padding: 6px;
		background: color-mix(in srgb, var(--mk2-bg, var(--background)) 88%, transparent);
		border: 1px solid var(--mk2-line, var(--border));
		backdrop-filter: blur(4px);
	}

	.own-pos {
		position: relative;
		width: 24px;
		height: 24px;
	}

	.own-dot {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		background: var(--mk2-accent, #a8b8e0);
		border: 2px solid var(--mk2-bg, #111);
		border-radius: 50%;
		box-shadow: 0 0 6px color-mix(in srgb, var(--mk2-accent, #a8b8e0) 60%, transparent);
	}

	.own-cone {
		position: absolute;
		left: 0;
		top: 0;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: conic-gradient(
			from -30deg,
			color-mix(in srgb, var(--mk2-accent, #a8b8e0) 35%, transparent) 0deg,
			color-mix(in srgb, var(--mk2-accent, #a8b8e0) 0%, transparent) 60deg,
			transparent 60deg
		);
		opacity: 0.8;
		transform-origin: center;
	}
</style>
