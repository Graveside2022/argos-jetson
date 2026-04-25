/**
 * SSE helper that turns SignalBus observations into a ReadableStream.
 *
 * The stream emits three event types:
 *   event: connected   — first frame, handshake.
 *   event: observation — every bus event that passes the sessionId filter.
 *   event: heartbeat   — every `heartbeatMs` to keep proxies from reaping
 *                        the connection during quiet periods.
 *
 * `createSignalStream()` is pure: the SvelteKit route wraps it with HTTP
 * headers and auth. Keeping it pure lets the integration tests drive it
 * without booting the framework.
 */

import { getSignalBus, type ObservationEvent } from './signal-bus';

const DEFAULT_HEARTBEAT_MS = 15_000;

export interface CreateSignalStreamOptions {
	/** Only deliver observations that match this sessionId. Omit to receive all. */
	sessionId?: string;
	/** Keep-alive cadence. Default 15 s. */
	heartbeatMs?: number;
}

function encodeFrame(event: string, payload: unknown): Uint8Array {
	const body = JSON.stringify(payload);
	return new TextEncoder().encode(`event: ${event}\ndata: ${body}\n\n`);
}

export function createSignalStream(
	options: CreateSignalStreamOptions = {}
): ReadableStream<Uint8Array> {
	const { sessionId, heartbeatMs = DEFAULT_HEARTBEAT_MS } = options;

	let unsubscribe: (() => void) | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encodeFrame('connected', { sessionId: sessionId ?? null }));

			const handler = (event: ObservationEvent): void => {
				try {
					controller.enqueue(encodeFrame('observation', event));
				} catch {
					// Controller closed — listener will be torn down by cancel().
				}
			};
			unsubscribe = getSignalBus().subscribe({ sessionId }, handler);

			heartbeatTimer = setInterval(() => {
				try {
					controller.enqueue(encodeFrame('heartbeat', { ts: Date.now() }));
				} catch {
					/* controller closed */
				}
			}, heartbeatMs);
		},
		cancel() {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = null;
			}
		}
	});
}
