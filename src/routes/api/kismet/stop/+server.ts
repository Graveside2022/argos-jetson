import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { getKismetSignalSource } from '$lib/server/services/rf/kismet-source-singleton';
import { getCurrentSessionId } from '$lib/server/services/session/session-tracker';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

/** Find running Kismet PIDs. Returns empty array if none found. */
async function findKismetPids(): Promise<string[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout
			.trim()
			.split('\n')
			.filter((p) => p.length > 0);
	} catch {
		return [];
	}
}

/** Check if Kismet is still running. */
async function isKismetRunning(): Promise<boolean> {
	return (await findKismetPids()).length > 0;
}

/** Gracefully terminate Kismet, escalating to SIGKILL if needed. */
async function terminateKismet(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet']);
		logger.info('Sent SIGTERM to Kismet processes');
		await delay(2000);

		if (await isKismetRunning()) {
			logger.warn('Some Kismet processes still running, sending SIGKILL');
			await execFileAsync('/usr/bin/pkill', ['-KILL', 'kismet']);
			await delay(1000);
		}
	} catch (error) {
		logger.error('Error during Kismet termination', { error: errMsg(error) });
	}
}

/** Clean up kismon interface if it exists. */
async function cleanupKismonInterface(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['ip', 'link', 'delete', 'kismon0']);
	} catch {
		/* interface might not exist */
	}
}

export const POST = createHandler(async () => {
	logger.info('Stopping Kismet with robust cleanup');

	const pids = await findKismetPids();
	if (pids.length === 0) {
		logger.info('No Kismet processes found');
		// Bridge is bound to Kismet — nothing to bridge if Kismet is gone.
		await getKismetSignalSource().stop();
		return { success: true, status: 'stopped', message: 'Kismet was not running' };
	}

	logger.info('Found Kismet processes to terminate', { pids: pids.join(', ') });
	await terminateKismet();
	await cleanupKismonInterface();

	// Confirm Kismet is actually stopped BEFORE tearing down the persistence
	// bridge. If termination failed, the bridge must keep running so signals
	// continue flowing into rf_signals.db while the operator retries.
	if (await isKismetRunning()) {
		logger.error('Kismet processes may still be running — leaving bridge active');
		// Defensive: ensure the bridge is up (idempotent if already running).
		try {
			await getKismetSignalSource().start(getCurrentSessionId());
		} catch (err) {
			logger.warn(
				'Failed to keep Kismet bridge active after stop failure',
				{ error: errMsg(err) },
				'kismet-bridge-restart-failed'
			);
		}
		return json(
			{ success: false, status: 'error', message: 'Failed to stop all Kismet processes' },
			{ status: 500 }
		);
	}

	// Termination confirmed — now safe to stop the bridge.
	await getKismetSignalSource().stop();

	logger.info('Verification passed: No Kismet processes found');
	return {
		success: true,
		status: 'stopped',
		message: 'Kismet WiFi discovery stopped successfully'
	};
});
