/**
 * NovaSDR docker-compose driver.
 *
 * Uses `docker compose -f docker/novasdr/docker-compose.yml <action> novasdr`
 * rather than raw `docker start` so the external `argos-dev-network` ID is
 * re-resolved on every invocation (self-heals after `docker network`
 * rebuilds). See `project_novasdr_network_id_drift` memory for history.
 *
 * `peer-webrx` claim policy — starts auto-evict a sibling WebSDR. Release
 * happens here on stop + start-error rollback. Serialized via `withWebRxLock`.
 */

import { json } from '@sveltejs/kit';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';

import { releaseHackRf } from '../claim';
import { resolveComposeFile } from '../paths';
import { webRxConflictResponse } from '../response';
import type { ToolDriver } from '../types';

const CONTAINER_NAME = 'novasdr-hackrf';
const TOOL_NAME = 'novasdr';
const SERVICE_NAME = 'novasdr';
const COMPOSE_FILE = resolveComposeFile('docker/novasdr/docker-compose.yml');

function composeArgs(action: 'start' | 'stop' | 'restart'): string[] {
	const base = ['compose', '-f', COMPOSE_FILE];
	if (action === 'start') return [...base, 'up', '-d', SERVICE_NAME];
	return [...base, action, SERVICE_NAME];
}

async function runDocker(action: 'start' | 'stop' | 'restart'): Promise<void> {
	await execFileAsync('docker', composeArgs(action));
}

async function getContainerStatus(): Promise<Response> {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	try {
		const { stdout } = await execFileAsync('docker', [
			'ps',
			'--filter',
			`name=${CONTAINER_NAME}`,
			'--format',
			'{{.Status}}'
		]);
		const running = stdout.trim().length > 0;
		return json({ success: true, running, status: running ? 'running' : 'stopped', owner });
	} catch {
		return json({ success: true, running: false, status: 'stopped', owner });
	}
}

export const novasdrDriver: ToolDriver = {
	toolName: TOOL_NAME,
	recoveryPolicy: 'peer-webrx',
	supportedActions: ['start', 'stop', 'restart', 'status'],
	serializeInLock: true,
	acquireOnStart: true,

	async start(): Promise<Response> {
		await runDocker('start');
		await delay(2000);
		return json({
			success: true,
			action: 'start',
			message: 'NovaSDR started successfully',
			url: env.NOVASDR_URL
		});
	},

	async stop(): Promise<Response> {
		await runDocker('stop');
		await releaseHackRf(TOOL_NAME, 'peer-webrx');
		return json({
			success: true,
			action: 'stop',
			message: 'NovaSDR stopped successfully'
		});
	},

	async restart(): Promise<Response> {
		await runDocker('restart');
		return json({
			success: true,
			action: 'restart',
			message: 'NovaSDR restarted successfully'
		});
	},

	status: getContainerStatus,

	buildConflictResponse: webRxConflictResponse
};
