/**
 * Pre-spawn reaper for VNC tool stacks.
 *
 * Each VNC service spawns three long-lived processes for its display slot:
 *   1. Xtigervnc (binds the VNC TCP port + creates the X display)
 *   2. openbox    (window manager on that display)
 *   3. websockify (bridges VNC TCP → WebSocket on the ws port)
 *
 * If a prior start failed cleanly only on the websockify side, the
 * Xtigervnc + openbox processes can stay alive bound to the X display
 * even after `killOrphansByPort` reaps the TCP ports. A subsequent start
 * then races a stale `Xtigervnc :<n>` against the new spawn and the
 * X server refuses with `display already in use`.
 *
 * `reapPriorVncStack(tool)` looks up the tool's canonical port + display
 * allocation, kills anything on those two TCP ports via the shared
 * `killOrphansByPort` helper, then kills any process whose argv contains
 * the tool's `:<display>` (word-boundary anchored). SIGTERM first; if a
 * pid is still alive after `SIGTERM_GRACE_MS`, escalate to SIGKILL.
 *
 * Idempotent. Returns the count of pids the argv-sweep killed.
 *
 * @module
 */

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { getVncAllocation, type VncToolId } from './port-allocation';
import { killOrphansByPort } from './spawn-helpers';

const SIGTERM_GRACE_MS = 1000;

/**
 * pgrep -af '<pattern>' returns argv-matching pids on stdout, one per line.
 * Match against the literal `:<display>` token with word-boundary anchors
 * so we only reap processes that have `:NN` as a discrete argv token —
 * avoids false-positive matches on `:9800`, timestamps, file paths, etc.
 */
async function pidsWithDisplayInArgv(display: string): Promise<number[]> {
	try {
		// Anchor: display must be preceded by start-of-string or whitespace
		// and followed by end-of-string or whitespace.
		const { stdout } = await execFileAsync('/usr/bin/pgrep', [
			'-af',
			`(^|\\s)${display}(\\s|$)`
		]);
		return stdout
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => Number.parseInt(line.split(/\s+/)[0] ?? '', 10))
			.filter((pid) => Number.isFinite(pid) && pid > 0);
	} catch {
		/* pgrep exits non-zero when nothing matches — that's fine */
		return [];
	}
}

function isPidAlive(pid: number): boolean {
	try {
		// Signal 0 checks process existence without affecting it.
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function trySignal(pid: number, signal: NodeJS.Signals): boolean {
	try {
		process.kill(pid, signal);
		return true;
	} catch {
		return false;
	}
}

/**
 * Send SIGTERM. If pid still alive after `SIGTERM_GRACE_MS`, escalate to
 * SIGKILL. Returns true if the pid was alive when SIGTERM was sent.
 */
async function killWithEscalation(pid: number): Promise<boolean> {
	if (!isPidAlive(pid)) return false;
	const termSent = trySignal(pid, 'SIGTERM');
	if (!termSent) return false;
	await delay(SIGTERM_GRACE_MS);
	if (isPidAlive(pid)) {
		logger.warn('[vnc-stack-leak-guard] SIGTERM ignored, escalating to SIGKILL', { pid });
		trySignal(pid, 'SIGKILL');
	}
	return true;
}

/**
 * Reap any prior process trio (Xtigervnc + openbox + websockify) on the
 * canonical slot allocated to `tool`. SIGTERM → SIGKILL escalation
 * ensures the X server has actually released `/tmp/.X11-unix/X<n>`
 * before the caller respawns. Returns the number of pids killed by the
 * display-argv sweep (port reaper handled separately).
 */
export async function reapPriorVncStack(tool: VncToolId): Promise<number> {
	const allocation = getVncAllocation(tool);
	// Reap by TCP port first — covers Xtigervnc's rfb port + websockify ws.
	await killOrphansByPort(allocation.vncPort, allocation.wsPort);
	// Then sweep by display number — catches openbox + any other process
	// that bound to :<display> without holding a TCP port.
	const pids = await pidsWithDisplayInArgv(allocation.display);
	let reaped = 0;
	for (const pid of pids) {
		if (await killWithEscalation(pid)) reaped += 1;
	}
	if (reaped > 0) {
		logger.info('[vnc-stack-leak-guard] reaped prior display processes', {
			tool,
			display: allocation.display,
			reaped
		});
	}
	return reaped;
}
