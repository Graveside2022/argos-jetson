/**
 * Paint-property mutations for the Flying-Squirrel highlight-on-select UI.
 *
 * When the operator picks an AP centroid, we want every *other* RF layer
 * to dim to ~30% so the selected centroid + its rays + rings stand out.
 * `*-opacity` is used deliberately rather than `visibility` so the user's
 * layer toggles (rfHeatmap / rfDrivePath / rfApCentroid) stay independent.
 *
 * Layers may not be mounted yet when this runs (cold-boot race with the
 * svelte-maplibre-gl declarative layer adds), hence the `safeSetPaint`
 * wrapper that swallows the "layer does not exist" error and relies on
 * the next `$effect` re-run to catch up once the layer is present.
 */

import type maplibregl from 'maplibre-gl';

function safeSetPaint(map: maplibregl.Map, layerId: string, prop: string, value: unknown): void {
	try {
		map.setPaintProperty(layerId, prop, value as never);
	} catch {
		// Layer not mounted yet — caller's $effect will re-run when it is.
	}
}

export function applyDimOthers(map: maplibregl.Map, selectedId: string | null): void {
	const active = selectedId !== null;
	safeSetPaint(map, 'rf-heatmap', 'heatmap-opacity', active ? 0.3 : 0.7);
	safeSetPaint(map, 'rf-path', 'line-opacity', active ? 0.3 : 1);
	const centroidOpacity: unknown = active
		? ['case', ['==', ['get', 'deviceId'], selectedId], 1, 0.3]
		: 1;
	safeSetPaint(map, 'rf-centroid', 'circle-opacity', centroidOpacity);
	safeSetPaint(map, 'rf-centroid-halo', 'circle-opacity', centroidOpacity);
}
