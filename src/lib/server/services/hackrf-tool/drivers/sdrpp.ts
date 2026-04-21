/**
 * SDR++ VNC-stack driver. Delegates to `sdrpp-vnc-control-service`.
 *
 * Divergence from openwebrx/novasdr:
 *   - success JSON includes `wsPort` + `wsPath` on start/restart
 *   - start/restart may fail at the VNC stack layer and return a 500 with
 *     a tool-specific error message (not via thrown exception)
 *   - stop doesn't emit a `url` or VNC extras
 *
 * All three invariants are preserved here to keep byte-identical parity.
 */

import { json } from '@sveltejs/kit';

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import {
	getSdrppVncStatus,
	startSdrppVnc,
	stopSdrppVnc
} from '$lib/server/services/sdrpp/sdrpp-vnc-control-service';
import { logger } from '$lib/utils/logger';

import { acquireHackRf, releaseHackRf } from '../claim';
import { webRxConflictResponse } from '../response';
import type { FullActionDriver } from '../types';

const TOOL_NAME = 'sdrpp';

function statusResponse(): Response {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	const vncStatus = getSdrppVncStatus();
	return json({
		success: true,
		running: vncStatus.isRunning,
		status: vncStatus.isRunning ? 'running' : 'stopped',
		owner,
		wsPort: vncStatus.wsPort,
		wsPath: vncStatus.wsPath
	});
}

async function runStart(action: 'start' | 'restart'): Promise<Response> {
	const vncResult = await startSdrppVnc();
	if (!vncResult.success) {
		logger.error('[sdrpp-control] VNC start failed, releasing HackRF claim');
		await releaseHackRf(TOOL_NAME, 'peer-webrx');
		return json(
			{
				success: false,
				error:
					action === 'restart'
						? 'Failed to restart SDR++ VNC stack'
						: 'Failed to start SDR++ VNC stack'
			},
			{ status: 500 }
		);
	}
	return json({
		success: true,
		action,
		message:
			action === 'restart' ? 'SDR++ restarted successfully' : 'SDR++ started successfully',
		wsPort: vncResult.wsPort,
		wsPath: vncResult.wsPath
	});
}

export const sdrppDriver: FullActionDriver = {
	toolName: TOOL_NAME,
	recoveryPolicy: 'peer-webrx',
	supportedActions: ['start', 'stop', 'restart', 'status'],
	serializeInLock: true,
	acquireOnStart: true,

	start: () => runStart('start'),

	async stop(): Promise<Response> {
		await stopSdrppVnc();
		await releaseHackRf(TOOL_NAME, 'peer-webrx');
		return json({
			success: true,
			action: 'stop',
			message: 'SDR++ stopped successfully'
		});
	},

	// Restart = stop-then-start inside the same lock (preserves pre-refactor semantics).
	async restart(): Promise<Response> {
		await stopSdrppVnc();
		await releaseHackRf(TOOL_NAME, 'peer-webrx');
		const claim = await acquireHackRf(TOOL_NAME, 'peer-webrx');
		if (!claim.success) return webRxConflictResponse(claim);
		return runStart('restart');
	},

	status: statusResponse,

	buildConflictResponse: webRxConflictResponse
};
