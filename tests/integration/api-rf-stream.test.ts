/**
 * Integration test for the live observation SSE stream.
 *
 * We exercise the pure `createSignalStream()` helper that wraps the
 * ReadableStream, rather than booting SvelteKit. Events emitted onto
 * the SignalBus must land as `event: observation` frames; heartbeats
 * must fire; cancel() must unsubscribe cleanly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	getSignalBus,
	type ObservationEvent,
	resetSignalBusForTests
} from '$lib/server/services/rf/signal-bus';
import { createSignalStream } from '$lib/server/services/rf/signal-stream';

function ev(overrides: Partial<ObservationEvent> = {}): ObservationEvent {
	return {
		signalId: `sig-${Math.random().toString(36).slice(2, 9)}`,
		sessionId: 'sess-A',
		source: 'bluedragon',
		deviceId: 'aa:bb:cc:dd:ee:01',
		lat: 35.0,
		lon: -116.0,
		dbm: -55,
		frequency: 2440,
		timestamp: Date.now(),
		...overrides
	};
}

type ReadResult = { value: Uint8Array | undefined; done: boolean };

function raceReadWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<ReadResult> {
	return Promise.race([
		reader.read() as Promise<ReadResult>,
		new Promise<ReadResult>((resolve) =>
			setTimeout(() => resolve({ value: undefined, done: true }), 20)
		)
	]);
}

async function drainStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	decoder: TextDecoder,
	deadline: number
): Promise<string> {
	let buf = '';
	while (Date.now() < deadline) {
		const { value, done } = await raceReadWithTimeout(reader);
		if (done) break;
		if (value) buf += decoder.decode(value, { stream: true });
	}
	return buf;
}

async function readAllFrames(stream: ReadableStream<Uint8Array>, timeoutMs = 250): Promise<string> {
	const reader = stream.getReader();
	const buf = await drainStream(reader, new TextDecoder(), Date.now() + timeoutMs);
	await reader.cancel().catch(() => undefined);
	return buf;
}

function parseOneFrame(block: string): { event: string | null; data: string } | null {
	if (!block.trim()) return null;
	let event: string | null = null;
	const dataLines: string[] = [];
	for (const line of block.split('\n')) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}
	return { event, data: dataLines.join('\n') };
}

function parseSseFrames(text: string): Array<{ event: string | null; data: string }> {
	return text
		.split('\n\n')
		.map(parseOneFrame)
		.filter((f): f is { event: string | null; data: string } => f !== null);
}

describe('signal-stream SSE', () => {
	beforeEach(() => {
		resetSignalBusForTests();
	});

	afterEach(() => {
		resetSignalBusForTests();
	});

	it('emits a `connected` event as the first frame', async () => {
		const stream = createSignalStream({ heartbeatMs: 10_000 });
		const text = await readAllFrames(stream);
		const frames = parseSseFrames(text);
		expect(frames.length).toBeGreaterThanOrEqual(1);
		expect(frames[0].event).toBe('connected');
	});

	it('delivers observations emitted on the bus as `observation` events', async () => {
		const stream = createSignalStream({ heartbeatMs: 10_000 });
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		// consume connected frame
		await reader.read();

		getSignalBus().emit(ev({ signalId: 'sig-test-1' }));
		const { value } = await reader.read();
		expect(value).toBeDefined();
		const frame = decoder.decode(value);
		expect(frame).toContain('event: observation');
		expect(frame).toContain('sig-test-1');

		await reader.cancel();
	});

	it('filters observations by sessionId query param', async () => {
		const stream = createSignalStream({ sessionId: 'sess-A', heartbeatMs: 10_000 });
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		await reader.read(); // connected

		getSignalBus().emit(ev({ sessionId: 'sess-B', signalId: 'should-not-appear' }));
		getSignalBus().emit(ev({ sessionId: 'sess-A', signalId: 'should-appear' }));

		const { value } = await reader.read();
		expect(value).toBeDefined();
		const frame = decoder.decode(value);
		expect(frame).toContain('should-appear');
		expect(frame).not.toContain('should-not-appear');

		await reader.cancel();
	});

	it('emits heartbeat frames at the configured interval', async () => {
		const stream = createSignalStream({ heartbeatMs: 20 });
		const text = await readAllFrames(stream, 120);
		const frames = parseSseFrames(text);
		const heartbeats = frames.filter((f) => f.event === 'heartbeat');
		expect(heartbeats.length).toBeGreaterThanOrEqual(1);
	});

	it('unsubscribes from the bus when the stream is cancelled', async () => {
		const before = getSignalBus().size();
		const stream = createSignalStream({ heartbeatMs: 10_000 });
		const reader = stream.getReader();
		await reader.read(); // connected
		expect(getSignalBus().size()).toBe(before + 1);
		await reader.cancel();
		// allow cleanup microtasks
		await new Promise((r) => setTimeout(r, 10));
		expect(getSignalBus().size()).toBe(before);
	});

	it('multiple independent streams receive the same event', async () => {
		const a = createSignalStream({ heartbeatMs: 10_000 });
		const b = createSignalStream({ heartbeatMs: 10_000 });
		const ra = a.getReader();
		const rb = b.getReader();
		const dec = new TextDecoder();
		await ra.read();
		await rb.read();
		getSignalBus().emit(ev({ signalId: 'broadcast' }));
		const fa = dec.decode((await ra.read()).value);
		const fb = dec.decode((await rb.read()).value);
		expect(fa).toContain('broadcast');
		expect(fb).toContain('broadcast');
		await ra.cancel();
		await rb.cancel();
	});
});
