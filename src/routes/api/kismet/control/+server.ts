import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getKismetStatus,
	startKismetExtended,
	stopKismetExtended
} from '$lib/server/services/kismet/kismet-control-service-extended';
import { getKismetSignalSource } from '$lib/server/services/rf/kismet-source-singleton';
import { getCurrentSessionId, startNewSession } from '$lib/server/services/session/session-tracker';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export const _KismetControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('Kismet control action')
});

/**
 * POST /api/kismet/control
 * Start, stop, or check status of Kismet WiFi discovery service
 * Body: { action: "start" | "stop" | "status" }
 * Query: ?mock=true for mock responses (testing)
 */
const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
	start: {
		success: true,
		message: 'Kismet service started (mock mode)',
		details: 'Mock Kismet process started successfully'
	},
	stop: { success: true, message: 'Kismet stopped gracefully (mock mode)' },
	status: { success: true, isRunning: false, status: 'inactive' }
};

type KismetResult = { success: boolean; error?: string; message?: string };

function resultStatus(result: KismetResult): number {
	if (result.success) return 200;
	return result.error ? 400 : 500;
}

/**
 * Detect the "already running" branch returned by `preflightCheck()` in
 * kismet-control-service-extended. The service uses a `message` field rather
 * than a discriminator, so we match on the canonical string.
 */
function isAlreadyRunning(result: KismetResult): boolean {
	return /already running/i.test(result.message ?? '');
}

async function handleStart(): Promise<KismetResult> {
	const result = await startKismetExtended();
	// Flying-Squirrel integration: on a fresh Kismet run, open a new session
	// and spin up the persistence-polling bridge so devices flow into
	// rf_signals.db with a sessionId stamp. If Kismet was already running we
	// must NOT clobber its existing session — leave the bridge / session alone.
	if (result.success && !isAlreadyRunning(result)) {
		startNewSession('kismet-start', 'Kismet WiFi discovery');
		await getKismetSignalSource().start(getCurrentSessionId());
	}
	return result;
}

async function handleStop(): Promise<KismetResult> {
	// Stop the persistence bridge first so the poller doesn't log fetch
	// failures during Kismet's tear-down.
	await getKismetSignalSource().stop();
	return await stopKismetExtended();
}

const ACTION_HANDLERS: Record<string, () => Promise<KismetResult>> = {
	start: handleStart,
	stop: handleStop,
	status: getKismetStatus
};

async function executeKismetAction(action: string) {
	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
}

export const POST = createHandler(
	async ({ request, url }) => {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(_KismetControlSchema, rawBody, 'user-action');
		if (!validated) return error(400, 'Invalid Kismet control request');

		const { action } = validated;
		if (url.searchParams.get('mock') === 'true') return json(MOCK_RESPONSES[action]);

		return await executeKismetAction(action);
	},
	{ validateBody: _KismetControlSchema }
);
