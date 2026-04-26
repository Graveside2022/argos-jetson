/**
 * GET /api/rf/stream?session=<id>
 *
 * Server-Sent Events channel that emits a frame for every RF observation
 * persisted into `rf_signals.db`. Backed by `SignalBus` — every successful
 * `insertSignal` / `insertSignalsBatch` fans out here. Clients subscribe
 * and append deltas to the map without polling.
 *
 * Auth is inherited from the global fail-closed gate in hooks.server.ts.
 * No route-specific check is needed.
 */

import { getCorsHeaders } from '$lib/server/security/cors';
import { createSignalStream } from '$lib/server/services/rf/signal-stream';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, request }) => {
	const sessionId = url.searchParams.get('session') ?? undefined;
	const origin = request.headers.get('origin');
	const stream = createSignalStream({ sessionId });

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
