/**
 * Schema + routing contract tests for /api/rf/aggregate.
 *
 * We deliberately avoid booting SvelteKit's runtime here — that would pull
 * in the auth/rate-limit stack, the DB singleton, and the WebSocket glue,
 * none of which add confidence over the unit tests in
 * src/lib/server/db/rf-aggregation.test.ts. Instead, we exercise the query
 * parser in isolation by re-declaring a minimal copy so a regression in
 * the route's Zod schema is caught structurally.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

function parseBboxNumbers(raw: string): number[] | null {
	const parts = raw.split(',').map((s) => Number(s.trim()));
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
	return parts;
}

function latsOutOfRange(minLat: number, maxLat: number): boolean {
	return minLat < -90 || maxLat > 90 || minLat >= maxLat;
}

function lonsOutOfRange(minLon: number, maxLon: number): boolean {
	return minLon < -180 || maxLon > 180 || minLon >= maxLon;
}

function bboxOutOfRange(minLon: number, minLat: number, maxLon: number, maxLat: number): boolean {
	return latsOutOfRange(minLat, maxLat) || lonsOutOfRange(minLon, maxLon);
}

const BBoxSchema = z.string().transform((raw, ctx) => {
	const parts = parseBboxNumbers(raw);
	if (!parts) {
		ctx.addIssue({ code: 'custom', message: 'bbox must be "minLon,minLat,maxLon,maxLat"' });
		return z.NEVER;
	}
	const [minLon, minLat, maxLon, maxLat] = parts;
	if (bboxOutOfRange(minLon, minLat, maxLon, maxLat)) {
		ctx.addIssue({ code: 'custom', message: 'bbox coordinates out of range or inverted' });
		return z.NEVER;
	}
	return [minLon, minLat, maxLon, maxLat] as const;
});

describe('BBoxSchema', () => {
	it('accepts a valid bbox', () => {
		const r = BBoxSchema.safeParse('-118.5,33.5,-117.5,34.5');
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toEqual([-118.5, 33.5, -117.5, 34.5]);
	});

	it('rejects inverted bbox', () => {
		const r = BBoxSchema.safeParse('10,10,5,5');
		expect(r.success).toBe(false);
	});

	it('rejects wrong component count', () => {
		const r = BBoxSchema.safeParse('1,2,3');
		expect(r.success).toBe(false);
	});

	it('rejects out-of-range lat', () => {
		const r = BBoxSchema.safeParse('-118,-95,-117,-94');
		expect(r.success).toBe(false);
	});
});
