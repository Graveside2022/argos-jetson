/**
 * OpenWebRX+ systemd driver. Delegates lifecycle to `sudo systemctl
 * {start,stop,restart} openwebrx` and status to `systemctl is-active`.
 *
 * HackRF claim is acquired at the lifecycle layer via the `peer-webrx`
 * policy (auto-evicts a sibling WebSDR). Release happens here on stop and
 * on start-error rollback. All calls are serialized through `withWebRxLock`.
 */

import { json } from '@sveltejs/kit';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';

import { releaseHackRf } from '../claim';
import { webRxConflictResponse } from '../response';
import type { ToolDriver } from '../types';

const SERVICE_NAME = 'openwebrx';
const TOOL_NAME = 'openwebrx';

async function runSystemctl(action: 'start' | 'stop' | 'restart'): Promise<void> {
	await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', action, SERVICE_NAME]);
}

async function getServiceStatus(): Promise<Response> {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	try {
		const { stdout } = await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/systemctl',
			'is-active',
			SERVICE_NAME
		]);
		const running = stdout.trim() === 'active';
		return json({ success: true, running, status: running ? 'running' : 'stopped', owner });
	} catch {
		return json({ success: true, running: false, status: 'stopped', owner });
	}
}

export const openwebrxDriver: ToolDriver = {
	toolName: TOOL_NAME,
	recoveryPolicy: 'peer-webrx',
	supportedActions: ['start', 'stop', 'restart', 'status'],
	serializeInLock: true,
	acquireOnStart: true,

	async start(): Promise<Response> {
		await runSystemctl('start');
		await delay(2000);
		return json({
			success: true,
			action: 'start',
			message: 'OpenWebRX started successfully',
			url: env.OPENWEBRX_URL
		});
	},

	async stop(): Promise<Response> {
		await runSystemctl('stop');
		await releaseHackRf(TOOL_NAME, 'peer-webrx');
		return json({
			success: true,
			action: 'stop',
			message: 'OpenWebRX stopped successfully'
		});
	},

	async restart(): Promise<Response> {
		await runSystemctl('restart');
		return json({
			success: true,
			action: 'restart',
			message: 'OpenWebRX restarted successfully'
		});
	},

	status: getServiceStatus,

	buildConflictResponse: webRxConflictResponse
};
