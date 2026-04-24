/**
 * Convert a `DeviceEllipse` (center + axes + rotation) to a 64-point
 * GeoJSON Polygon so MapLibre can paint it as a fill. The ellipse axes
 * are in meters; we unproject meters → degrees using the equirectangular
 * approximation at the centroid's latitude.
 */

import type { Feature, Polygon } from 'geojson';

import type { DeviceEllipse } from '$lib/stores/rf-visualization.svelte';

const POINTS = 64;
const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLon(lat: number): number {
	return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function ellipseToPolygon(e: DeviceEllipse): Feature<Polygon> {
	const rotRad = (e.rotationDeg * Math.PI) / 180;
	const cosR = Math.cos(rotRad);
	const sinR = Math.sin(rotRad);
	const mplon = metersPerDegLon(e.centerLat);
	const ring: [number, number][] = [];

	for (let i = 0; i <= POINTS; i++) {
		const t = (i / POINTS) * 2 * Math.PI;
		// Ellipse parametric in local meters.
		const xm = e.semiMajorM * Math.cos(t);
		const ym = e.semiMinorM * Math.sin(t);
		// Rotate then translate.
		const xr = xm * cosR - ym * sinR;
		const yr = xm * sinR + ym * cosR;
		const lon = e.centerLon + xr / mplon;
		const lat = e.centerLat + yr / METERS_PER_DEG_LAT;
		ring.push([lon, lat]);
	}

	return {
		type: 'Feature',
		geometry: { type: 'Polygon', coordinates: [ring] },
		properties: {
			centerLat: e.centerLat,
			centerLon: e.centerLon,
			semiMajorM: e.semiMajorM,
			semiMinorM: e.semiMinorM,
			rotationDeg: e.rotationDeg
		}
	};
}
