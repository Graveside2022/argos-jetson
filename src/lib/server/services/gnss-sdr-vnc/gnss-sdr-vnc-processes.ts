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
import { connect as netConnect } from 'net';
import { tmpdir } from 'os';
import { dirname, join as joinPath } from 'path';

import { logger } from '$lib/utils/logger';

import {
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
import openboxRcXml from './etc/openbox-rc.xml?raw';
import { GENERATED_CONF_PATH, generateGnssSdrConf } from './gnss-sdr-config-generator';
import {
	GNSS_SDR_BIN,
	GNSS_SDR_CONF_DIR,
	GNSS_SDR_DEPTH,
	GNSS_SDR_FB_HEIGHT,
	GNSS_SDR_FB_WIDTH,
	GNSS_SDR_GEOMETRY,
	GNSS_SDR_HARNESS_BIN,
	GNSS_SDR_LD_PRELOAD_LIBUHD,
	GNSS_SDR_MONITOR_BIN,
	GNSS_SDR_NMEA_BRIDGE_PORT,
	GNSS_SDR_NMEA_FIFO,
	GNSS_SDR_TELECOMMAND_HOST,
	GNSS_SDR_TELECOMMAND_PORT,
	GNSS_SDR_VNC_DISPLAY,
	GNSS_SDR_VNC_PORT,
	GNSS_SDR_WS_PORT,
	type GnssSdrStartOptions,
	type GnssSdrTelecommand,
	type GnssSdrTelecommandResult,
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
let wmProcess: ChildProcess | null = null;

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

// Lazy-write openbox rc.xml to /tmp so openbox can mmap it. Idempotent;
// survives multiple stack restarts. Same recipe as the gnu-radio-vnc stack.
//
// Use `flag: 'wx'` (O_EXCL) + `mode: 0o600` to defeat the local-user symlink
// race in /tmp: an attacker pre-creating `argos-gnss-sdr-openbox-rc.xml` as a
// symlink would otherwise redirect our write through their symlink and let
// them inject their own openbox config (arbitrary X11 keybinds inside our
// framebuffer). On EEXIST we read the file back; if its content matches the
// embedded XML we accept and reuse it (idempotent restart). If it differs,
// we refuse to overwrite and use a session-private path instead.
let writtenRcXmlPath: string | null = null;

function writeSessionPrivateRcXml(): string {
	const fallback = joinPath(tmpdir(), `argos-gnss-sdr-openbox-rc.${process.pid}.xml`);
	writeFileSync(fallback, openboxRcXml, { mode: 0o600, flag: 'wx' });
	return fallback;
}

function tryReuseExistingRcXml(path: string): string {
	try {
		const onDisk = readFileSync(path, 'utf8');
		if (onDisk === openboxRcXml) return path;
		logger.warn(
			`[${SCOPE}] openbox rc.xml exists with unexpected content; using session-private path`
		);
	} catch (readErr) {
		logger.warn(`[${SCOPE}] openbox rc.xml exists but unreadable; using session-private path`, {
			err: (readErr as Error).message
		});
	}
	return writeSessionPrivateRcXml();
}

function ensureRcXmlOnDisk(): string {
	if (writtenRcXmlPath) return writtenRcXmlPath;
	const path = joinPath(tmpdir(), 'argos-gnss-sdr-openbox-rc.xml');
	try {
		writeFileSync(path, openboxRcXml, { mode: 0o600, flag: 'wx' });
		writtenRcXmlPath = path;
		return path;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
		writtenRcXmlPath = tryReuseExistingRcXml(path);
		return writtenRcXmlPath;
	}
}

/**
 * Spawn openbox as the in-framebuffer window manager.
 *
 * Without a WM, the Xtigervnc framebuffer has no cursor, no titlebars, and no
 * EWMH support — operators can't drag-resize, focus-cycle, or even see the
 * mouse pointer inside the noVNC iframe. openbox (~400 KB, EWMH-compliant)
 * gives all three. `--sm-disable` skips the X session manager (headless Xvnc
 * has none); rc.xml is the standard Debian openbox config minus the
 * GRC-specific application rule (which is a no-op for Qt apps anyway).
 *
 * Must spawn AFTER Xtigervnc (the WM needs a display to attach to) but BEFORE
 * any Qt window maps (windows that map before the WM registers may be
 * decoration-less for the rest of their lifetime).
 */
export function spawnWindowManager(): void {
	const rcXml = ensureRcXmlOnDisk();
	wmProcess = spawnImpl('/usr/bin/openbox', ['--sm-disable', '--config-file', rcXml], {
		env: { ...process.env, DISPLAY: GNSS_SDR_VNC_DISPLAY },
		stdio: 'ignore',
		detached: true
	});
	wmProcess.unref();
	wmProcess.on('exit', (code, signal) => {
		logger.info(`[${SCOPE}] openbox exited`, { code, signal });
		wmProcess = null;
	});
	wmProcess.on('error', (err) => {
		recordSpawnError('openbox', err);
		wmProcess = null;
	});
}

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

/**
 * Spawn `gnss-sdr` via `gnss-sdr-harness.sh` so the telecommand `reset`
 * command (which makes gnss-sdr exit with code 42) is auto-respawned by the
 * harness without us re-firing the full Argos start flow. The harness is a
 * 6-line POSIX shell wrapper installed by Phase 1 at /usr/local/bin/.
 */
export function spawnGnssSdr(confPath: string): void {
	gnssSdrProcess = spawnImpl(GNSS_SDR_HARNESS_BIN, [GNSS_SDR_BIN, '--config_file', confPath], {
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

/**
 * Spawn `rtknavi_qt`, rendering into the VNC framebuffer.
 *
 * Passes Qt's standard X11 `-geometry WxH+X+Y` argument so the window
 * sizes + positions itself at startup WITHOUT relying on a window manager
 * (Xtigervnc runs barefoot; xdotool's `windowsize` is silently ignored
 * without a WM in the framebuffer). Left half: 960×1080 at (0,0).
 */
export function spawnRtknavi(): void {
	const halfW = Math.floor(GNSS_SDR_FB_WIDTH / 2);
	rtknaviProcess = spawnImpl(
		RTKNAVI_QT_BIN,
		['-geometry', `${halfW}x${GNSS_SDR_FB_HEIGHT}+0+0`],
		{
			env: { ...process.env, DISPLAY: GNSS_SDR_VNC_DISPLAY },
			stdio: 'ignore',
			detached: true
		}
	);
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

/**
 * Spawn `gnss-sdr-monitor`, rendering into the VNC framebuffer. Consumes
 * gnss-sdr's Monitor block UDP protobuf on port 1234.
 *
 * Right half: 960×1080 at (960,0). Same Qt `-geometry` convention as
 * spawnRtknavi — works without a window manager.
 */
export function spawnGnssSdrMonitor(): void {
	const halfW = Math.floor(GNSS_SDR_FB_WIDTH / 2);
	gnssSdrMonitorProcess = spawnImpl(
		GNSS_SDR_MONITOR_BIN,
		['-geometry', `${halfW}x${GNSS_SDR_FB_HEIGHT}+${halfW}+0`],
		{
			env: { ...process.env, DISPLAY: GNSS_SDR_VNC_DISPLAY },
			stdio: 'ignore',
			detached: true
		}
	);
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

/**
 * Tile a window matching `windowSearchName` inside the VNC framebuffer.
 *
 * Two Qt GUIs share the framebuffer (rtknavi_qt + gnss-sdr-monitor); centering
 * both via `vnc-common/centerVncWindow` would overlap them. This helper moves +
 * resizes each window to a horizontal half: `position='left'` → upper-left
 * quadrant of width FB_WIDTH/2, `position='right'` → right half. xdotool
 * handles both windowmove + windowsize in one bash script so each window is
 * always full-height and exactly half the framebuffer width.
 */
function tileWindow(display: string, windowSearchName: string, position: 'left' | 'right'): void {
	if (!nativeSpawn || typeof nativeSpawn !== 'function') return;
	// Allow bracket-character regex classes for case-insensitive matching of the
	// Qt window titles (e.g. `[Rr]tk[Nn]avi`). Still injection-proof: no shell
	// metachars permitted beyond brackets, alphanumerics, space, dash, underscore.
	if (!/^[\w \-.[\]]{1,128}$/.test(windowSearchName)) {
		logger.warn(`[${SCOPE}] refusing to tile window — unsafe name`, { windowSearchName });
		return;
	}
	const halfW = Math.floor(GNSS_SDR_FB_WIDTH / 2);
	const xOffset = position === 'left' ? 0 : halfW;
	const script = `
		WID=$(xdotool search --name "${windowSearchName}" 2>/dev/null | head -1)
		if [ -n "$WID" ]; then
			xdotool windowsize "$WID" ${halfW} ${GNSS_SDR_FB_HEIGHT}
			xdotool windowmove "$WID" ${xOffset} 0
		fi
	`;
	const proc = nativeSpawn('/bin/bash', ['-c', script], {
		env: { ...process.env, DISPLAY: display },
		stdio: 'ignore'
	});
	proc.unref();
}

/**
 * Tile the two Qt GUIs side-by-side at framebuffer half-width each.
 *
 *   |─── rtknavi_qt ───|─── gnss-sdr-monitor ───|
 *   0                 960                      1920
 *
 * Window titles (verified via xdotool against the live Xtigervnc 2026-05-27):
 *   - `RtkNavi Qt ver. EX 2.5.0` — match with case-insensitive regex `[Rr]tk[Nn]avi`
 *   - `gnss-sdr-monitor` — exact lowercase match
 */
const RTKNAVI_TITLE_REGEX = '[Rr]tk[Nn]avi';
const MONITOR_TITLE_REGEX = 'gnss-sdr-monitor';

export function centerRtklibWindows(): void {
	tileWindow(GNSS_SDR_VNC_DISPLAY, RTKNAVI_TITLE_REGEX, 'left');
	tileWindow(GNSS_SDR_VNC_DISPLAY, MONITOR_TITLE_REGEX, 'right');
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
 * `bind=127.0.0.1` is required — without it socat defaults to wildcard, and
 * any LAN client could telnet :50001 and inject a spoofed NMEA fix into gpsd
 * (which the tactical map and Kismet geo then blindly trust). Operator-grade
 * defect on a field-deployed Argos.
 *
 * Arg string: `PIPE:/tmp/argos-gnss-sdr.nmea TCP-LISTEN:50001,bind=127.0.0.1,reuseaddr,fork`
 */
export function spawnSocatNmeaBridge(): void {
	socatProcess = spawnImpl(
		SOCAT_BIN,
		[
			`PIPE:${GNSS_SDR_NMEA_FIFO}`,
			`TCP-LISTEN:${GNSS_SDR_NMEA_BRIDGE_PORT},bind=127.0.0.1,reuseaddr,fork`
		],
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

/** Tear down all seven processes in reverse spawn order. */
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
	await killProc(wmProcess, 'openbox');
	wmProcess = null;
	await killProc(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
}

/** All seven managed processes alive. */
export function isStackAlive(): boolean {
	const refs = [
		xvncProcess,
		wmProcess,
		gnssSdrProcess,
		rtknaviProcess,
		gnssSdrMonitorProcess,
		websockifyProcess,
		socatProcess
	];
	return refs.every((r) => r !== null);
}

// ─────────────────────────── telecommand TCP client ──────────────────────

const TELECOMMAND_TIMEOUT_MS = 3000;
const TELECOMMAND_WHITELIST: ReadonlySet<string> = new Set<GnssSdrTelecommand>([
	'reset',
	'standby',
	'coldstart',
	'hotstart',
	'warmstart'
]);

/**
 * Send a single-line telecommand to the running gnss-sdr instance over TCP and
 * wait for the OK/ERROR response. The verb is whitelisted to one of the
 * documented commands; extra args (e.g. `warmstart`'s `dd/mm/yyyy ...`) come
 * through as the optional `args` string and are appended after a space.
 *
 * Wire protocol per gnss-sdr docs: lowercase verb + optional space-separated
 * args, terminated by `\r\n`. Response is OK or ERROR (with explanatory text).
 */
export async function sendGnssSdrTelecommand(
	verb: GnssSdrTelecommand,
	args?: string
): Promise<GnssSdrTelecommandResult> {
	if (!TELECOMMAND_WHITELIST.has(verb)) {
		return { success: false, command: verb, response: '', error: `unknown verb: ${verb}` };
	}
	// args is concatenated into the wire payload — reject control chars +
	// anything that could split into a second command (no \r or \n).
	if (args && !/^[\w\s./-]{0,128}$/.test(args)) {
		return { success: false, command: verb, response: '', error: 'invalid args' };
	}
	const payload = args ? `${verb} ${args}\r\n` : `${verb}\r\n`;

	return new Promise<GnssSdrTelecommandResult>((resolve) => {
		const socket = netConnect(GNSS_SDR_TELECOMMAND_PORT, GNSS_SDR_TELECOMMAND_HOST);
		let response = '';
		const finish = (success: boolean, error?: string): void => {
			try {
				socket.end();
			} catch {
				/* already closed */
			}
			resolve({ success, command: verb, response: response.trim(), error });
		};
		const timer = setTimeout(
			() => finish(false, 'telecommand timeout'),
			TELECOMMAND_TIMEOUT_MS
		);
		socket.on('connect', () => {
			socket.write(payload);
		});
		socket.on('data', (chunk: Buffer) => {
			response += chunk.toString();
			if (response.includes('OK') || response.includes('ERROR')) {
				clearTimeout(timer);
				const ok = response.includes('OK') && !response.includes('ERROR');
				finish(ok, ok ? undefined : response.trim());
			}
		});
		socket.on('error', (err: Error) => {
			clearTimeout(timer);
			finish(false, err.message);
		});
		socket.on('close', () => {
			clearTimeout(timer);
			if (!response) finish(false, 'telecommand connection closed without response');
		});
	});
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
	wmProcess = null;
	errorTracker.clear();
}
