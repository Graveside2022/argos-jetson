import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getDeviceObservations } from '$lib/server/db/rf-aggregation';

/**
 * GET /api/rf/observations?bssid=<deviceId>&session=<sessionId>
 *                        &bbox=<minLon,minLat,maxLon,maxLat>&start=<ms>&end=<ms>
 *
 * Returns raw signal observations for a single BSSID, used by the
 * Flying-Squirrel highlight-on-select UI to draw rays from the AP
 * centroid to each observation point.
 *
 * Auth inherits from the global /api/* fail-closed gate.
 */

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

const IntSchema = z
	.string()
	.regex(/^-?\d+$/)
	.transform((s) => Number.parseInt(s, 10));

const QuerySchema = z.object({
	bssid: z.string().min(1),
	session: z.string().min(1).optional(),
	bbox: BBoxSchema.optional(),
	start: IntSchema.optional(),
	end: IntSchema.optional()
});

export const GET = createHandler(async ({ url }) => {
	const raw = Object.fromEntries(url.searchParams.entries());
	const parsed = QuerySchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const q = parsed.data;
	if (q.start !== undefined && q.end !== undefined && q.start > q.end) {
		throw error(400, 'start must be <= end');
	}
	const observations = getDeviceObservations({
		deviceId: q.bssid,
		sessionId: q.session,
		bbox: q.bbox as [number, number, number, number] | undefined,
		startTs: q.start,
		endTs: q.end
	});
	return json({ observations });
});
