import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { performGsmScan } from '$lib/server/services/gsm-evil/gsm-scan-service';

/**
 * Zod schema for GSM scan POST request body.
 * Both fields are optional — callers may send `{}` to use defaults.
 * - `frequency`: accepts string or number (coerced), in MHz
 * - `band`: optional GSM band hint (e.g. 'GSM900', 'DCS1800', 'ALL')
 */
export const _GsmScanRequestSchema = z.object({
	frequency: z.coerce.number().optional(),
	band: z.string().max(16).optional()
});

/**
 * POST /api/gsm-evil/scan
 * Perform GSM frequency scan to detect active towers.
 * Body (optional): { frequency?: number | string, band?: string }
 */
export const POST = createHandler(
	async ({ request }) => {
		const parsed = _GsmScanRequestSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ success: false, error: 'Invalid scan request' }, { status: 400 });
		}
		const requestedFreq = parsed.data.frequency ?? null;
		const result = await performGsmScan(requestedFreq);
		return json(result, { status: result.success ? 200 : 500 });
	},
	{ validateBody: _GsmScanRequestSchema }
);
