/**
 * GET /api/spectrum/stream
 *
 * Server-Sent Events fan-out from the active SpectrumSource. Backed by
 * `sourceRegistry`'s event emitter — every frame the active source
 * produces is forwarded here. Auth is inherited from the global
 * fail-closed gate in src/hooks.server.ts (no route-specific check).
 *
 * Pattern mirrors /api/rf/stream (pure SSE-stream factory + thin HTTP
 * wrapper). See src/routes/api/rf/stream/+server.ts.
 */

import { getCorsHeaders } from '$lib/server/security/cors';
import { createSpectrumStream } from '$lib/server/spectrum/spectrum-stream';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	const stream = createSpectrumStream();

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
			...getCorsHeaders(origin)
		}
	});
};
