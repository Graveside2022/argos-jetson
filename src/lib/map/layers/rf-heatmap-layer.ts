/**
 * MapLibre native `heatmap` layer for RSSI coverage visualization.
 *
 * Fed by H3-binned hex cells from `/api/rf/aggregate?layer=heatmap`.
 * Each feature is a Point at the hex cell's center carrying `count`
 * (row count in that bin), `meanDbm`, `maxDbm`, `minDbm`.
 *
 * Styling matches the Flying-Squirrel / MeerCAT-FS aesthetic: a
 * desaturated Red → Yellow → Green ramp, NOT the saturated rainbow
 * that Kepler-style heatmaps use. Opacity stays bounded at 0.7 so
 * device markers authored on top remain legible.
 */

import type { HeatmapLayerSpecification, SourceSpecification } from 'maplibre-gl';

export const RF_HEATMAP_SOURCE_ID = 'rf-heatmap-src';
export const RF_HEATMAP_LAYER_ID = 'rf-heatmap';

export const rfHeatmapSource: SourceSpecification = {
	type: 'geojson',
	data: { type: 'FeatureCollection', features: [] }
};

export const rfHeatmapLayer: HeatmapLayerSpecification = {
	id: RF_HEATMAP_LAYER_ID,
	type: 'heatmap',
	source: RF_HEATMAP_SOURCE_ID,
	layout: { visibility: 'visible' },
	paint: {
		// Denser clusters of observations render hotter. `count` is the
		// number of signals in this H3 cell (per rf-aggregation.ts).
		'heatmap-weight': [
			'interpolate',
			['linear'],
			['coalesce', ['get', 'count'], 1],
			1,
			0.2,
			25,
			0.6,
			100,
			1
		],
		// Sharpen closer zooms — the same raw density feels heavier
		// when fewer cells fit the viewport.
		'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 18, 1.4],
		// Desaturated RdYlGn ramp. Lower stops transparent so bare map
		// bleeds through instead of being washed out.
		'heatmap-color': [
			'interpolate',
			['linear'],
			['heatmap-density'],
			0,
			'rgba(0, 0, 0, 0)',
			0.15,
			'rgba(110, 140, 100, 0.35)', // muted green (weak-coverage fringe)
			0.4,
			'rgba(190, 175, 90, 0.55)', // muted amber
			0.7,
			'rgba(200, 120, 80, 0.75)', // muted red-orange
			1,
			'rgba(200, 85, 65, 0.85)' // muted red (hottest)
		],
		// Radius scales with zoom so tight suburban clusters don't
		// collapse at low zoom but continental surveys stay readable.
		'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 20, 18, 38],
		// Bounded opacity keeps centroid + device-dot markers legible
		// when the heatmap is toggled on alongside them.
		'heatmap-opacity': 0.7
	}
};

/** Toggle the heatmap layer visibility in-place on the live map. */
export function setRfHeatmapVisible(
	map: { setLayoutProperty: (id: string, prop: string, value: string) => void },
	visible: boolean
): void {
	map.setLayoutProperty(RF_HEATMAP_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
}
