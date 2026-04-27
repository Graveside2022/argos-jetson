/**
 * Convert a `DeviceEllipse` (center + axes + rotation) to a 64-point
 * GeoJSON Polygon so MapLibre can paint it as a fill. The ellipse axes
 * are in meters; we unproject meters → degrees using the equirectangular
 * approximation at the centroid's latitude.
 */

import type { Feature, Polygon } from 'geojson';

import type { DeviceEllipse } from '$lib/types/rf-ellipse';

const POINTS = 64;
const METERS_PER_DEG_LAT = 111_320;
/**
 * Threshold below which `metersPerDegLon` is treated as effectively zero.
 * Near the poles `cos(lat)` collapses to ~0, which would otherwise produce
 * Infinity/NaN longitudes when we divide by it. 1e-6 m/deg ≈ a longitude
 * within ~1e-9 deg of the pole — beyond any sensible RF-fix precision.
 */
const MPLON_EPS = 1e-6;

function metersPerDegLon(lat: number): number {
	return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function ellipseToPolygon(e: DeviceEllipse): Feature<Polygon> {
	const rotRad = (e.rotationDeg * Math.PI) / 180;
	const cosR = Math.cos(rotRad);
	const sinR = Math.sin(rotRad);
	const mplon = metersPerDegLon(e.centerLat);
	// Guard against pole singularity: when |mplon| collapses below EPS the
	// horizontal offset becomes meaningless. Fall back to no longitudinal
	// scaling so the polygon degenerates gracefully instead of producing
	// Infinity coordinates that crash MapLibre.
	const safeMplon = Math.abs(mplon) < MPLON_EPS ? null : mplon;
	const ring: [number, number][] = [];

	// Emit POINTS distinct vertices around the ellipse. We then close the
	// ring by appending an exact copy of ring[0] — relying on `t = 2π` to
	// reproduce the first vertex risks floating-point drift, which would
	// violate GeoJSON's Polygon-ring closure requirement (RFC 7946 §3.1.6).
	for (let i = 0; i < POINTS; i++) {
		const t = (i / POINTS) * 2 * Math.PI;
		// Ellipse parametric in local meters.
		const xm = e.semiMajorM * Math.cos(t);
		const ym = e.semiMinorM * Math.sin(t);
		// Rotate then translate.
		const xr = xm * cosR - ym * sinR;
		const yr = xm * sinR + ym * cosR;
		const lon = safeMplon === null ? e.centerLon : e.centerLon + xr / safeMplon;
		const lat = e.centerLat + yr / METERS_PER_DEG_LAT;
		ring.push([lon, lat]);
	}
	// Close the ring by repeating the first vertex exactly.
	ring.push([ring[0][0], ring[0][1]]);

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
