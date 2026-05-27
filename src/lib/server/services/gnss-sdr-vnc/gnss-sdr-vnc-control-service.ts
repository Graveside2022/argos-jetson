/**
 * Public start/stop/status API for the GNSS-SDR + RTKLIB VNC stack.
 *
 * Orchestrates the six-process stack (Xtigervnc + gnss-sdr + rtknavi_qt +
 * rtkplot_qt + websockify + socat) that gives operators a software GNSS
 * receiver visualised live in the Argos dashboard. Claims the B205 via
 * the resourceManager singleton so other SDR tools cannot grab it.
 *
 * Mirrors {@link ../sdrpp/sdrpp-vnc-control-service.ts}.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { createVncShutdownHandler, throwIfSpawnError } from '../vnc-common/spawn-helpers';
import {
	centerRtklibWindows,
	clearSpawnError,
	ensureNmeaFifo,
	getSpawnError,
	isStackAlive,
	killAllProcesses,
	killOrphansByPort,
	removeNmeaFifo,
	setVncBackground,
	spawnGnssSdr,
	spawnRtknavi,
	spawnRtkplot,
	spawnSocatNmeaBridge,
	spawnWebsockify,
	spawnXtigervnc,
	waitForStackReady,
	writeGeneratedConf
} from './gnss-sdr-vnc-processes';
import {
	GNSS_SDR_OWNER,
	GNSS_SDR_WS_PATH,
	GNSS_SDR_WS_PORT,
	type GnssSdrStartOptions,
	type GnssSdrVncControlResult,
	type GnssSdrVncStatusResult
} from './gnss-sdr-vnc-types';

const GNSS_SDR_INIT_DELAY_MS = 2500;
const RTKLIB_INIT_DELAY_MS = 1200;
const SHORT_DELAY_MS = 400;
const SOCAT_INIT_DELAY_MS = 200;

async function releaseB205(): Promise<void> {
	await resourceManager.release(GNSS_SDR_OWNER, HardwareDevice.B205).catch(() => undefined);
}

async function claimB205(): Promise<GnssSdrVncControlResult | null> {
	const claim = await resourceManager.acquire(GNSS_SDR_OWNER, HardwareDevice.B205);
	if (claim.success) return null;
	logger.warn('[gnss-sdr-vnc] B205 unavailable', { owner: claim.owner });
	return {
		success: false,
		message: `B205 is in use by ${claim.owner ?? 'another tool'}`,
		error: `b205-locked-by:${claim.owner ?? 'unknown'}`
	};
}

// ───────────────────── shutdown handler (idempotent) ─────────────────────

const registerShutdownHandler = createVncShutdownHandler('gnss-sdr-vnc', killAllProcesses);

// ─────────────────────────────── start ──────────────────────────────────

function assertNoSpawnError(): void {
	throwIfSpawnError(getSpawnError);
}

async function spawnStackProcesses(options: GnssSdrStartOptions): Promise<void> {
	clearSpawnError();

	const confPath = writeGeneratedConf(options);
	ensureNmeaFifo();

	logger.info('[gnss-sdr-vnc] spawning Xtigervnc');
	spawnXtigervnc();
	await delay(SHORT_DELAY_MS);
	assertNoSpawnError();

	setVncBackground();

	logger.info('[gnss-sdr-vnc] spawning gnss-sdr', { confPath });
	spawnGnssSdr(confPath);
	await delay(GNSS_SDR_INIT_DELAY_MS);
	assertNoSpawnError();

	logger.info('[gnss-sdr-vnc] spawning rtknavi_qt + rtkplot_qt');
	spawnRtknavi();
	spawnRtkplot();
	await delay(RTKLIB_INIT_DELAY_MS);
	assertNoSpawnError();

	centerRtklibWindows();

	logger.info('[gnss-sdr-vnc] spawning websockify');
	spawnWebsockify();
	await delay(SHORT_DELAY_MS);
	assertNoSpawnError();

	logger.info('[gnss-sdr-vnc] spawning socat NMEA bridge -> gpsd');
	spawnSocatNmeaBridge();
	await delay(SOCAT_INIT_DELAY_MS);
	assertNoSpawnError();
}

async function cleanupFailedStart(): Promise<GnssSdrVncControlResult> {
	logger.error('[gnss-sdr-vnc] stack failed to become ready within timeout');
	await killAllProcesses();
	await killOrphansByPort();
	removeNmeaFifo();
	return {
		success: false,
		message: 'Failed to start GNSS-SDR VNC stack',
		error: 'Timeout waiting for VNC and websockify to respond'
	};
}

function successResult(message: string): GnssSdrVncControlResult {
	return {
		success: true,
		message,
		wsPort: GNSS_SDR_WS_PORT,
		wsPath: GNSS_SDR_WS_PATH
	};
}

/** Start the stack. Idempotent — returns the existing session if already running. */
// eslint-disable-next-line complexity
export async function startGnssSdrVnc(
	options: GnssSdrStartOptions = {}
): Promise<GnssSdrVncControlResult> {
	try {
		registerShutdownHandler();

		if (isStackAlive()) {
			logger.info('[gnss-sdr-vnc] stack already running');
			return successResult('GNSS-SDR VNC stack already running');
		}

		const conflict = await claimB205();
		if (conflict) return conflict;

		await killOrphansByPort();
		await spawnStackProcesses(options);

		if (!(await waitForStackReady())) {
			await releaseB205();
			return cleanupFailedStart();
		}

		logger.info('[gnss-sdr-vnc] stack ready', { wsPort: GNSS_SDR_WS_PORT });
		return successResult('GNSS-SDR VNC stack started');
	} catch (error: unknown) {
		logger.error('[gnss-sdr-vnc] start error', { error: errMsg(error) });
		await killAllProcesses().catch(() => undefined);
		removeNmeaFifo();
		await releaseB205();
		return {
			success: false,
			message: 'Failed to start GNSS-SDR VNC stack',
			error: errMsg(error)
		};
	}
}

// ──────────────────────────────── stop ──────────────────────────────────

export async function stopGnssSdrVnc(): Promise<GnssSdrVncControlResult> {
	try {
		logger.info('[gnss-sdr-vnc] stopping stack');
		await killAllProcesses();
		await killOrphansByPort();
		removeNmeaFifo();
		await releaseB205();
		logger.info('[gnss-sdr-vnc] stack stopped');
		return { success: true, message: 'GNSS-SDR VNC stack stopped' };
	} catch (error: unknown) {
		logger.error('[gnss-sdr-vnc] stop error', { error: errMsg(error) });
		await releaseB205();
		return {
			success: false,
			message: 'Failed to stop GNSS-SDR VNC stack',
			error: errMsg(error)
		};
	}
}

// ─────────────────────────────── status ─────────────────────────────────

export function getGnssSdrVncStatus(): GnssSdrVncStatusResult {
	const running = isStackAlive();
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: GNSS_SDR_WS_PORT,
		wsPath: GNSS_SDR_WS_PATH
	};
}
