/**
 * MapLibre line layer for the operator drive-path, colored by normalized
 * time via a viridis-like ramp. The gradient is applied as a paint
 * expression against the `line-progress` attribute (requires
 * `lineMetrics: true` on the source).
 *
 * Source feature shape (FeatureCollection<LineString>):
 *   properties = { tStart, tEnd, duration, vertexCount }
 *
 * The gradient is time-agnostic — MapLibre interpolates along the physical
 * line length rather than wall-clock time. For a 60-s drive this is close
 * enough; a stricter version would pre-segment per vertex and set
 * per-segment colors, which we'll do in Phase A.3 if the approximation
 * looks off in the field.
 */

import type { LineLayerSpecification, SourceSpecification } from 'maplibre-gl';

export const RF_PATH_SOURCE_ID = 'rf-path-src';
export const RF_PATH_LAYER_ID = 'rf-path';
export const RF_PATH_CASING_LAYER_ID = 'rf-path-casing';

export const rfPathSource: SourceSpecification = {
	type: 'geojson',
	data: { type: 'FeatureCollection', features: [] },
	// Required for `line-progress` paint expressions.
	lineMetrics: true
};

/** White casing under the colored line — keeps it readable on satellite basemaps. */
export const rfPathCasingLayer: LineLayerSpecification = {
	id: RF_PATH_CASING_LAYER_ID,
	type: 'line',
	source: RF_PATH_SOURCE_ID,
	layout: {
		'line-cap': 'round',
		'line-join': 'round',
		visibility: 'visible'
	},
	paint: {
		'line-color': '#ffffff',
		'line-width': 5,
		'line-opacity': 0.9
	}
};

/**
 * Colored line. Viridis 6-stop ramp applied along line-progress, so the
 * gradient spans the full track regardless of duration.
 */
export const rfPathLayer: LineLayerSpecification = {
	id: RF_PATH_LAYER_ID,
	type: 'line',
	source: RF_PATH_SOURCE_ID,
	layout: {
		'line-cap': 'round',
		'line-join': 'round',
		visibility: 'visible'
	},
	paint: {
		'line-width': 3,
		'line-gradient': [
			'interpolate',
			['linear'],
			['line-progress'],
			0.0,
			'#440154', // viridis start (deep purple)
			0.2,
			'#414487',
			0.4,
			'#2a788e',
			0.6,
			'#22a884',
			0.8,
			'#7ad151',
			1.0,
			'#fde725' // viridis end (yellow)
		]
	}
};

/** Mirrors the layer visibility toggle flow used by MapLayersView. */
export function setRfPathVisible(
	map: { setLayoutProperty: (id: string, prop: string, value: string) => void },
	visible: boolean
): void {
	const value = visible ? 'visible' : 'none';
	map.setLayoutProperty(RF_PATH_LAYER_ID, 'visibility', value);
	map.setLayoutProperty(RF_PATH_CASING_LAYER_ID, 'visibility', value);
}
