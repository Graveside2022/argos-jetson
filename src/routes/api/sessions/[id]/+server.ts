import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getSession, updateSessionMetadata } from '$lib/server/services/session/session-tracker';

const PatchBody = z.object({
	operatorId: z.string().max(64).nullable().optional(),
	assetId: z.string().max(64).nullable().optional(),
	areaName: z.string().max(128).nullable().optional(),
	notes: z.string().max(1024).nullable().optional()
});

/**
 * GET /api/sessions/:id
 * Fetch a single session by id, including mission metadata (PR-4).
 */
export const GET = createHandler(async ({ params }) => {
	const sess = getSession(params.id ?? '');
	if (!sess) throw error(404, 'session not found');
	return json(sess);
});

/**
 * PATCH /api/sessions/:id
 * Body: { operatorId?, assetId?, areaName?, notes? } — each nullable.
 * Updates the mission-metadata fields added in migration 007.
 */
export const PATCH = createHandler(async ({ params, request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = PatchBody.safeParse(raw);
	if (!parsed.success) {
		throw error(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const updated = updateSessionMetadata(params.id ?? '', parsed.data);
	if (!updated) throw error(404, 'session not found');
	return json(updated);
});
