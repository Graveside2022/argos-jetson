/**
 * Unified HackRF claim facade. Routes `acquire` / `release` through one of
 * three underlying implementations based on the caller's {@link RecoveryPolicy}.
 *
 * This is a strict pass-through — no policy translation, no semantics change.
 * The underlying functions preserve their asymmetric recovery behavior:
 *
 *   - `peer-webrx` auto-evicts a sibling WebSDR and retries
 *   - `stale-only` runs the gsm-evil stale-lock cleanup recipe
 *   - `direct` refuses on conflict without recovery
 */

import { acquireHackRfForWebRx, releaseHackRfForWebRx } from '$lib/server/api/webrx-hackrf-claim';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { acquireHackRfResource } from '$lib/server/services/gsm-evil/gsm-evil-control-helpers';

import type { ClaimResult, RecoveryPolicy } from './types';

async function acquireStaleOnly(): Promise<ClaimResult> {
	const err = await acquireHackRfResource();
	if (err === null) return { success: true };
	return { success: false, owner: err.conflictingService, message: err.message };
}

async function acquireDirect(toolName: string): Promise<ClaimResult> {
	const res = await resourceManager.acquire(toolName, HardwareDevice.HACKRF);
	if (res.success) return { success: true };
	const owner = res.owner ?? 'unknown';
	return {
		success: false,
		owner,
		message: `HackRF is currently in use by ${owner}.`
	};
}

/** Acquire the HackRF for `toolName` using the semantics selected by `recoveryPolicy`. */
export async function acquireHackRf(
	toolName: string,
	recoveryPolicy: RecoveryPolicy
): Promise<ClaimResult> {
	if (recoveryPolicy === 'peer-webrx') return acquireHackRfForWebRx(toolName);
	if (recoveryPolicy === 'stale-only') return acquireStaleOnly();
	return acquireDirect(toolName);
}

/** Release the HackRF for `toolName` using the matching release path. */
export async function releaseHackRf(
	toolName: string,
	recoveryPolicy: RecoveryPolicy
): Promise<void> {
	if (recoveryPolicy === 'peer-webrx') {
		await releaseHackRfForWebRx(toolName);
		return;
	}
	await resourceManager.release(toolName, HardwareDevice.HACKRF).catch(() => undefined);
}
