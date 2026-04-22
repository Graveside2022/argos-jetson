/**
 * POST /api/wireshark/control
 *
 * Start, stop, or check the status of the Wireshark VNC stack
 * (Xtigervnc + Wireshark Qt GUI + websockify).
 *
 * Body shapes:
 *   { action: "start", iface?: "eth0", filter?: "tcp.port == 443" }
 *   { action: "stop" }
 *   { action: "status" }
 *
 * Start succeeds without iface/filter — defaults to `any` interface and the
 * `not arp` display filter. Dashboard docs:
 *   https://www.wireshark.org/docs/wsug_html_chunked/ChCustCommandLine
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getWiresharkVncStatus,
	startWiresharkVnc,
	stopWiresharkVnc
} from '$lib/server/services/wireshark-vnc/wireshark-vnc-control-service';

// Interface names are short identifiers; cap length to head off command-line
// abuse even though argv is passed as an array (no shell).
const _ifaceSchema = z
	.string()
	.min(1)
	.max(32)
	.regex(/^[A-Za-z0-9_.:@-]+$/, 'invalid interface name');

// Display filter can legitimately contain spaces, parens, and quotes —
// keep it permissive but bounded.
const _filterSchema = z.string().max(512);

export const _WiresharkVncControlSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('start'),
		iface: _ifaceSchema.optional(),
		filter: _filterSchema.optional()
	}),
	z.object({ action: z.literal('stop') }),
	z.object({ action: z.literal('status') })
]);

type WiresharkVncResult =
	| Awaited<ReturnType<typeof startWiresharkVnc | typeof stopWiresharkVnc>>
	| ReturnType<typeof getWiresharkVncStatus>;

function resultStatus(result: WiresharkVncResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

export const POST = createHandler(
	async ({ request }) => {
		// createHandler has already run _WiresharkVncControlSchema.safeParse on
		// a clone of this body and returned 400 on failure, so .parse() here is
		// a typed narrow that cannot throw at runtime.
		const body = (await request.json()) as unknown;
		const validated = _WiresharkVncControlSchema.parse(body);

		if (validated.action === 'start') {
			const result = await startWiresharkVnc(validated.iface, validated.filter);
			return json(result, { status: resultStatus(result) });
		}
		if (validated.action === 'stop') {
			const result = await stopWiresharkVnc();
			return json(result, { status: resultStatus(result) });
		}
		return json(getWiresharkVncStatus());
	},
	{ validateBody: _WiresharkVncControlSchema }
);
