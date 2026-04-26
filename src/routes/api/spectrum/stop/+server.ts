/**
 * POST /api/spectrum/stop
 *
 * Stops the currently-active SpectrumSource (if any) and clears the
 * registry. Idempotent — calling on an idle registry is a no-op success.
 */

import { createHandler } from '$lib/server/api/create-handler';
import { sourceRegistry } from '$lib/server/spectrum/source-registry';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = createHandler(async () => {
	const active = sourceRegistry.getActive();
	if (!active) {
		return { status: 'success', message: 'No active spectrum source', state: 'idle' };
	}

	const device = active.device;
	logger.info('[spectrum/stop] stopping', { device });
	await sourceRegistry.clear();

	return { status: 'success', device, state: 'idle' };
});
