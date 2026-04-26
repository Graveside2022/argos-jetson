/**
 * POST /api/spectrum/start
 *
 * Multi-SDR-aware sweep start. Body validated by `StartSpectrumRequestSchema`
 * (src/lib/schemas/spectrum.ts). Resolves `device` to a `HardwareDevice`
 * enum, instantiates the matching `SpectrumSource` via the factory, and
 * promotes it to active in `sourceRegistry`. The SSE proxy at
 * `/api/spectrum/stream/+server.ts` then fans the source's events out to
 * subscribed browsers.
 *
 * Idempotent: calling start while already streaming swaps to the new
 * config / device. The previous source is stopped + cleaned before the
 * new one is started.
 */

import { json } from '@sveltejs/kit';

import { StartSpectrumRequestSchema } from '$lib/schemas/spectrum';
import { createHandler } from '$lib/server/api/create-handler';
import { createSpectrumSource, resolveDeviceType } from '$lib/server/spectrum/factory';
import { sourceRegistry } from '$lib/server/spectrum/source-registry';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = createHandler(async ({ request }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(StartSpectrumRequestSchema, rawBody, 'user-action');
	if (!validated) {
		return json(
			{ status: 'error', message: 'Invalid spectrum sweep configuration' },
			{ status: 400 }
		);
	}

	const device = resolveDeviceType(validated.device);
	logger.info('[spectrum/start] starting', {
		device,
		startFreq: validated.config.startFreq,
		endFreq: validated.config.endFreq,
		binWidth: validated.config.binWidth
	});

	await sourceRegistry.clear();
	const source = createSpectrumSource(device);
	sourceRegistry.setActive(source);

	try {
		await source.start(validated.config);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error('[spectrum/start] source.start raised', { device, err: msg });
		await sourceRegistry.clear();
		return json({ status: 'error', message: msg }, { status: 500 });
	}

	return {
		status: 'success',
		device,
		config: validated.config,
		state: source.getStatus().state
	};
});
