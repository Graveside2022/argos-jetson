/**
 * GET /api/system/logs
 *
 * Returns recent Argos service logs read one-shot from the systemd journal.
 *
 * Query params:
 *   minutes  — time window, 1..1440 (default 5)
 *   severity — 'error' | 'warn' | 'all' (default 'error')
 *
 * Response: { success, minutes, total_errors, sources: [{ source, entries }] }
 * Failures (bad params, journald unreadable) resolve to { success: false, error }
 * at HTTP 200 — every consumer already branches on `success`.
 */

import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { validateAllowlist, validateNumericParam } from '$lib/server/security/input-sanitizer';
import {
	getSystemLogs,
	type LogSeverity,
	type SystemLogsResult
} from '$lib/server/services/system/journald-logs';

const SEVERITIES = ['error', 'warn', 'all'] as const satisfies readonly LogSeverity[];

export const GET = createHandler(async ({ url }): Promise<SystemLogsResult> => {
	let minutes: number;
	let severity: LogSeverity;
	try {
		minutes = Math.floor(
			validateNumericParam(url.searchParams.get('minutes') ?? '5', 'minutes', 1, 1440)
		);
		severity = validateAllowlist(
			url.searchParams.get('severity') ?? 'error',
			'severity',
			SEVERITIES
		);
	} catch (err) {
		return { success: false, error: errMsg(err) };
	}

	return getSystemLogs(minutes, severity);
});
