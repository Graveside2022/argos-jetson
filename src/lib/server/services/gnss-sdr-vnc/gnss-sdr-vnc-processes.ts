/**
 * Low-level process helpers for the GNSS-SDR + RTKLIB VNC stack.
 *
 * Six-process stack — see {@link ./gnss-sdr-vnc-types.ts} for the per-process
 * roles. The order matters:
 *
 *   1. Xtigervnc  — virtual X display + VNC server
 *   2. gnss-sdr   — headless CLI; needs DISPLAY only because of optional
 *                   Qt diagnostics (kept off in our config); waits a moment
 *                   before the RTKLIB GUIs attach to its RTCM/NMEA streams
 *   3. rtknavi_qt — Qt5 GUI on the VNC display
 *   4. gnss-sdr-monitor — Qt5 GUI consuming gnss-sdr Monitor protobuf (UDP 1234)
 *   5. websockify — bridges VNC TCP to a WebSocket for noVNC
 *   6. socat      — bridges /tmp/argos-gnss-sdr.nmea -> TCP for gpsd
 *
 * Modeled on `sdrpp-vnc-processes.ts`. The vnc-common spawn helpers
 * (`spawnXtigervncShared`, `spawnWebsockifyShared`, etc.) handle the
 * shared Xtigervnc + websockify + port-orphan-kill plumbing — we only
 * bake in the GNSS-SDR-specific constants and the gnss-sdr/rtklib
 * launches.
 */

import { type ChildProcess, spawn as nativeSpawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { logger } from '$lib/utils/logger';

import {
	centerVncWindow,
	createSpawnErrorTracker,
	isPortOpen,
	isWebsockifyResponding as isWebsockifyRespondingShared,
	killOrphansByPort as killOrphansByPortShared,
	killVncProcess,
	setVncBackground as setVncBackgroundShared,
	spawnWebsockify as spawnWebsockifyShared,
	spawnXtigervnc as spawnXtigervncShared,
	waitForStackReady as waitForStackReadyShared
} from '../vnc-common/spawn-helpers';
import { GENERATED_CONF_PATH, generateGnssSdrConf } from './gnss-sdr-config-generator';
import {
	GNSS_SDR_BIN,
	GNSS_SDR_CONF_DIR,
	GNSS_SDR_DEPTH,
	GNSS_SDR_GEOMETRY,
	GNSS_SDR_LD_PRELOAD_LIBUHD,
	GNSS_SDR_MONITOR_BIN,
	GNSS_SDR_NMEA_BRIDGE_PORT,
	GNSS_SDR_NMEA_FIFO,
	GNSS_SDR_VNC_DISPLAY,
	GNSS_SDR_VNC_PORT,
	GNSS_SDR_WS_PORT,
	type GnssSdrStartOptions,
	RTKNAVI_QT_BIN,
	SOCAT_BIN
} from './gnss-sdr-vnc-types';

const SCOPE = 'gnss-sdr-vnc';

// ───────────────────────────── module state ──────────────────────────────

let xvncProcess: ChildProcess | null = null;
let gnssSdrProcess: ChildProcess | null = null;
let rtknaviProcess: ChildProcess | null = null;
let gnssSdrMonitorProcess: ChildProcess | null = null;
let websockifyProcess: ChildProcess | null = null;
let socatProcess: ChildProcess | null = null;

const errorTracker = createSpawnErrorTracker(SCOPE);

// Test seam — same pattern as src/lib/server/spectrum/b205-source.ts.
type SpawnFn = typeof nativeSpawn;
let spawnImpl: SpawnFn = nativeSpawn;
/** @internal */
export function _setSpawnImplForTest(impl: SpawnFn | null): void {
	spawnImpl = impl ?? nativeSpawn;
}

function recordSpawnError(label: string, err: Error): void {
	errorTracker.record(label, err);
}

export function clearSpawnError(): void {
	errorTracker.clear();
}

export function getSpawnError(): Error | null {
	return errorTracker.get();
}

// ─────────────────────────── helpers ─────────────────────────────────────

/**
 * Write the generated config file to disk, creating parent dirs as needed.
 * Idempotent: skips the write if existing content already matches.
 */
export function writeGeneratedConf(options: GnssSdrStartOptions): string {
	const text = generateGnssSdrConf(options);
	mkdirSync(dirname(GENERATED_CONF_PATH), { recursive: true });
	let needsWrite = true;
	try {
		const onDisk = statSync(GENERATED_CONF_PATH);
		if (onDisk.isFile()) {
			needsWrite = readFileSync(GENERATED_CONF_PATH, 'utf8') !== text;
		}
	} catch {
		// missing — write
	}
	if (needsWrite) writeFileSync(GENERATED_CONF_PATH, text, { mode: 0o644 });
	return GENERATED_CONF_PATH;
}

/**
 * Ensure /tmp/argos-gnss-sdr.nmea exists as a regular file (or fifo if
 * mkfifo is supported by the running Node version). gnss-sdr will open it
 * for writing; socat tails it line-by-line.
 *
 * Note: Node's fs has no built-in mkfifo. We shell out via `mkfifo` if the
 * path is missing. If `mkfifo` is unavailable, fall back to a regular file
 * — socat handles either.
 */
export function ensureNmeaFifo(): void {
	if (existsSync(GNSS_SDR_NMEA_FIFO)) {
		// Either a fifo from a previous run or a plain file. Either is fine.
		return;
	}
	try {
		const proc = nativeSpawn('mkfifo', [GNSS_SDR_NMEA_FIFO], { stdio: 'ignore' });
		proc.on('error', (err) => {
			logger.warn(`[${SCOPE}] mkfifo failed; will fall back to plain file`, {
				err: err.message
			});
			try {
				writeFileSync(GNSS_SDR_NMEA_FIFO, '', { mode: 0o600 });
			} catch (writeErr) {
				logger.error(`[${SCOPE}] fallback fifo create also failed`, {
					err: (writeErr as Error).message
				});
			}
		});
	} catch (err) {
		logger.warn(`[${SCOPE}] mkfifo spawn threw; falling back to plain file`, {
			err: (err as Error).message
		});
		writeFileSync(GNSS_SDR_NMEA_FIFO, '', { mode: 0o600 });
	}
}

/** Remove the NMEA fifo, if present. Best-effort. */
export function removeNmeaFifo(): void {
	try {
		if (existsSync(GNSS_SDR_NMEA_FIFO)) unlinkSync(GNSS_SDR_NMEA_FIFO);
	} catch (err) {
		logger.warn(`[${SCOPE}] removing NMEA fifo failed`, { err: (err as Error).message });
	}
}

// ─────────────────────────── spawn ───────────────────────────────────────

/** Spawn Xtigervnc on display :98 / port 5998. */
export function spawnXtigervnc(): void {
	xvncProcess = spawnXtigervncShared(
		{
			display: GNSS_SDR_VNC_DISPLAY,
			geometry: GNSS_SDR_GEOMETRY,
			depth: GNSS_SDR_DEPTH,
			port: GNSS_SDR_VNC_PORT
		},
		{
			scope: SCOPE,
			onExit: () => {
				xvncProcess = null;
			},
			onError: (err) => {
				recordSpawnError('Xtigervnc', err);
				xvncProcess = null;
			}
		}
	);
}

/** Set X11 background to the dark theme. */
export function setVncBackground(): void {
	setVncBackgroundShared(GNSS_SDR_VNC_DISPLAY, SCOPE);
}

/** Spawn `gnss-sdr` with the generated config file. */
export function spawnGnssSdr(confPath: string): void {
	gnssSdrProcess = spawnImpl(GNSS_SDR_BIN, ['--config_file', confPath], {
		env: {
			...process.env,
			DISPLAY: GNSS_SDR_VNC_DISPLAY,
			// Force older libuhd at runtime so apt's gr-uhd plugin sees an
			// ABI-compatible UHD library (see GNSS_SDR_LD_PRELOAD_LIBUHD doc).
			LD_PRELOAD: GNSS_SDR_LD_PRELOAD_LIBUHD
		},
		cwd: GNSS_SDR_CONF_DIR,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true
	});
	gnssSdrProcess.unref();

	if (gnssSdrProcess.stdout) {
		gnssSdrProcess.stdout.on('data', (chunk: Buffer) => {
			const msg = chunk.toString().trim();
			if (msg) logger.debug(`[${SCOPE}] gnss-sdr stdout`, { msg });
		});
	}
	if (gnssSdrProcess.stderr) {
		gnssSdrProcess.stderr.on('data', (chunk: Buffer) => {
			const msg = chunk.toString().trim();
			if (msg) logger.warn(`[${SCOPE}] gnss-sdr stderr`, { msg });
		});
	}

	gnssSdrProcess.on('exit', (code, signal) => {
		logger.info(`[${SCOPE}] gnss-sdr exited`, { code, signal });
		gnssSdrProcess = null;
	});
	gnssSdrProcess.on('error', (err) => {
		recordSpawnError('gnss-sdr', err);
		gnssSdrProcess = null;
	});
}

/** Spawn `rtknavi_qt`, rendering into the VNC framebuffer. */
export function spawnRtknavi(): void {
	rtknaviProcess = spawnImpl(RTKNAVI_QT_BIN, [], {
		env: { ...process.env, DISPLAY: GNSS_SDR_VNC_DISPLAY },
		stdio: 'ignore',
		detached: true
	});
	rtknaviProcess.unref();
	rtknaviProcess.on('exit', (code, signal) => {
		logger.info(`[${SCOPE}] rtknavi_qt exited`, { code, signal });
		rtknaviProcess = null;
	});
	rtknaviProcess.on('error', (err) => {
		recordSpawnError('rtknavi_qt', err);
		rtknaviProcess = null;
	});
}

/** Spawn `gnss-sdr-monitor`, rendering into the VNC framebuffer.
 *  Consumes gnss-sdr's Monitor block UDP protobuf on port 1234. */
export function spawnGnssSdrMonitor(): void {
	gnssSdrMonitorProcess = spawnImpl(GNSS_SDR_MONITOR_BIN, [], {
		env: { ...process.env, DISPLAY: GNSS_SDR_VNC_DISPLAY },
		stdio: 'ignore',
		detached: true
	});
	gnssSdrMonitorProcess.unref();
	gnssSdrMonitorProcess.on('exit', (code, signal) => {
		logger.info(`[${SCOPE}] gnss-sdr-monitor exited`, { code, signal });
		gnssSdrMonitorProcess = null;
	});
	gnssSdrMonitorProcess.on('error', (err) => {
		recordSpawnError('gnss-sdr-monitor', err);
		gnssSdrMonitorProcess = null;
	});
}

/** Center the Qt windows in the VNC framebuffer (wmctrl). */
export function centerRtklibWindows(): void {
	centerVncWindow(GNSS_SDR_VNC_DISPLAY, 'RTKNAVI');
	centerVncWindow(GNSS_SDR_VNC_DISPLAY, 'gnss-sdr-monitor');
}

/** Spawn websockify bridging VNC port -> WebSocket. */
export function spawnWebsockify(): void {
	websockifyProcess = spawnWebsockifyShared(
		{ wsPort: GNSS_SDR_WS_PORT, vncPort: GNSS_SDR_VNC_PORT },
		{
			scope: SCOPE,
			onExit: () => {
				websockifyProcess = null;
			},
			onError: (err) => {
				recordSpawnError('websockify', err);
				websockifyProcess = null;
			}
		}
	);
}

/**
 * Spawn socat bridging the NMEA fifo to TCP. gpsd is preconfigured to read
 * `tcp://localhost:50001` per the host setup script; once socat opens the
 * listening socket, gpsd connects and picks up the SDR stream as a
 * secondary GPS source.
 *
 * Arg string: `PIPE:/tmp/argos-gnss-sdr.nmea TCP-LISTEN:50001,reuseaddr,fork`
 */
export function spawnSocatNmeaBridge(): void {
	socatProcess = spawnImpl(
		SOCAT_BIN,
		[`PIPE:${GNSS_SDR_NMEA_FIFO}`, `TCP-LISTEN:${GNSS_SDR_NMEA_BRIDGE_PORT},reuseaddr,fork`],
		{ stdio: 'ignore', detached: true }
	);
	socatProcess.unref();
	socatProcess.on('exit', (code, signal) => {
		logger.info(`[${SCOPE}] socat exited`, { code, signal });
		socatProcess = null;
	});
	socatProcess.on('error', (err) => {
		recordSpawnError('socat', err);
		socatProcess = null;
	});
}

// ─────────────────────────── health ──────────────────────────────────────

export function isVncPortOpen(): Promise<boolean> {
	return isPortOpen(GNSS_SDR_VNC_PORT);
}

export async function isWebsockifyResponding(): Promise<boolean> {
	return isWebsockifyRespondingShared(GNSS_SDR_WS_PORT);
}

export async function waitForStackReady(maxAttempts = 25): Promise<boolean> {
	return waitForStackReadyShared(GNSS_SDR_VNC_PORT, GNSS_SDR_WS_PORT, maxAttempts);
}

// ─────────────────────────── cleanup ─────────────────────────────────────

/** Non-fatal fuser-kill of anything bound to our managed ports. */
export async function killOrphansByPort(): Promise<void> {
	return killOrphansByPortShared(GNSS_SDR_VNC_PORT, GNSS_SDR_WS_PORT);
}

async function killProc(ref: ChildProcess | null, name: string): Promise<void> {
	return killVncProcess(ref, name, SCOPE);
}

/** Tear down all six processes in reverse spawn order. */
export async function killAllProcesses(): Promise<void> {
	await killProc(socatProcess, 'socat');
	socatProcess = null;
	await killProc(websockifyProcess, 'websockify');
	websockifyProcess = null;
	await killProc(gnssSdrMonitorProcess, 'gnss-sdr-monitor');
	gnssSdrMonitorProcess = null;
	await killProc(rtknaviProcess, 'rtknavi_qt');
	rtknaviProcess = null;
	await killProc(gnssSdrProcess, 'gnss-sdr');
	gnssSdrProcess = null;
	await killProc(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
}

/** All six managed processes alive. */
export function isStackAlive(): boolean {
	const refs = [
		xvncProcess,
		gnssSdrProcess,
		rtknaviProcess,
		gnssSdrMonitorProcess,
		websockifyProcess,
		socatProcess
	];
	return refs.every((r) => r !== null);
}

/** Reset all module-scoped refs to null. Test-only. */
/** @internal */
export function _resetModuleStateForTest(): void {
	xvncProcess = null;
	gnssSdrProcess = null;
	rtknaviProcess = null;
	gnssSdrMonitorProcess = null;
	websockifyProcess = null;
	socatProcess = null;
	errorTracker.clear();
}
