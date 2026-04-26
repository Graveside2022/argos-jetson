/**
 * Spec-024 PR9a — pure SSE stream factory for /api/spectrum/stream.
 *
 * Subscribes to `sourceRegistry`'s fan-out events (frame / status /
 * error) and serializes them into SSE-framed bytes. Pattern mirrors
 * `createSignalStream` in src/lib/server/services/rf/signal-stream.ts —
 * pure factory so the route layer is thin and integration tests can
 * drive the stream without booting SvelteKit.
 *
 * Emitted SSE event types:
 *   event: connected   — handshake on subscribe
 *   event: frame       — one per SpectrumFrame (FFT row)
 *   event: status      — source state transitions
 *   event: error       — recoverable error from the active source
 *   event: heartbeat   — every `heartbeatMs` to keep proxies alive
 *
 * @module
 */

import { logger } from '$lib/utils/logger';

import { sourceRegistry } from './source-registry';
import type { SourceStatus, SpectrumFrame } from './types';

const DEFAULT_HEARTBEAT_MS = 15_000;

export interface CreateSpectrumStreamOptions {
	heartbeatMs?: number;
}

type SendFn = (event: string, payload: unknown) => void;
type TeardownFn = () => void;

function encodeFrame(event: string, payload: unknown): Uint8Array {
	const body = JSON.stringify(payload);
	return new TextEncoder().encode(`event: ${event}\ndata: ${body}\n\n`);
}

function buildSender(controller: ReadableStreamDefaultController<Uint8Array>): SendFn {
	return (event, payload) => {
		try {
			controller.enqueue(encodeFrame(event, payload));
		} catch {
			// Controller closed — teardown happens via cancel().
		}
	};
}

function attachRegistryListeners(send: SendFn): TeardownFn {
	const onFrame = (frame: SpectrumFrame): void => send('frame', frame);
	const onStatus = (status: SourceStatus): void => send('status', status);
	const onError = (err: Error): void => send('error', { message: err.message });

	sourceRegistry.on('frame', onFrame);
	sourceRegistry.on('status', onStatus);
	sourceRegistry.on('error', onError);

	return (): void => {
		sourceRegistry.off('frame', onFrame);
		sourceRegistry.off('status', onStatus);
		sourceRegistry.off('error', onError);
	};
}

function safeTeardown(teardown: TeardownFn | undefined): void {
	if (!teardown) return;
	try {
		teardown();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn('[spectrum-stream] teardown raised', { msg });
	}
}

export function createSpectrumStream(
	options: CreateSpectrumStreamOptions = {}
): ReadableStream<Uint8Array> {
	const { heartbeatMs = DEFAULT_HEARTBEAT_MS } = options;
	let teardown: TeardownFn | undefined;

	return new ReadableStream<Uint8Array>({
		start(controller) {
			const send = buildSender(controller);
			send('connected', { active: sourceRegistry.getActive()?.device ?? null });

			const detach = attachRegistryListeners(send);
			const heartbeat = setInterval(() => send('heartbeat', { t: Date.now() }), heartbeatMs);

			teardown = (): void => {
				detach();
				clearInterval(heartbeat);
			};
		},
		cancel() {
			safeTeardown(teardown);
			teardown = undefined;
		}
	});
}
