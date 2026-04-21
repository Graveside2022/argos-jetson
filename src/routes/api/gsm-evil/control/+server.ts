/**
 * POST /api/gsm-evil/control
 *
 * Start or stop GSM Evil monitoring (grgsm_livemon_headless + GsmEvil2).
 *
 * Lifecycle orchestration lives in the HackRF tool framework. This file is
 * intentionally thin — the route only binds the URL to {@link gsmEvilDriver}.
 *
 * Body: `{ action: 'start' | 'stop', frequency?: string }`
 *   - `frequency` (MHz, default 947.2) passes through to `startGsmEvil`,
 *     where it is validated by `validateNumericParam` (800-1000 range).
 *
 * Status codes:
 *   - 200 success
 *   - 409 HackRF claim conflict (returns `conflictingService`)
 *   - 408 stop timeout
 *   - 500 other failure
 *
 * Note: gsm-evil uses the `stale-only` claim policy (not `peer-webrx`) to
 * protect in-flight IMSI captures from accidental peer eviction.
 */

import { z } from 'zod';

import { createHackRfToolHandler } from '$lib/server/services/hackrf-tool';
import { gsmEvilDriver } from '$lib/server/services/hackrf-tool/drivers/gsm-evil';

/** Exported for existing schema-test suites to continue passing unchanged. */
export const _GsmEvilControlRequestSchema = z.object({
	action: z.enum(['start', 'stop']).describe('Control action: start or stop GSM monitoring'),
	frequency: z
		.string()
		.regex(/^\d+(\.\d+)?$/, 'Frequency must be a valid number')
		.optional()
		.describe('GSM frequency in MHz (e.g., "947.2")')
});

export const POST = createHackRfToolHandler(gsmEvilDriver);
