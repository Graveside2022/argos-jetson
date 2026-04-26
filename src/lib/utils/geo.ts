/**
 * Shared geographic utilities — importable from both client and server code.
 * Pure functions, no server-only dependencies.
 */

import { GEO } from '$lib/constants/limits';

/**
 * FNV-1a 32-bit hash of a MAC address, normalized to [0, 1).
 * Deterministic: same MAC always produces the same value.
 * Canonical implementation — used for both server-side GPS fallback
 * and client-side visual dot spreading.
 */
export function hashMAC(mac: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x01000193) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/** Second independent FNV-1a hash (different seed) for the same MAC → [0, 1). */
export function hashMAC2(mac: string): number {
	let hash = 0x01000193;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x811c9dc5) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/**
 * Convert a MAC hash [0,1) to an angle in radians [0, 2π).
 * Used for deterministic radial spreading of client positions around APs.
 */
export function macToAngle(mac: string): number {
	return hashMAC(mac) * 2 * Math.PI;
}

/**
 * Haversine distance in meters between two lat/lon coordinate pairs.
 * Canonical implementation — all haversine calculations should use this.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = GEO.EARTH_RADIUS_M;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Haversine distance in kilometers (convenience wrapper). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	return haversineMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Forward azimuth (great-circle initial bearing) from point 1 to point 2,
 * in degrees [0, 360). 0 = north, 90 = east. Used for operator-bearing
 * displays where the receiver position is known.
 */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;
	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
	const θ = Math.atan2(y, x);
	return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Inverse of haversine: project a point at `bearingDeg` and `distanceM`
 * from a known origin. Returns `[lon, lat]` so the result drops directly
 * into a MapLibre LineString without re-ordering. Used by PR6 MAP screen
 * to render bearing rays from the operator GPS fix to each detection.
 */
export function destinationPoint(
	lat: number,
	lon: number,
	bearing: number,
	distanceM: number
): [number, number] {
	const R = GEO.EARTH_RADIUS_M;
	const δ = distanceM / R;
	const θ = (bearing * Math.PI) / 180;
	const φ1 = (lat * Math.PI) / 180;
	const λ1 = (lon * Math.PI) / 180;
	const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
	const φ2 = Math.asin(sinφ2);
	const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
	const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
	const λ2 = λ1 + Math.atan2(y, x);
	const lonOut = (((λ2 * 180) / Math.PI + 540) % 360) - 180;
	return [lonOut, (φ2 * 180) / Math.PI];
}
