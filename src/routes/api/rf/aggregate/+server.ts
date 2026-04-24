import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getApCentroids,
	getDrivePath,
	getRssiHexCells,
	h3ResForZoom,
	type RfQueryFilters
} from '$lib/server/db/rf-aggregation';

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

const CsvListSchema = z.string().transform((raw) =>
	raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
);

const IntSchema = z
	.string()
	.regex(/^-?\d+$/)
	.transform((s) => Number.parseInt(s, 10));

const QuerySchema = z.object({
	layer: z.enum(['heatmap', 'centroids', 'path', 'all']).default('all'),
	session: z.string().min(1).optional(),
	bssid: CsvListSchema.optional(),
	bbox: BBoxSchema.optional(),
	start: IntSchema.optional(),
	end: IntSchema.optional(),
	h3res: IntSchema.optional(),
	zoom: z
		.string()
		.transform((v) => Number(v))
		.pipe(z.number().finite())
		.optional()
});

function toFilters(q: z.infer<typeof QuerySchema>): RfQueryFilters {
	return {
		sessionId: q.session,
		deviceIds: q.bssid,
		bbox: q.bbox as RfQueryFilters['bbox'],
		startTs: q.start,
		endTs: q.end
	};
}

/**
 * GET /api/rf/aggregate?layer=heatmap|centroids|path|all
 *                      &session=<id>&bssid=<csv>&bbox=<minLon,minLat,maxLon,maxLat>
 *                      &start=<ms>&end=<ms>&h3res=<5..15>
 *
 * Feeds the Flying-Squirrel-style map layers. Auth inherits from the
 * global /api/* fail-closed gate in hooks.server.ts.
 */
function runLayer(
	layer: z.infer<typeof QuerySchema>['layer'],
	filters: RfQueryFilters,
	h3res: number
): Record<string, unknown> {
	if (layer === 'heatmap') return { heatmap: getRssiHexCells(filters, h3res) };
	if (layer === 'centroids') return { centroids: getApCentroids(filters) };
	if (layer === 'path') return { path: getDrivePath(filters) };
	return {
		heatmap: getRssiHexCells(filters, h3res),
		centroids: getApCentroids(filters),
		path: getDrivePath(filters)
	};
}

export const GET = createHandler(async ({ url }) => {
	const raw = Object.fromEntries(url.searchParams.entries());
	const parsed = QuerySchema.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const q = parsed.data;
	const h3res = q.h3res ?? h3ResForZoom(q.zoom);
	return json(runLayer(q.layer, toFilters(q), h3res));
});
