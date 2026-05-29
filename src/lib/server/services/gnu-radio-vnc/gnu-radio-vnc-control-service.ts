/**
 * High-level start/stop/status orchestration for the GNU Radio VNC stack.
 *
 * Mirrors wireshark-vnc-control-service.ts. The optional `flowgraph` path is
 * validated (must be absolute, end in .grc, exist on disk if running);
 * mock spawn in tests bypasses the disk check via NODE_ENV=test / VITEST.
 */

import { existsSync, statSync } from 'fs';
import { resolve as resolvePath } from 'path';

import { errMsg } from '$lib/server/api/error-utils';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { logger } from '$lib/utils/logger';

import { createVncShutdownHandler } from '../vnc-common/spawn-helpers';
import { reapPriorVncStack } from '../vnc-common/stack-leak-guard';
import {
	getCurrentFlowgraph,
	isAnyProcessAlive,
	killAllProcesses,
	setCurrentFlowgraph,
	spawnGnuRadioCompanion,
	spawnGrcMaximizer,
	spawnWebsockify,
	spawnWindowManager,
	spawnXtigervnc
} from './gnu-radio-vnc-processes';
import {
	GNU_RADIO_WS_PATH,
	GNU_RADIO_WS_PORT,
	type GnuRadioVncControlResult,
	type GnuRadioVncStatusResult
} from './gnu-radio-vnc-types';

const GNU_RADIO_OWNER = 'gnu-radio-vnc';

function isTestEnv(): boolean {
	return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

function validateFlowgraph(path: string): string | null {
	const resolved = resolvePath(path);
	if (!resolved.endsWith('.grc')) return 'flowgraph path must end in .grc';
	if (isTestEnv()) return null;
	if (!existsSync(resolved)) return `flowgraph file not found: ${resolved}`;
	if (!statSync(resolved).isFile()) return `flowgraph path is not a regular file: ${resolved}`;
	return null;
}

function buildAlreadyRunningResult(): GnuRadioVncControlResult {
	return {
		success: true,
		message: 'GNU Radio VNC stack already running',
		wsPort: GNU_RADIO_WS_PORT,
		wsPath: GNU_RADIO_WS_PATH,
		flowgraph: getCurrentFlowgraph() ?? undefined
	};
}

function buildStartedResult(resolvedFlowgraph: string | undefined): GnuRadioVncControlResult {
	return {
		success: true,
		message: 'GNU Radio VNC stack started',
		wsPort: GNU_RADIO_WS_PORT,
		wsPath: GNU_RADIO_WS_PATH,
		flowgraph: resolvedFlowgraph
	};
}

function resolveFlowgraphOrError(flowgraph: string | undefined): {
	resolved: string | undefined;
	error: GnuRadioVncControlResult | null;
} {
	if (!flowgraph) return { resolved: undefined, error: null };
	const err = validateFlowgraph(flowgraph);
	if (err) {
		return {
			resolved: undefined,
			error: { success: false, message: 'invalid flowgraph', error: err }
		};
	}
	return { resolved: resolvePath(flowgraph), error: null };
}

async function performStartup(resolvedFlowgraph: string | undefined): Promise<Error | null> {
	try {
		// Canonical pre-spawn reaper — closes stack-leak loophole where a
		// prior Xtigervnc :99/openbox survives a half-failed start.
		await reapPriorVncStack('gnu-radio-vnc');
		spawnXtigervnc();
		await new Promise((r) => setTimeout(r, 250));
		// Window manager spawned BEFORE the GUI app so client decorations
		// (titlebar/resize handles) are negotiated correctly via _NET_FRAME_EXTENTS
		// at the first map. Order matters: openbox must claim the root window
		// before gnuradio-companion creates its top-level.
		spawnWindowManager();
		await new Promise((r) => setTimeout(r, 250));
		spawnWebsockify();
		spawnGnuRadioCompanion(resolvedFlowgraph);
		// Detached, polls in background; falls back silently if wmctrl missing.
		spawnGrcMaximizer();
		return null;
	} catch (err) {
		return err instanceof Error ? err : new Error(String(err));
	}
}

// Reap the VNC stack on Argos server shutdown (SIGTERM/SIGINT). The view no
// longer stops GNU Radio on navigation — only the Stop button does — so without
// this the stack would orphan when the server restarts. Idempotent.
const registerShutdownHandler = createVncShutdownHandler('gnu-radio-vnc', killAllProcesses);

async function releaseB205(): Promise<void> {
	resourceManager.unregisterPreemptHandler(GNU_RADIO_OWNER, HardwareDevice.B205);
	await resourceManager.release(GNU_RADIO_OWNER, HardwareDevice.B205).catch((err) => {
		// Surface release failures so debugging is possible; release is safe to
		// retry (resource-manager.ts:166 returns a structured error not a throw).
		logger.warn('[gnu-radio-vnc] B205 release failed', {
			err: errMsg(err),
			owner: GNU_RADIO_OWNER,
			device: HardwareDevice.B205
		});
	});
}

// Use acquireWithPreempt so a competing B205 consumer (bluedragon, gnss-sdr-vnc)
// that registered a preempt handler gets stopped gracefully instead of returning
// b205-locked to the operator. Mirrors the gnss-sdr-vnc + bluedragon pattern
// (gnss-sdr-vnc-control-service.ts:54-83, bluedragon/lifecycle.ts:56-78).
async function claimB205(): Promise<GnuRadioVncControlResult | null> {
	const claim = await resourceManager.acquireWithPreempt(GNU_RADIO_OWNER, HardwareDevice.B205, {
		forceOnOrphan: true
	});
	if (claim.success) {
		if (claim.preempted) {
			logger.info('[gnu-radio-vnc] B205 acquired via preempt', { previous: claim.preempted });
		}
		// Register our preempt handler so OTHER tools can preempt us. Calls the
		// public stop API so the VNC stack + lock are released together.
		resourceManager.registerPreemptHandler(GNU_RADIO_OWNER, HardwareDevice.B205, async () => {
			logger.info('[gnu-radio-vnc] preempted by another B205 consumer — stopping');
			await stopGnuRadioVnc();
		});
		return null;
	}
	logger.warn('[gnu-radio-vnc] B205 unavailable', { owner: claim.owner });
	return {
		success: false,
		message: `B205 is in use by ${claim.owner ?? 'another tool'}`,
		error: `b205-locked-by:${claim.owner ?? 'unknown'}`
	};
}

export async function startGnuRadioVnc(flowgraph?: string): Promise<GnuRadioVncControlResult> {
	registerShutdownHandler();
	if (isAnyProcessAlive()) return buildAlreadyRunningResult();

	const claimError = await claimB205();
	if (claimError) return claimError;

	const { resolved, error } = resolveFlowgraphOrError(flowgraph);
	if (error) {
		await releaseB205();
		return error;
	}

	// Record flowgraph synchronously so getGnuRadioVncStatus() reflects it on
	// the next tick (spawnGnuRadioCompanion below runs inside fire-and-forget
	// performStartup, so its own state.currentFlowgraph write races the caller).
	setCurrentFlowgraph(resolved ?? null);

	// SPD-5: spawn the VNC stack in the background instead of awaiting the ~2s
	// sequential spawn (5 procs + inter-spawn delays). Matches the other tool
	// controls (novasdr etc.) which return immediately and let the client poll /
	// the noVNC viewer retry until the stack is up. Connection info (wsPort/wsPath)
	// is static and known now. A spawn failure is logged + the stack reaped async,
	// since there is no longer a response to carry the error.
	void performStartup(resolved).then(async (startupErr) => {
		if (!startupErr) return;
		logger.error('GRC VNC spawn failed', { error: startupErr.message });
		// Race-guard: if stopGnuRadioVnc() already ran during the fire-and-forget
		// window, our B205 claim was already released. Re-check ownership before
		// duplicating cleanup. The resource-manager.release call itself is safe
		// (returns a structured "not owner" error rather than throwing), but the
		// preceding unregisterPreemptHandler call in releaseB205 would erase a
		// handler the next start() already installed if start/stop interleave.
		if (resourceManager.getOwner(HardwareDevice.B205) !== GNU_RADIO_OWNER) {
			logger.info('[gnu-radio-vnc] startup failed but stop already cleaned up — skipping');
			return;
		}
		await killAllProcesses();
		await releaseB205();
	});

	return buildStartedResult(resolved);
}

export async function stopGnuRadioVnc(): Promise<GnuRadioVncControlResult> {
	if (!isAnyProcessAlive() && !getCurrentFlowgraph()) {
		await releaseB205();
		return { success: true, message: 'GNU Radio VNC stack already stopped' };
	}
	await killAllProcesses();
	await releaseB205();
	return { success: true, message: 'GNU Radio VNC stack stopped' };
}

export function getGnuRadioVncStatus(): GnuRadioVncStatusResult {
	const running = isAnyProcessAlive();
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: GNU_RADIO_WS_PORT,
		wsPath: GNU_RADIO_WS_PATH,
		flowgraph: getCurrentFlowgraph()
	};
}
