/**
 * Blue Dragon start/stop lifecycle — B205 claim, process spawn, graceful
 * termination. Composes `args`, `events`, `pid-fifo`, and `state`.
 *
 * @module
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type {
	BluedragonControlResult,
	BluedragonOptions,
	BluedragonProfile
} from '$lib/types/bluedragon';
import { logger } from '$lib/utils/logger';

import { activeFlagSummary, buildArgs } from './args';
import { DeviceAggregator } from './device-aggregator';
import {
	attachProcessListeners,
	broadcastDevice,
	broadcastStatus,
	clearRuntimeState,
	scheduleParserStart
} from './events';
import { ensureFifo, persistPid } from './pid-fifo';
import { freezeDeviceSnapshot, state } from './state';

const BD_BIN =
	env.BD_BIN ??
	'/home/kali/Documents/Argos/Argos/tactical/blue-dragon/target/release/blue-dragon';
const BD_PCAP_PATH = env.BD_PCAP_PATH;
const BD_OWNER = 'bluedragon';
const SIGINT_GRACE_MS = 2000;
const SIGKILL_GRACE_MS = 500;
const SPAWN_WAIT_MS = 1500;

async function releaseB205(): Promise<void> {
	await resourceManager.release(BD_OWNER, HardwareDevice.B205).catch((err) => {
		logger.warn('[bluedragon] B205 release failed', {
			err: errMsg(err),
			owner: BD_OWNER,
			device: HardwareDevice.B205
		});
	});
}

async function claimB205(): Promise<BluedragonControlResult | null> {
	const claim = await resourceManager.acquire(BD_OWNER, HardwareDevice.B205);
	if (claim.success) return null;
	logger.warn('[bluedragon] B205 unavailable', { owner: claim.owner });
	return {
		success: false,
		message: `B205mini is in use by ${claim.owner ?? 'another tool'}`,
		error: `b205-locked-by:${claim.owner ?? 'unknown'}`
	};
}

async function waitForSpawn(proc: ChildProcess): Promise<void> {
	const ac = new AbortController();
	let timer: ReturnType<typeof setTimeout> | null = null;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`spawn confirmation timed out after ${SPAWN_WAIT_MS}ms`)),
			SPAWN_WAIT_MS
		);
	});
	try {
		await Promise.race([
			once(proc, 'spawn', { signal: ac.signal }),
			once(proc, 'error', { signal: ac.signal }).then(([err]) => {
				throw err as Error;
			}),
			timeout
		]);
	} finally {
		if (timer) clearTimeout(timer);
		ac.abort();
	}
}

function initRuntimeState(
	proc: ChildProcess,
	profile: BluedragonProfile,
	options: BluedragonOptions
): void {
	state.process = proc;
	state.pid = proc.pid ?? null;
	state.startedAt = Date.now();
	state.profile = profile;
	state.options = options;
	if (state.pid !== null) persistPid(state.pid);

	const aggregator = new DeviceAggregator((op, device) => broadcastDevice(op, device));
	aggregator.start();
	state.aggregator = aggregator;

	scheduleParserStart();
	state.status = 'running';
}

/** Mark transition to 'starting' + reset frozen snapshot + log the kickoff. */
function markStarting(profile: BluedragonProfile, options: BluedragonOptions): void {
	state.status = 'starting';
	state.frozenDevices = [];
	state.frozenPacketCount = 0;
	broadcastStatus();
	logger.info('[bluedragon] Starting', {
		profile,
		flags: activeFlagSummary(options),
		bin: BD_BIN
	});
}

async function spawnAndAttach(
	profile: BluedragonProfile,
	options: BluedragonOptions
): Promise<BluedragonControlResult> {
	ensureFifo(BD_PCAP_PATH);
	const proc = spawn(BD_BIN, buildArgs(profile, options), {
		stdio: ['ignore', 'pipe', 'pipe']
	});
	await waitForSpawn(proc);
	attachProcessListeners(proc);
	initRuntimeState(proc, profile, options);
	broadcastStatus();
	return {
		success: true,
		message: 'Blue Dragon started',
		details: `PID ${state.pid}, profile ${profile}`
	};
}

async function handleStartFailure(err: unknown): Promise<BluedragonControlResult> {
	logger.error('[bluedragon] Start failed', { err: errMsg(err) });
	clearRuntimeState();
	await releaseB205();
	broadcastStatus();
	return {
		success: false,
		message: 'Failed to start Blue Dragon',
		error: errMsg(err)
	};
}

/** Guard: reject starts while not stopped; null = ok to proceed. */
function stateGuard(): BluedragonControlResult | null {
	if (state.status === 'stopped') return null;
	return {
		success: false,
		message: 'Blue Dragon is already running or transitioning',
		error: `Current status: ${state.status}`
	};
}

async function tryStart(
	profile: BluedragonProfile,
	options: BluedragonOptions
): Promise<BluedragonControlResult> {
	try {
		return await spawnAndAttach(profile, options);
	} catch (err) {
		return handleStartFailure(err);
	}
}

export async function startBluedragon(
	profile: BluedragonProfile = 'volume',
	options: BluedragonOptions = {}
): Promise<BluedragonControlResult> {
	const rejected = stateGuard();
	if (rejected) return rejected;

	// Transition to 'starting' BEFORE the async claim so two concurrent callers
	// that both pass stateGuard() can't both proceed to spawn. If the claim
	// subsequently fails we roll back to 'stopped' below.
	markStarting(profile, options);

	const conflict = await claimB205();
	if (conflict) {
		state.status = 'stopped';
		broadcastStatus();
		return conflict;
	}
	return tryStart(profile, options);
}

async function terminateProcess(proc: ChildProcess): Promise<void> {
	// proc.killed flips to true the instant kill() dispatches the signal, so the
	// original `if (!proc.killed)` fallback was dead code. Wait for the real
	// 'exit' event (or exitCode becoming non-null) before escalating to SIGKILL.
	if (proc.exitCode !== null || proc.signalCode !== null) return;

	async function waitExit(timeoutMs: number): Promise<boolean> {
		const ac = new AbortController();
		let timer: ReturnType<typeof setTimeout> | null = null;
		const timeout = new Promise<boolean>((resolve) => {
			timer = setTimeout(() => resolve(false), timeoutMs);
		});
		const exitP = once(proc, 'exit', { signal: ac.signal }).then(() => true);
		try {
			return await Promise.race([exitP, timeout]);
		} catch {
			return proc.exitCode !== null || proc.signalCode !== null;
		} finally {
			if (timer) clearTimeout(timer);
			ac.abort();
		}
	}

	proc.kill('SIGINT');
	if (await waitExit(SIGINT_GRACE_MS)) return;

	logger.warn('[bluedragon] SIGINT did not stop, sending SIGKILL');
	proc.kill('SIGKILL');
	await waitExit(SIGKILL_GRACE_MS);
}

async function performStop(): Promise<void> {
	if (state.parserStartTimer) {
		clearTimeout(state.parserStartTimer);
		state.parserStartTimer = null;
	}
	state.parser?.stop();
	state.parser = null;
	state.aggregator?.stop();
	state.aggregator = null;
	freezeDeviceSnapshot();
	if (state.process) await terminateProcess(state.process);
	clearRuntimeState();
	await releaseB205();
}

export async function stopBluedragon(): Promise<BluedragonControlResult> {
	if (state.status === 'stopped') {
		return { success: true, message: 'Blue Dragon already stopped' };
	}

	state.status = 'stopping';
	broadcastStatus();
	logger.info('[bluedragon] Stopping');

	try {
		await performStop();
		broadcastStatus();
		return { success: true, message: 'Blue Dragon stopped' };
	} catch (err) {
		logger.error('[bluedragon] Stop failed', { err: errMsg(err) });
		// Don't leave state stuck in 'stopping' — that blocks all future
		// start/stop operations. Reset to 'stopped' so recovery attempts work.
		state.status = 'stopped';
		broadcastStatus();
		return {
			success: false,
			message: 'Failed to stop Blue Dragon cleanly',
			error: errMsg(err)
		};
	}
}
