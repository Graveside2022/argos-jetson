/**
 * Response builders shared across the HackRF tool framework.
 *
 * Drivers own their own success/conflict response shapes so byte-identical
 * parity with pre-refactor JSON can be guaranteed. This module supplies only
 * the non-driver-specific shapes: unsupported-action 400 and generic error.
 */

import { json } from '@sveltejs/kit';

/**
 * Invalid-action response. Matches the shape produced by `createHandler`'s
 * Zod validation layer ({ success: false, error: 'Validation failed', details })
 * so clients see the same envelope regardless of which handler ran.
 */
export function unsupportedActionResponse(action: string, supported: readonly string[]): Response {
	return json(
		{
			success: false,
			error: 'Validation failed',
			details: {
				action: {
					_errors: [`Action '${action}' not supported. Allowed: ${supported.join(', ')}`]
				}
			}
		},
		{ status: 400 }
	);
}

/** Standard 409 conflict response for WebRX-family tools. */
export function webRxConflictResponse(claim: { owner?: string; message?: string }): Response {
	return json(
		{
			success: false,
			error: claim.message,
			conflictingService: claim.owner
		},
		{ status: 409 }
	);
}
