/**
 * Flying-Squirrel RF visualization client store.
 *
 * Holds the GeoJSON features that back the drive-path, AP-centroid, and
 * (Phase A.3) heatmap MapLibre layers, plus the layer-mode/intensity
 * toggles that the layer panel writes into. The store calls
 * /api/rf/aggregate on demand (filter-key LRU cache so panning doesn't
 * re-fetch the identical payload).
 */

import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/** Path layer vertex arg from the server. */
interface PathVertex {
	lat: number;
	lon: number;
	t: number;
}

/** AP centroid arg from the server. */
interface ApCentroid {
	deviceId: string;
	lat: number;
	lon: number;
	maxDbm: number;
	obsCount: number;
}

/** Hex cell arg from the server (Phase A.3 heatmap input). */
interface HexCell {
	h3: string;
	lat: number;
	lon: number;
	meanDbm: number;
	maxDbm: number;
	minDbm: number;
	count: number;
}

export type LayerMode = 'off' | 'heatmap' | 'hex';

export interface RfVisualizationFilters {
	sessionId?: string;
	deviceIds?: string[];
	bbox?: [minLon: number, minLat: number, maxLon: number, maxLat: number];
	h3res?: number;
}

interface AggregateResponse {
	heatmap?: HexCell[];
	centroids?: ApCentroid[];
	path?: PathVertex[];
}

const CACHE_LIMIT = 5;
const cache = new Map<string, AggregateResponse>();

function fingerprintScope(filters: RfVisualizationFilters): Record<string, unknown> {
	return {
		s: filters.sessionId ?? null,
		d: filters.deviceIds?.slice().sort() ?? null
	};
}

function fingerprintViewport(filters: RfVisualizationFilters): Record<string, unknown> {
	return {
		b: filters.bbox ?? null,
		h: filters.h3res ?? null
	};
}

function filterFingerprint(filters: RfVisualizationFilters): Record<string, unknown> {
	return { ...fingerprintScope(filters), ...fingerprintViewport(filters) };
}

function cacheKey(filters: RfVisualizationFilters): string {
	return JSON.stringify(filterFingerprint(filters));
}

function lruSet(key: string, value: AggregateResponse): void {
	cache.delete(key);
	cache.set(key, value);
	while (cache.size > CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

function addOptionalParam(
	params: URLSearchParams,
	key: string,
	value: string | undefined | null
): void {
	if (value !== undefined && value !== null && value !== '') params.set(key, value);
}

function buildQuery(filters: RfVisualizationFilters): string {
	const params = new URLSearchParams({ layer: 'all' });
	addOptionalParam(params, 'session', filters.sessionId);
	addOptionalParam(
		params,
		'bssid',
		filters.deviceIds?.length ? filters.deviceIds.join(',') : null
	);
	addOptionalParam(params, 'bbox', filters.bbox ? filters.bbox.join(',') : null);
	addOptionalParam(params, 'h3res', filters.h3res !== undefined ? String(filters.h3res) : null);
	return params.toString();
}

export async function fetchRfAggregate(
	filters: RfVisualizationFilters
): Promise<AggregateResponse> {
	const key = cacheKey(filters);
	const cached = cache.get(key);
	if (cached) {
		cache.delete(key);
		cache.set(key, cached);
		return cached;
	}
	const resp = await fetch(`/api/rf/aggregate?${buildQuery(filters)}`, {
		credentials: 'include',
		headers: { accept: 'application/json' }
	});
	if (!resp.ok) throw new Error(`/api/rf/aggregate ${resp.status}`);
	const data = (await resp.json()) as AggregateResponse;
	lruSet(key, data);
	return data;
}

function pathToGeoJson(vertices: PathVertex[]): FeatureCollection<LineString> {
	if (vertices.length < 2) {
		return { type: 'FeatureCollection', features: [] };
	}
	const tStart = vertices[0].t;
	const tEnd = vertices[vertices.length - 1].t;
	const duration = Math.max(1, tEnd - tStart);
	const coords = vertices.map((v) => [v.lon, v.lat]);
	const feature: Feature<LineString> = {
		type: 'Feature',
		geometry: { type: 'LineString', coordinates: coords },
		properties: {
			tStart,
			tEnd,
			duration,
			vertexCount: vertices.length
		}
	};
	return { type: 'FeatureCollection', features: [feature] };
}

function centroidsToGeoJson(centroids: ApCentroid[]): FeatureCollection<Point> {
	return {
		type: 'FeatureCollection',
		features: centroids.map((c) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
			properties: {
				deviceId: c.deviceId,
				maxDbm: c.maxDbm,
				obsCount: c.obsCount
			}
		}))
	};
}

function hexCellsToGeoJson(cells: HexCell[]): FeatureCollection<Point> {
	return {
		type: 'FeatureCollection',
		features: cells.map((c) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
			properties: {
				h3: c.h3,
				meanDbm: c.meanDbm,
				maxDbm: c.maxDbm,
				minDbm: c.minDbm,
				count: c.count
			}
		}))
	};
}

export interface RfGeoJson {
	path: FeatureCollection<LineString>;
	centroids: FeatureCollection<Point>;
	heatmap: FeatureCollection<Point>;
}

const EMPTY: RfGeoJson = {
	path: { type: 'FeatureCollection', features: [] },
	centroids: { type: 'FeatureCollection', features: [] },
	heatmap: { type: 'FeatureCollection', features: [] }
};

export async function loadRfGeoJson(filters: RfVisualizationFilters): Promise<RfGeoJson> {
	const resp = await fetchRfAggregate(filters);
	return {
		path: pathToGeoJson(resp.path ?? []),
		centroids: centroidsToGeoJson(resp.centroids ?? []),
		heatmap: hexCellsToGeoJson(resp.heatmap ?? [])
	};
}

/**
 * Svelte 5 runes store: read `.state`, call `.load()` to refresh,
 * call `.setFilters()` to change what gets fetched next.
 *
 * Using a class + $state for consistency with other Argos stores.
 */
class RfVisualizationStore {
	layerMode = $state<LayerMode>('heatmap');
	heatmapIntensity = $state(1);
	showPath = $state(true);
	showCentroids = $state(true);
	filters = $state<RfVisualizationFilters>({});
	features = $state<RfGeoJson>(EMPTY);
	loading = $state(false);
	error = $state<string | null>(null);

	setFilters(update: Partial<RfVisualizationFilters>): void {
		this.filters = { ...this.filters, ...update };
	}

	async load(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			this.features = await loadRfGeoJson(this.filters);
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
			this.features = EMPTY;
		} finally {
			this.loading = false;
		}
	}

	reset(): void {
		this.features = EMPTY;
		this.error = null;
	}
}

export const rfVisualization = new RfVisualizationStore();
