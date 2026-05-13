/**
 * GET /api/spectrum/status
 *
 * Returns the active SpectrumSource's `SourceStatus` shape (device,
 * state, current config, last frame timestamp). Returns `{ state: 'idle' }`
 * when no source is active.
 */

import { createHandler } from '$lib/server/api/create-handler';
import { sourceRegistry } from '$lib/server/spectrum/source-registry';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = createHandler(async () => {
	const active = sourceRegistry.getActive();
	if (!active) {
		return { state: 'idle', device: null };
	}
	return active.getStatus();
});
