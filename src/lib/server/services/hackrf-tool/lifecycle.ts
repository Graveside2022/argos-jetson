/**
 * Lifecycle orchestration for HackRF-using tools.
 *
 * Responsibilities:
 *   - Dispatch `status` (no claim acquisition) to `driver.status()`
 *   - For `start`: acquire the HackRF via {@link acquireHackRf} when
 *     `driver.acquireOnStart` is true; short-circuit to conflict response
 *     on claim failure; release the claim on subsequent throw
 *   - Wrap lifecycle calls in `withWebRxLock` when `driver.serializeInLock`
 *   - Call `resourceManager.refreshNow` after success so the next status
 *     read returns fresh data without waiting for the 30s background poll
 *
 * Everything tool-specific (exec calls, success JSON shape) lives in the
 * driver. This module is tool-agnostic but policy-aware.
 */

import { withWebRxLock } from '$lib/server/api/webrx-control-lock';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

import { acquireHackRf, releaseHackRf } from './claim';
import { unsupportedActionResponse } from './response';
import type { ControlAction, ToolDriver } from './types';

/** Execute a single validated lifecycle action against the driver. */
export async function runLifecycleAction(
	driver: ToolDriver,
	action: ControlAction,
	body: unknown
): Promise<Response> {
	if (action === 'status') {
		if (!driver.status) return unsupportedActionResponse(action, driver.supportedActions);
		return driver.status(body);
	}
	const invoke = () => runMutatingAction(driver, action, body);
	return driver.serializeInLock ? withWebRxLock(invoke) : invoke();
}

/** True when the lifecycle module is responsible for acquiring the claim. */
function needsLifecycleClaim(
	driver: ToolDriver,
	action: Exclude<ControlAction, 'status'>
): boolean {
	return action === 'start' && driver.acquireOnStart;
}

/** Acquire the claim if required; return a conflict Response or null on success. */
async function maybeAcquireClaim(
	driver: ToolDriver,
	action: Exclude<ControlAction, 'status'>
): Promise<Response | null> {
	if (!needsLifecycleClaim(driver, action)) return null;
	const claim = await acquireHackRf(driver.toolName, driver.recoveryPolicy);
	if (claim.success) return null;
	return driver.buildConflictResponse(claim);
}

/** Run a mutating action (start/stop/restart) with claim + refresh handling. */
async function runMutatingAction(
	driver: ToolDriver,
	action: Exclude<ControlAction, 'status'>,
	body: unknown
): Promise<Response> {
	const conflict = await maybeAcquireClaim(driver, action);
	if (conflict) return conflict;
	try {
		const response = await invokeDriverAction(driver, action, body);
		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		return response;
	} catch (err) {
		if (needsLifecycleClaim(driver, action)) {
			await releaseHackRf(driver.toolName, driver.recoveryPolicy);
		}
		throw err;
	}
}

/** Delegate to the driver method matching the action. */
function invokeDriverAction(
	driver: ToolDriver,
	action: Exclude<ControlAction, 'status'>,
	body: unknown
): Promise<Response> {
	if (action === 'start') return driver.start(body);
	if (action === 'stop') return driver.stop(body);
	if (!driver.restart) {
		return Promise.resolve(unsupportedActionResponse(action, driver.supportedActions));
	}
	return driver.restart(body);
}
