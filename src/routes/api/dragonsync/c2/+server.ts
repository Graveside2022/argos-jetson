/**
 * GET /api/dragonsync/c2 — returns cached C2 signals from the argos-c2-scanner
 * ZMQ 4227 publisher, parsed by the c2-subscriber child process in
 * process-manager. Auth is enforced upstream in src/hooks.server.ts.
 *
 * @module
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getDragonSyncC2Signals } from '$lib/server/services/dragonsync/process-manager';

export const GET = createHandler(async () => {
	return json({ signals: getDragonSyncC2Signals() });
});
