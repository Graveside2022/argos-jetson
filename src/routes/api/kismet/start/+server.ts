import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { startKismet } from '$lib/server/services/kismet/kismet-control-service';
import { startNewSession } from '$lib/server/services/session/session-tracker';

/**
 * POST /api/kismet/start
 * Starts Kismet WiFi discovery service
 */
export const POST = createHandler(async () => {
	const result = await startKismet();

	if (!result.success) {
		return json(result, { status: 500 });
	}

	// Roll a new RF-visualization session on a fresh Kismet run so observations
	// land in a scoped bucket. 'already_running' skips — no new run, no boundary.
	if (result.status === 'started' || result.status === 'starting') {
		startNewSession('kismet-start', 'Kismet WiFi discovery');
	}

	return result;
});
