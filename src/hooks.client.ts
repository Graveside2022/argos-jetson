import type { HandleClientError } from '@sveltejs/kit';

/**
 * Global error handler for unhandled client-side errors.
 *
 * Mirrors the shape of `handleError` in src/hooks.server.ts so the
 * `page.error` object is consistent whether the error originated on the
 * server or in the browser. Server-side ingestion (audit log, metrics)
 * remains the source of truth; this hook only surfaces client errors to
 * the browser console and returns a safe `App.Error` payload.
 */
export const handleError: HandleClientError = ({ error, event, status }) => {
	const errorId = crypto.randomUUID();

	const errorDetails: Record<string, unknown> = {
		errorId,
		status,
		url: event.url.pathname,
		timestamp: new Date().toISOString(),
		...(error instanceof Error
			? { name: error.name, message: error.message, stack: error.stack }
			: { error: String(error), type: typeof error })
	};

	console.error('Unhandled client error occurred', errorDetails);

	return {
		message: 'An unexpected client error occurred. We have been notified.',
		errorId
	};
};
