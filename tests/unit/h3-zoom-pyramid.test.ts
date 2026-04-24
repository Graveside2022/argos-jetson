/**
 * Phase A.4 PR-2: zoom-to-H3-resolution pyramid.
 *
 * Flying Squirrel renders wide-area coarse bins at low zoom (continent / city)
 * and sharp bins at high zoom (street). Argos's previous single-res (11) was
 * fine at city scale but starved the 10k feature cap when a mission covered a
 * large area at low zoom. The pyramid picks:
 *   zoom <  10 → res 9   (~0.1 km² cells)
 *   zoom 10–13 → res 11  (~0.006 km² cells — the prior default)
 *   zoom >  13 → res 13  (~0.0001 km² cells — block-level)
 */

import { describe, expect, it } from 'vitest';

import { h3ResForZoom } from '$lib/server/db/rf-aggregation';

describe('h3ResForZoom', () => {
	it('returns 9 at zoom 5 (continental view)', () => {
		expect(h3ResForZoom(5)).toBe(9);
	});

	it('returns 9 at zoom 9 — below the 10 boundary', () => {
		expect(h3ResForZoom(9)).toBe(9);
	});

	it('returns 11 at zoom 10 — inclusive low bound', () => {
		expect(h3ResForZoom(10)).toBe(11);
	});

	it('returns 11 at zoom 13 — inclusive high bound', () => {
		expect(h3ResForZoom(13)).toBe(11);
	});

	it('returns 13 at zoom 14 — just above the 13 boundary', () => {
		expect(h3ResForZoom(14)).toBe(13);
	});

	it('returns 13 at zoom 19 (street view)', () => {
		expect(h3ResForZoom(19)).toBe(13);
	});

	it('returns 11 for non-finite zoom (NaN defensive default)', () => {
		expect(h3ResForZoom(Number.NaN)).toBe(11);
	});

	it('returns 11 for undefined zoom (backwards-compat default)', () => {
		expect(h3ResForZoom(undefined)).toBe(11);
	});

	it('clamps negative zoom to res 9 (caller bug, not crash)', () => {
		expect(h3ResForZoom(-5)).toBe(9);
	});

	it('non-integer zoom 12.7 falls into the 10–13 bucket', () => {
		expect(h3ResForZoom(12.7)).toBe(11);
	});
});
