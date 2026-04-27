/**
 * Compute a 2σ confidence ellipse for a set of RSSI-weighted observation
 * points. Used by the Flying-Squirrel drill-down panel to paint a fuzzy
 * region around each device centroid that captures "where the transmitter
 * is probably located" given the observation distribution.
 *
 * Steps:
 *   1. Weight w_i = 10^(rssi_i / 10) — power-domain weighting, so strong
 *      signals dominate over weak ones.
 *   2. RSSI-weighted centroid (c_lat, c_lon).
 *   3. Weighted 2x2 covariance matrix in degrees.
 *   4. Eigen-decompose → principal axes + rotation.
 *   5. Scale eigenvalue magnitude by 2 (2σ) and convert degrees → meters.
 */

import type { DeviceEllipse } from '$lib/types/rf-ellipse';

export type { DeviceEllipse };

export interface ObservationLite {
	lat: number;
	lon: number;
	dbm: number;
}

const METERS_PER_DEG_LAT = 111_320;

function weight(dbm: number): number {
	return Math.pow(10, dbm / 10);
}

function weightedCentroid(pts: ObservationLite[]): {
	lat: number;
	lon: number;
	wSum: number;
} {
	let wSum = 0;
	let latSum = 0;
	let lonSum = 0;
	for (const p of pts) {
		const w = weight(p.dbm);
		wSum += w;
		latSum += p.lat * w;
		lonSum += p.lon * w;
	}
	return { lat: latSum / wSum, lon: lonSum / wSum, wSum };
}

function weightedCovariance(
	pts: ObservationLite[],
	cLat: number,
	cLon: number,
	wSum: number
): { sxx: number; syy: number; sxy: number } {
	let sxx = 0;
	let syy = 0;
	let sxy = 0;
	for (const p of pts) {
		const w = weight(p.dbm);
		const dx = p.lon - cLon;
		const dy = p.lat - cLat;
		sxx += w * dx * dx;
		syy += w * dy * dy;
		sxy += w * dx * dy;
	}
	return { sxx: sxx / wSum, syy: syy / wSum, sxy: sxy / wSum };
}

/**
 * Eigenvalues of a symmetric 2x2 covariance matrix.
 * Analytic closed form — no iteration needed.
 */
function eigenValues(sxx: number, syy: number, sxy: number): { l1: number; l2: number } {
	const tr = sxx + syy;
	const det = sxx * syy - sxy * sxy;
	const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
	return { l1: tr / 2 + disc, l2: tr / 2 - disc };
}

function rotationRadians(sxx: number, syy: number, sxy: number): number {
	// Standard 2x2 eigenvector rotation.
	return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

function metersPerDegLon(lat: number): number {
	return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function axisDegToMeters(
	lambda: number,
	rotationRad: number,
	cLat: number,
	isLonDominated: boolean
): number {
	// Approximate: at the centroid latitude, convert the axis length in
	// degrees to meters. `sqrt(lambda)` gives 1σ; multiply by 2 for 2σ.
	const oneSigmaDeg = Math.sqrt(Math.max(0, lambda));
	const twoSigmaDeg = 2 * oneSigmaDeg;
	const latComp = Math.abs(Math.sin(rotationRad));
	const lonComp = Math.abs(Math.cos(rotationRad));
	if (isLonDominated) {
		return twoSigmaDeg * (lonComp * metersPerDegLon(cLat) + latComp * METERS_PER_DEG_LAT);
	}
	return twoSigmaDeg * (latComp * metersPerDegLon(cLat) + lonComp * METERS_PER_DEG_LAT);
}

function hasVariance(sxx: number, syy: number): boolean {
	return sxx + syy > 1e-20;
}

export function computeDeviceEllipse(pts: ObservationLite[]): DeviceEllipse | null {
	if (pts.length < 2) return null;
	const centroid = weightedCentroid(pts);
	const cov = weightedCovariance(pts, centroid.lat, centroid.lon, centroid.wSum);
	if (!hasVariance(cov.sxx, cov.syy)) return null;

	const { l1, l2 } = eigenValues(cov.sxx, cov.syy, cov.sxy);
	const rotationRad = rotationRadians(cov.sxx, cov.syy, cov.sxy);

	// l1 is the larger eigenvalue; that axis is aligned with rotationRad.
	const majorLambda = Math.max(l1, l2);
	const minorLambda = Math.min(l1, l2);
	const semiMajorM = axisDegToMeters(majorLambda, rotationRad, centroid.lat, true);
	const semiMinorM = axisDegToMeters(minorLambda, rotationRad + Math.PI / 2, centroid.lat, false);

	return {
		centerLat: centroid.lat,
		centerLon: centroid.lon,
		semiMajorM: Math.max(semiMajorM, semiMinorM),
		semiMinorM: Math.min(semiMajorM, semiMinorM),
		rotationDeg: (rotationRad * 180) / Math.PI
	};
}
