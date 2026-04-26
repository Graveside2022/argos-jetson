import { error } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';
import { exportSession } from '$lib/server/services/rf/session-export';
import { getSession } from '$lib/server/services/session/session-tracker';

const FormatSchema = z.enum(['csv', 'kml']).default('csv');

/**
 * GET /api/sessions/:id/export?format=csv|kml
 *
 * Streams all signals belonging to the session, chunked, so a 50 k-row
 * export doesn't materialize in memory. Content-Disposition forces a
 * download in browsers.
 */
export const GET = createHandler(({ params, url }) => {
	const id = params.id ?? '';
	const sess = getSession(id);
	if (!sess) throw error(404, 'session not found');

	const parsed = FormatSchema.safeParse(url.searchParams.get('format') ?? 'csv');
	if (!parsed.success) throw error(400, 'format must be csv or kml');

	const { stream, contentType, filename } = exportSession(getRFDatabase().rawDb, id, parsed.data);
	return new Response(stream, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
});
