/**
 * Housekeeping for Blue Dragon's on-disk artifacts:
 *   - the pcap FIFO (named pipe fed by blue-dragon's -w flag)
 *   - the PID file used to reap stale children across Vite HMR reloads
 *
 * `reapStaleChild()` fires once at module-init time (by import side-effect
 * from `process-manager`) so a previously imported copy of the service
 * doesn't keep the USRP forever after an HMR-triggered re-import.
 *
 * @module
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { logger } from '$lib/utils/logger';

const BD_PCAP_PATH = env.BD_PCAP_PATH;
const BD_PID_FILE = env.BD_PID_FILE;

function removeIfExists(path: string): void {
	if (existsSync(path)) unlinkSync(path);
}

function mkfifoFailureMessage(result: ReturnType<typeof spawnSync>): string {
	const detail = result.stderr?.toString() ?? 'unknown';
	return `mkfifo failed: ${detail}`;
}

export function ensureFifo(path: string = BD_PCAP_PATH): void {
	removeIfExists(path);
	const result = spawnSync('/usr/bin/mkfifo', [path]);
	if (result.status !== 0) throw new Error(mkfifoFailureMessage(result));
}

export function cleanupFifo(path: string = BD_PCAP_PATH): void {
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		/* ignore */
	}
}

export function persistPid(pid: number): void {
	try {
		writeFileSync(BD_PID_FILE, String(pid), 'utf8');
	} catch (err) {
		logger.warn('[bluedragon] could not persist pid file', { err: errMsg(err) });
	}
}

export function clearPidFile(): void {
	try {
		if (existsSync(BD_PID_FILE)) unlinkSync(BD_PID_FILE);
	} catch {
		/* ignore */
	}
}

function readPidFile(): number | null {
	try {
		if (!existsSync(BD_PID_FILE)) return null;
		const n = Number.parseInt(readFileSync(BD_PID_FILE, 'utf8').trim(), 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	} catch {
		return null;
	}
}

function isStaleBlueDragon(pid: number): boolean {
	try {
		return readFileSync(`/proc/${pid}/comm`, 'utf8').trim() === 'blue-dragon';
	} catch {
		return false;
	}
}

/**
 * Defends against Vite HMR re-importing this module: orphaned blue-dragon
 * children from a previous import would otherwise hold the USRP forever.
 */
export function reapStaleChild(): void {
	const pid = readPidFile();
	if (pid === null) return;
	if (isStaleBlueDragon(pid)) {
		logger.warn('[bluedragon] reaping stale child from prior module load', { pid });
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			/* already gone */
		}
	}
	clearPidFile();
	cleanupFifo();
}
