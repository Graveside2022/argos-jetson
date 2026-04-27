import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

// Event handler types for spectrum data streaming
interface SpectrumData {
	frequency?: number;
	power?: number;
	powerValues?: number[];
	startFreq?: number;
	endFreq?: number;
	timestamp?: number;
}

interface ErrorEvent {
	message: string;
	context?: string;
	timestamp?: Date;
	code?: number | null;
	signal?: NodeJS.Signals | null;
}

interface StatusEvent {
	state?: string;
	isRunning?: boolean;
	[key: string]: unknown;
}

/** Build frequency array from spectrum data power values. */
function buildFrequencies(data: SpectrumData): number[] {
	if (!data.powerValues || data.startFreq === undefined || data.endFreq === undefined) return [];
	const start = data.startFreq;
	const step = (data.endFreq - start) / (data.powerValues.length - 1);
	return data.powerValues.map((_: number, i: number) => start + i * step);
}

/** Transform raw spectrum data into the frontend-expected format. */
function transformSpectrum(data: SpectrumData): Record<string, unknown> {
	return {
		frequencies: buildFrequencies(data),
		power: data.powerValues || [],
		power_levels: data.powerValues || [],
		start_freq: data.startFreq,
		stop_freq: data.endFreq,
		center_freq: data.frequency,
		peak_freq: data.frequency,
		peak_power: data.power,
		timestamp: data.timestamp,
		device: 'hackrf'
	};
}

export const GET: RequestHandler = async ({ request }) => {
	const origin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(origin);
	const headers = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		...corsHeaders
	};

	// Shared state between start() and cancel() — hoisted so cancel() can clean up
	let dataHandler: ((data: SpectrumData) => void) | null = null;
	let errorHandler: ((error: ErrorEvent) => void) | null = null;
	let statusHandler: ((status: StatusEvent) => void) | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// Send initial connection message (HackRF only, USRP support removed)
			controller.enqueue(encoder.encode(`event: connected\ndata: {"device": "hackrf"}\n\n`));

			// HackRF data handler
			dataHandler = (data: SpectrumData) => {
				try {
					const message = `event: spectrumData\ndata: ${JSON.stringify(transformSpectrum(data))}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					logger.error('Error processing HackRF spectrum data', {
						error: error instanceof Error ? error.message : String(error)
					});
				}
			};

			// Error handler
			errorHandler = (error: ErrorEvent) => {
				const message = `event: error\ndata: ${JSON.stringify({
					message: error.message || 'Unknown error',
					device: 'hackrf'
				})}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			// Status handler
			statusHandler = (status: StatusEvent) => {
				const message = `event: status\ndata: ${JSON.stringify({
					...status,
					device: 'hackrf'
				})}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			// Subscribe to HackRF events. Internal sweepManager event name is
			// `spectrum_data` (snake_case) per sweep-coordinator.ts:227 — the
			// camelCase `spectrumData` we EMIT on the SSE wire (event line above)
			// is a separate external contract. Subscribing to the wrong name
			// silently disables the entire data path. See task #3 root cause.
			sweepManager.on('spectrum_data', dataHandler);
			sweepManager.on('error', errorHandler);
			sweepManager.on('status', statusHandler);

			// Send heartbeat every 30 seconds
			heartbeatInterval = setInterval(() => {
				const heartbeat = `event: heartbeat\ndata: {"time": "${new Date().toISOString()}", "device": "hackrf"}\n\n`;
				controller.enqueue(encoder.encode(heartbeat));
			}, 30000);
		},
		cancel() {
			// Called by Web Streams API when reader is cancelled (SvelteKit
			// cancels the reader on HTTP client disconnect via res.on('close')).
			// Previously this cleanup was in a return value from start() which
			// is ignored by the spec — this is the correct location.
			if (heartbeatInterval) {
				clearInterval(heartbeatInterval);
				heartbeatInterval = null;
			}

			// Cleanup HackRF event handlers (must mirror the on() event names —
			// off('spectrumData', h) would not match an on('spectrum_data', h)
			// listener and would leak the handler indefinitely).
			if (dataHandler) sweepManager.off('spectrum_data', dataHandler);
			if (errorHandler) sweepManager.off('error', errorHandler);
			if (statusHandler) sweepManager.off('status', statusHandler);

			dataHandler = null;
			errorHandler = null;
			statusHandler = null;
		}
	});

	return new Response(stream, { headers });
};

// Add CORS headers for OPTIONS
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
