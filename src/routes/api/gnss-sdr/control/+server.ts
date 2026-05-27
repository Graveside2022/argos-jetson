/**
 * POST /api/gnss-sdr/control
 *
 * Control the GNSS-SDR + RTKLIB VNC stack (Xtigervnc + gnss-sdr +
 * rtknavi_qt + rtkplot_qt + websockify + socat). Claims the B205 via
 * the ResourceManager singleton.
 *
 * Lifecycle orchestration lives in {@link
 * $lib/server/services/gnss-sdr-vnc/gnss-sdr-vnc-control-service}. This
 * file is intentionally thin — the route only binds the URL to that
 * control service.
 *
 * Body: `{ action: 'start' | 'stop' | 'status', options?: GnssSdrStartOptions }`
 * Start success includes `wsPort` + `wsPath` for the noVNC client.
 */

import { json } from '@sveltejs/kit';

import {
	getGnssSdrVncStatus,
	startGnssSdrVnc,
	stopGnssSdrVnc
} from '$lib/server/services/gnss-sdr-vnc/gnss-sdr-vnc-control-service';
import type { GnssSdrStartOptions } from '$lib/server/services/gnss-sdr-vnc/gnss-sdr-vnc-types';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

interface RequestBody {
	action?: string;
	options?: GnssSdrStartOptions;
}

// eslint-disable-next-line complexity
export const POST: RequestHandler = async ({ request }) => {
	let body: RequestBody;
	try {
		body = (await request.json()) as RequestBody;
	} catch {
		return json({ success: false, error: 'invalid JSON body' }, { status: 400 });
	}

	const action = body.action;
	logger.info('[api/gnss-sdr/control] received', { action });

	switch (action) {
		case 'start':
			return json(await startGnssSdrVnc(body.options ?? {}));
		case 'stop':
			return json(await stopGnssSdrVnc());
		case 'status':
			return json(getGnssSdrVncStatus());
		default:
			return json(
				{ success: false, error: `unknown action: ${String(action)}` },
				{ status: 400 }
			);
	}
};
