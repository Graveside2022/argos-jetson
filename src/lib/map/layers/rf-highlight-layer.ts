/**
 * Flying-Squirrel "highlight-on-select" layers.
 *
 * When the operator clicks an AP centroid, two things render:
 *   1. Concentric muted-gold rings around the centroid vertex, so
 *      the selection is obvious even when the dot itself is small.
 *   2. 1-pixel muted-gold rays from the centroid to every observation
 *      that contributed to its position estimate, so the operator
 *      can see the evidence behind the computed AP location.
 *
 * Two separate sources keep the concerns clean: the rings source
 * holds the single centroid point, the rays source holds one
 * LineString per observation. Sharing a source would force the
 * circle layer to filter by geometry type, which MapLibre can do
 * but needlessly couples the two effects.
 *
 * Color matches the warm-gold accent used for status=warning to
 * align with the Lunaris palette. Opacity stays bounded so the
 * highlight augments the centroid rather than hiding it.
 */

import type {
	CircleLayerSpecification,
	LineLayerSpecification,
	SourceSpecification
} from 'maplibre-gl';

export const RF_HIGHLIGHT_RAYS_SOURCE_ID = 'rf-highlight-rays-src';
export const RF_HIGHLIGHT_RINGS_SOURCE_ID = 'rf-highlight-rings-src';
export const RF_HIGHLIGHT_RAYS_LAYER_ID = 'rf-highlight-rays';
export const RF_HIGHLIGHT_RINGS_INNER_LAYER_ID = 'rf-highlight-rings-inner';
export const RF_HIGHLIGHT_RINGS_OUTER_LAYER_ID = 'rf-highlight-rings-outer';

const HIGHLIGHT_ACCENT = 'rgba(212, 160, 84, 0.85)';
const HIGHLIGHT_ACCENT_FAINT = 'rgba(212, 160, 84, 0.45)';

export const rfHighlightRaysSource: SourceSpecification = {
	type: 'geojson',
	data: { type: 'FeatureCollection', features: [] }
};

export const rfHighlightRingsSource: SourceSpecification = {
	type: 'geojson',
	data: { type: 'FeatureCollection', features: [] }
};

export const rfHighlightRaysLayer: LineLayerSpecification = {
	id: RF_HIGHLIGHT_RAYS_LAYER_ID,
	type: 'line',
	source: RF_HIGHLIGHT_RAYS_SOURCE_ID,
	layout: { visibility: 'visible', 'line-cap': 'round' },
	paint: {
		'line-color': HIGHLIGHT_ACCENT,
		'line-width': 1,
		'line-opacity': 0.55
	}
};

export const rfHighlightRingsInnerLayer: CircleLayerSpecification = {
	id: RF_HIGHLIGHT_RINGS_INNER_LAYER_ID,
	type: 'circle',
	source: RF_HIGHLIGHT_RINGS_SOURCE_ID,
	layout: { visibility: 'visible' },
	paint: {
		'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 18, 24],
		'circle-color': 'rgba(0, 0, 0, 0)',
		'circle-stroke-width': 1.5,
		'circle-stroke-color': HIGHLIGHT_ACCENT
	}
};

export const rfHighlightRingsOuterLayer: CircleLayerSpecification = {
	id: RF_HIGHLIGHT_RINGS_OUTER_LAYER_ID,
	type: 'circle',
	source: RF_HIGHLIGHT_RINGS_SOURCE_ID,
	layout: { visibility: 'visible' },
	paint: {
		'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 22, 18, 42],
		'circle-color': 'rgba(0, 0, 0, 0)',
		'circle-stroke-width': 1,
		'circle-stroke-color': HIGHLIGHT_ACCENT_FAINT
	}
};
