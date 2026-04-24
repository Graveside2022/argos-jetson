import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getCurrentSessionId,
	listSessions,
	startNewSession
} from '$lib/server/services/session/session-tracker';

const MAX_LIMIT = 200;

/**
 * GET /api/sessions?limit=50
 * List recent RF-visualization sessions (newest first) + the currently-active id.
 */
export const GET = createHandler(async ({ url }) => {
	const raw = Number(url.searchParams.get('limit') ?? '50');
	const limit = Number.isFinite(raw) ? Math.min(Math.max(1, raw), MAX_LIMIT) : 50;
	return json({
		currentId: getCurrentSessionId(),
		sessions: listSessions(limit)
	});
});

/**
 * POST /api/sessions
 * Body: { label?: string, metadata?: Record<string, unknown> }
 * Starts a manual session (closes any open one). Used by the dashboard's
 * "New Session" button to mark a mission boundary mid-run.
 */
interface SessionPostBody {
	label?: string;
	metadata?: Record<string, unknown>;
}

function extractLabel(body: { label?: unknown }): string | undefined {
	return typeof body.label === 'string' ? body.label : undefined;
}

function extractMetadata(body: { metadata?: unknown }): Record<string, unknown> | undefined {
	const m = body.metadata;
	if (!m || typeof m !== 'object' || Array.isArray(m)) return undefined;
	return m as Record<string, unknown>;
}

async function parseSessionBody(request: Request): Promise<SessionPostBody> {
	try {
		const body = (await request.json()) as { label?: unknown; metadata?: unknown } | null;
		if (!body) return {};
		return { label: extractLabel(body), metadata: extractMetadata(body) };
	} catch {
		return {};
	}
}

export const POST = createHandler(async ({ request }) => {
	const { label, metadata } = await parseSessionBody(request);
	const id = startNewSession('manual', label, metadata);
	return json({ id, label: label ?? null });
});
