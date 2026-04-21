/**
 * GSM Evil driver. Delegates to `startGsmEvil` / `stopGsmEvil` in
 * `gsm-evil-control-service`. Unlike the WebRX trio, the gsm-evil service
 * handles its own HackRF claim internally (via `acquireHackRfResource`,
 * which runs the stale-lock recovery recipe).
 *
 * Divergence from WebRX trio:
 *   - `supportedActions: ['start', 'stop']` — no restart, no status
 *   - `serializeInLock: false` — not a WebRX peer, doesn't share the lock
 *   - `acquireOnStart: false` — service acquires its own claim
 *   - Response shape passes through service result untouched (not the
 *     `{success, action, message}` envelope used by the WebRX trio)
 *   - Status codes: 200 success / 409 conflict / 408 stop-timeout / 500 other
 */

import { json } from '@sveltejs/kit';

import { startGsmEvil, stopGsmEvil } from '$lib/server/services/gsm-evil/gsm-evil-control-service';

import type { ClaimResult, ToolDriver } from '../types';

const TOOL_NAME = 'gsm-evil';

function selectStartStatus(result: { success: boolean; conflictingService?: string }): number {
	if (!result.success && result.conflictingService) return 409;
	return result.success ? 200 : 500;
}

function selectStopStatus(result: { success: boolean; error?: string }): number {
	if (!result.success && result.error?.includes('timeout')) return 408;
	return result.success ? 200 : 500;
}

function parseFrequency(body: unknown): string | undefined {
	if (typeof body !== 'object' || body === null) return undefined;
	const freq = (body as { frequency?: unknown }).frequency;
	return typeof freq === 'string' ? freq : undefined;
}

export const gsmEvilDriver: ToolDriver = {
	toolName: TOOL_NAME,
	recoveryPolicy: 'stale-only',
	supportedActions: ['start', 'stop'],
	serializeInLock: false,
	acquireOnStart: false,

	async start(body: unknown): Promise<Response> {
		const result = await startGsmEvil(parseFrequency(body));
		return json(result, { status: selectStartStatus(result) });
	},

	async stop(): Promise<Response> {
		const result = await stopGsmEvil();
		return json(result, { status: selectStopStatus(result) });
	},

	// restart/status not supported; handler's dynamic Zod schema rejects these
	// with 400 before reaching here. Provide dummies to satisfy the interface.
	restart(): Promise<Response> {
		return Promise.resolve(json({ success: false, error: 'unsupported' }, { status: 400 }));
	},

	status(): Response {
		return json({ success: false, error: 'unsupported' }, { status: 400 });
	},

	buildConflictResponse(claim: ClaimResult): Response {
		return json(
			{ success: false, message: claim.message, conflictingService: claim.owner },
			{ status: 409 }
		);
	}
};
