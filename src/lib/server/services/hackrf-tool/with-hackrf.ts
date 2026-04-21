/**
 * One-shot HackRF helper for scan-style endpoints (gsm-scan, intelligent-scan).
 *
 * Pattern: acquire → run work → always release. Implemented as a thin
 * try/finally around {@link acquireHackRf} so the claim is never orphaned
 * when the work function throws or the caller aborts mid-stream.
 *
 * Callers that need to customize the conflict response (e.g., return a
 * specific 409 JSON shape) should check the returned `{ success: false,
 * reason }` union and build their own response.
 */

import { acquireHackRf, releaseHackRf } from './claim';
import type { ClaimResult, RecoveryPolicy } from './types';

export interface WithHackRfOptions<T> {
	tool: string;
	recoveryPolicy: RecoveryPolicy;
	fn: () => Promise<T>;
}

export type WithHackRfResult<T> =
	| { success: true; value: T }
	| { success: false; claim: ClaimResult };

/**
 * Acquire the HackRF for `tool`, run `fn`, and always release in `finally`.
 * Returns a discriminated union so callers can map acquire-failure to their
 * own response shape without losing type safety.
 */
export async function withHackRf<T>(opts: WithHackRfOptions<T>): Promise<WithHackRfResult<T>> {
	const claim = await acquireHackRf(opts.tool, opts.recoveryPolicy);
	if (!claim.success) return { success: false, claim };
	try {
		const value = await opts.fn();
		return { success: true, value };
	} finally {
		await releaseHackRf(opts.tool, opts.recoveryPolicy);
	}
}
