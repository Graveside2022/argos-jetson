import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { withWebRxLock } from '$lib/server/api/webrx-control-lock';
import { acquireHackRfForWebRx, releaseHackRfForWebRx } from '$lib/server/api/webrx-hackrf-claim';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';

const SERVICE_NAME = 'openwebrx';
const TOOL_NAME = 'openwebrx';

const ControlActionSchema = z.object({
	action: z.enum(['start', 'stop', 'restart', 'status'])
});
type ControlBody = z.infer<typeof ControlActionSchema>;
type ControlAction = ControlBody['action'];

/** Read `systemctl is-active openwebrx` and return the current HackRF owner. */
async function getServiceStatus(): Promise<Response> {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	try {
		const { stdout } = await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/systemctl',
			'is-active',
			SERVICE_NAME
		]);
		const running = stdout.trim() === 'active';
		return json({
			success: true,
			running,
			status: running ? 'running' : 'stopped',
			owner
		});
	} catch {
		// is-active returns non-zero when inactive — that is not an error here.
		return json({ success: true, running: false, status: 'stopped', owner });
	}
}

/** Build the 409 Conflict response for a failed HackRF acquire. */
function buildConflictResponse(claim: { owner?: string; message?: string }): Response {
	return json(
		{
			success: false,
			error: claim.message,
			conflictingService: claim.owner
		},
		{ status: 409 }
	);
}

/** Run `sudo systemctl <action> openwebrx` and release the HackRF claim on failure. */
async function runSystemctlAction(
	action: Exclude<ControlAction, 'status'>,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', action, SERVICE_NAME]);
		if (action === 'start') await delay(2000);
		if (action === 'stop') await releaseHackRfForWebRx(TOOL_NAME);
		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		return json({ success: true, action, message, ...extra });
	} catch (err) {
		if (action === 'start') await releaseHackRfForWebRx(TOOL_NAME);
		throw err;
	}
}

/**
 * Execute a systemd lifecycle command inside the shared WebRX lock.
 *
 * `start` acquires the HackRF via ResourceManager (auto-stops the peer WebSDR
 * if it's currently holding the device). `stop` releases the HackRF after the
 * unit is down. Any systemctl failure releases the claim so the registry
 * isn't left in an orphaned state.
 */
async function systemctlLifecycle(
	action: Exclude<ControlAction, 'status'>,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	return withWebRxLock(async () => {
		if (action === 'start') {
			const claim = await acquireHackRfForWebRx(TOOL_NAME);
			if (!claim.success) return buildConflictResponse(claim);
		}
		return runSystemctlAction(action, message, extra);
	});
}

const LIFECYCLE_EXTRAS: Record<ControlAction, Record<string, unknown> | undefined> = {
	start: { url: env.OPENWEBRX_URL },
	stop: undefined,
	restart: undefined,
	status: undefined
};

const LIFECYCLE_MESSAGES: Record<Exclude<ControlAction, 'status'>, string> = {
	start: 'OpenWebRX started successfully',
	stop: 'OpenWebRX stopped successfully',
	restart: 'OpenWebRX restarted successfully'
};

/** Execute validated OpenWebRX action. */
function executeAction(action: ControlAction): Promise<Response> {
	if (action === 'status') return getServiceStatus();
	return systemctlLifecycle(action, LIFECYCLE_MESSAGES[action], LIFECYCLE_EXTRAS[action]);
}

/**
 * POST /api/openwebrx/control
 * Control the native OpenWebRX+ systemd service (luarvique PPA). Shares a
 * HackRF with NovaSDR/SDR++ via the ResourceManager singleton — starting
 * OpenWebRX while a peer holds the HackRF auto-stops the peer and reclaims,
 * while starting OpenWebRX while GSM Evil or any other non-peer tool holds
 * it returns 409 Conflict.
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST = createHandler(
	async ({ request }) => {
		const { action } = (await request.json()) as ControlBody;
		return executeAction(action);
	},
	{ validateBody: ControlActionSchema }
);
