/**
 * MapLibre circle layer for RSSI-weighted AP centroids.
 *
 * The centroid is the Flying-Squirrel innovation: rather than pinning the
 * AP dot at a single observation, the server computes a linear-power
 * weighted mean of every observation of that BSSID — so the dot sits
 * where the transmitter probably is, not at some arbitrary drive-by
 * sample. See src/lib/server/db/rf-aggregation.ts.
 *
 * Color today is a single accent; Phase A.3 will wire an encryption-type
 * feature property so we can recolor per WPA2/WPA3/Open/etc.
 */

import type { CircleLayerSpecification, SourceSpecification } from 'maplibre-gl';

export const RF_CENTROID_SOURCE_ID = 'rf-centroid-src';
export const RF_CENTROID_LAYER_ID = 'rf-centroid';
export const RF_CENTROID_HALO_LAYER_ID = 'rf-centroid-halo';

export const rfCentroidSource: SourceSpecification = {
	type: 'geojson',
	data: { type: 'FeatureCollection', features: [] }
};

/**
 * White halo under the colored dot so it reads on satellite and dark
 * basemaps alike. Sized slightly larger than the centroid dot.
 */
export const rfCentroidHaloLayer: CircleLayerSpecification = {
	id: RF_CENTROID_HALO_LAYER_ID,
	type: 'circle',
	source: RF_CENTROID_SOURCE_ID,
	layout: { visibility: 'visible' },
	paint: {
		'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 18, 11],
		'circle-color': '#ffffff',
		'circle-opacity': 0.85,
		'circle-stroke-width': 0
	}
};

/**
 * Centroid dot. Radius scales with zoom (smaller at city-level, larger
 * at building-level) and with `obsCount` (more observations → bigger
 * marker, i.e. more confident centroid).
 */
export const rfCentroidLayer: CircleLayerSpecification = {
	id: RF_CENTROID_LAYER_ID,
	type: 'circle',
	source: RF_CENTROID_SOURCE_ID,
	layout: { visibility: 'visible' },
	paint: {
		'circle-radius': [
			'interpolate',
			['linear'],
			['zoom'],
			10,
			['interpolate', ['linear'], ['coalesce', ['get', 'obsCount'], 1], 1, 3, 50, 6],
			18,
			['interpolate', ['linear'], ['coalesce', ['get', 'obsCount'], 1], 1, 7, 50, 12]
		],
		// Color ramps on maxDbm: stronger signal → warmer color.
		'circle-color': [
			'interpolate',
			['linear'],
			['coalesce', ['get', 'maxDbm'], -90],
			-90,
			'#3b82f6', // weak → blue
			-70,
			'#22c55e', // mid → green
			-50,
			'#eab308', // strong → amber
			-30,
			'#ef4444' // very strong → red
		],
		'circle-stroke-color': '#111827',
		'circle-stroke-width': 1,
		'circle-opacity': 0.95
	}
};

export function setRfCentroidVisible(
	map: { setLayoutProperty: (id: string, prop: string, value: string) => void },
	visible: boolean
): void {
	const value = visible ? 'visible' : 'none';
	map.setLayoutProperty(RF_CENTROID_LAYER_ID, 'visibility', value);
	map.setLayoutProperty(RF_CENTROID_HALO_LAYER_ID, 'visibility', value);
}
