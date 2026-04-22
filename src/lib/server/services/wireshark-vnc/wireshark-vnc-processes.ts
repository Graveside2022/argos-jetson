/**
 * Low-level process helpers for the Wireshark VNC stack.
 *
 * Three-process stack: Xtigervnc (virtual display), Wireshark (Qt GUI),
 * and websockify (VNC-to-WebSocket bridge for noVNC).
 *
 * Modeled on sdrpp-vnc-processes.ts. Key differences:
 *   - Qt frontend needs QT_QPA_PLATFORM=xcb (Wayland backend crashes under TigerVNC).
 *   - No window-centering step — Wireshark restores its own layout on relaunch.
 *   - Capture interface + display filter are dynamic (change per start request).
 */

import { type ChildProcess, spawn } from 'child_process';
import { connect as netConnect } from 'net';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { resolveBin } from '../vnc-common/resolve-bin';
import {
	WIRESHARK_DEPTH,
	WIRESHARK_GEOMETRY,
	WIRESHARK_GUI_PATH,
	WIRESHARK_PROFILE,
	WIRESHARK_VNC_DISPLAY,
	WIRESHARK_VNC_PORT,
	WIRESHARK_WS_PORT
} from './wireshark-vnc-types';

const resolveXtigervncBin = () =>
	resolveBin(
		[env.ARGOS_VNC_XTIGERVNC_BIN, '/usr/bin/Xtigervnc', '/usr/local/bin/Xtigervnc'],
		'Xtigervnc',
		'ARGOS_VNC_XTIGERVNC_BIN'
	);

const resolveWebsockifyBin = () =>
	resolveBin(
		[env.ARGOS_VNC_WEBSOCKIFY_BIN, '/usr/bin/websockify', '/usr/local/bin/websockify'],
		'websockify',
		'ARGOS_VNC_WEBSOCKIFY_BIN'
	);

// ───────────────────────────── module state ──────────────────────────────

let xvncProcess: ChildProcess | null = null;
let wiresharkProcess: ChildProcess | null = null;
let websockifyProcess: ChildProcess | null = null;
let currentIface: string | null = null;
let currentFilter: string | null = null;
// Latched error from any child's async 'error' event. Cleared at stack start.
let spawnError: Error | null = null;

function recordSpawnError(label: string, err: Error): void {
	logger.error(`[wireshark-vnc] ${label} error`, { error: err.message });
	if (!spawnError) spawnError = new Error(`${label}: ${err.message}`);
}

export function clearSpawnError(): void {
	spawnError = null;
}

export function getSpawnError(): Error | null {
	return spawnError;
}

export function getCurrentIface(): string | null {
	return currentIface;
}

export function getCurrentFilter(): string | null {
	return currentFilter;
}

export function setCurrentCapture(iface: string, filter: string): void {
	currentIface = iface;
	currentFilter = filter;
}

export function clearCurrentCapture(): void {
	currentIface = null;
	currentFilter = null;
}

// ─────────────────────────────── spawn ──────────────────────────────────

/** Spawn Xtigervnc as a combined X server + VNC server on `:96`. */
export function spawnXtigervnc(): void {
	xvncProcess = spawn(
		resolveXtigervncBin(),
		[
			WIRESHARK_VNC_DISPLAY,
			'-geometry',
			WIRESHARK_GEOMETRY,
			'-depth',
			String(WIRESHARK_DEPTH),
			'-SecurityTypes',
			'None',
			'-localhost',
			'-rfbport',
			String(WIRESHARK_VNC_PORT),
			'-AlwaysShared'
		],
		{ stdio: 'ignore', detached: true }
	);
	xvncProcess.unref();
	xvncProcess.on('exit', (code, signal) => {
		logger.info('[wireshark-vnc] Xtigervnc exited', { code, signal });
		xvncProcess = null;
	});
	xvncProcess.on('error', (err) => {
		recordSpawnError('Xtigervnc', err);
		xvncProcess = null;
	});
}

/** Set X11 background to match Lunaris dark theme (#111111). */
export function setVncBackground(): void {
	const bg = spawn('/usr/bin/xsetroot', ['-solid', '#111111'], {
		env: { ...process.env, DISPLAY: WIRESHARK_VNC_DISPLAY },
		stdio: 'ignore'
	});
	bg.unref();
}

/**
 * Spawn the Wireshark Qt GUI rendering into the Xtigervnc display.
 *
 * Flags:
 *   -i <iface>              — capture interface
 *   -k                      — start capture immediately
 *   -Y <filter>             — apply display filter on launch
 *   -C <profile>            — load isolated profile (prevents clobbering user prefs)
 *   -o gui.update.enabled:FALSE — disable phone-home update checks
 *
 * Source: https://www.wireshark.org/docs/wsug_html_chunked/ChCustCommandLine
 */
export function spawnWiresharkGui(iface: string, filter: string): void {
	wiresharkProcess = spawn(
		WIRESHARK_GUI_PATH,
		[
			'-C',
			WIRESHARK_PROFILE,
			'-o',
			'gui.update.enabled:FALSE',
			'-i',
			iface,
			'-k',
			'-Y',
			filter
		],
		{
			env: {
				...process.env,
				DISPLAY: WIRESHARK_VNC_DISPLAY,
				// Qt on Wayland hangs inside a TigerVNC session — force X11 backend.
				QT_QPA_PLATFORM: 'xcb'
			},
			stdio: 'ignore',
			detached: true
		}
	);
	wiresharkProcess.unref();
	wiresharkProcess.on('exit', (code, signal) => {
		logger.info('[wireshark-vnc] wireshark exited', { code, signal });
		wiresharkProcess = null;
	});
	wiresharkProcess.on('error', (err) => {
		recordSpawnError('wireshark', err);
		wiresharkProcess = null;
	});
}

/** Spawn websockify to bridge the VNC port to a WebSocket. */
export function spawnWebsockify(): void {
	websockifyProcess = spawn(
		resolveWebsockifyBin(),
		[String(WIRESHARK_WS_PORT), `localhost:${WIRESHARK_VNC_PORT}`],
		{ stdio: 'ignore', detached: true }
	);
	websockifyProcess.unref();
	websockifyProcess.on('exit', (code, signal) => {
		logger.info('[wireshark-vnc] websockify exited', { code, signal });
		websockifyProcess = null;
	});
	websockifyProcess.on('error', (err) => {
		recordSpawnError('websockify', err);
		websockifyProcess = null;
	});
}

// ─────────────────────────────── health ─────────────────────────────────

/** Probe whether the VNC TCP port is accepting connections. */
export function isVncPortOpen(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = netConnect({ host: 'localhost', port: WIRESHARK_VNC_PORT });
		const done = (ok: boolean) => {
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(1000);
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
		socket.once('timeout', () => done(false));
	});
}

/** Probe whether websockify is responding. */
export async function isWebsockifyResponding(): Promise<boolean> {
	try {
		const res = await fetch(`http://localhost:${WIRESHARK_WS_PORT}/`, {
			method: 'HEAD',
			signal: AbortSignal.timeout(1000)
		});
		return res.status > 0;
	} catch {
		return false;
	}
}

/** Poll until both VNC and websockify are alive. */
export async function waitForStackReady(maxAttempts = 25): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		const [vncOk, wsOk] = await Promise.all([isVncPortOpen(), isWebsockifyResponding()]);
		if (vncOk && wsOk) return true;
		await delay(200);
	}
	return false;
}

// ─────────────────────────────── cleanup ────────────────────────────────

function sendSignal(ref: ChildProcess, signal: NodeJS.Signals): void {
	const pid = ref.pid;
	if (pid == null) return;
	try {
		process.kill(-pid, signal);
	} catch {
		try {
			ref.kill(signal);
		} catch {
			/* already dead */
		}
	}
}

/** Send SIGTERM, wait 500ms, then SIGKILL any surviving process. */
export async function killProcess(ref: ChildProcess | null, name: string): Promise<void> {
	if (!ref || ref.pid == null || ref.killed) return;
	sendSignal(ref, 'SIGTERM');
	await delay(500);
	if (!ref.killed) sendSignal(ref, 'SIGKILL');
	logger.info('[wireshark-vnc] killed process', { name });
}

/** Non-fatal fuser-kill of anything bound to the VNC or WebSocket ports. */
export async function killOrphansByPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', [
			'-k',
			`${WIRESHARK_VNC_PORT}/tcp`,
			`${WIRESHARK_WS_PORT}/tcp`
		]);
	} catch {
		/* fuser exits non-zero when nothing to kill */
	}
}

/** Tear down all three processes in reverse spawn order. */
export async function killAllProcesses(): Promise<void> {
	await killProcess(websockifyProcess, 'websockify');
	websockifyProcess = null;
	await killProcess(wiresharkProcess, 'wireshark');
	wiresharkProcess = null;
	await killProcess(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
	clearCurrentCapture();
}

/** Check whether all three managed processes are still alive. */
export function isStackAlive(): boolean {
	return xvncProcess !== null && wiresharkProcess !== null && websockifyProcess !== null;
}
