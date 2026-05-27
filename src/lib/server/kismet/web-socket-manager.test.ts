import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

const { infoMock, warnMock, errorMock } = vi.hoisted(() => ({
	infoMock: vi.fn(),
	warnMock: vi.fn(),
	errorMock: vi.fn()
}));

vi.mock('$lib/server/env', () => ({
	env: {
		KISMET_API_URL: 'http://localhost:0',
		KISMET_API_KEY: 'test-key'
	}
}));

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: infoMock,
		warn: warnMock,
		error: errorMock,
		debug: vi.fn()
	}
}));

// Avoid spinning real timers / kismet HTTP from the manager constructor.
vi.mock('./kismet-poller', () => ({
	pollKismetDevices: vi.fn().mockResolvedValue(undefined),
	resetPollerBackoff: vi.fn()
}));

import { WebSocketManager } from './web-socket-manager';

/**
 * Minimal fake WebSocket: mimics the surface our manager touches —
 * readyState, on(event, fn), send(), close(), and the static readyState
 * constants (which we proxy to ws.WebSocket).
 */
class FakeWS extends EventEmitter {
	readyState: number = WebSocket.OPEN;
	bufferedAmount = 0;
	send = vi.fn();
	close = vi.fn();
}

function getManager(): WebSocketManager {
	// Reset globalThis singleton so each test constructs a fresh manager.
	globalThis.__argos_wsManager = undefined;
	return WebSocketManager.getInstance();
}

describe('WebSocketManager.addClient — FINDING-10 close-event race', () => {
	let mgr: WebSocketManager;

	beforeEach(() => {
		infoMock.mockClear();
		errorMock.mockClear();
		mgr = getManager();
	});

	afterEach(() => {
		mgr.destroy();
		globalThis.__argos_wsManager = undefined;
	});

	it('drops a socket that is already CLOSED before addClient runs', () => {
		const ws = new FakeWS();
		ws.readyState = WebSocket.CLOSED;
		mgr.addClient(ws as unknown as WebSocket);
		expect(infoMock).toHaveBeenCalledWith(
			expect.stringMatching(/already-closed/i),
			expect.objectContaining({ readyState: WebSocket.CLOSED })
		);
		// No 'connected' log + no entry in clients map.
		expect(
			infoMock.mock.calls.some(
				(c) => typeof c[0] === 'string' && c[0].includes('Client connected')
			)
		).toBe(false);
	});

	it('drops a socket that is CLOSING before addClient runs', () => {
		const ws = new FakeWS();
		ws.readyState = WebSocket.CLOSING;
		mgr.addClient(ws as unknown as WebSocket);
		expect(infoMock).toHaveBeenCalledWith(
			expect.stringMatching(/already-closed/i),
			expect.objectContaining({ readyState: WebSocket.CLOSING })
		);
	});

	it('accepts an OPEN socket and registers it', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		expect(
			infoMock.mock.calls.some(
				(c) => typeof c[0] === 'string' && c[0].includes('Client connected')
			)
		).toBe(true);
	});
});

function sendMessage(ws: FakeWS, payload: unknown) {
	ws.emit('message', Buffer.from(JSON.stringify(payload)));
}

describe('WebSocketManager client message parsing — rejects malformed (FINDING-11)', () => {
	let mgr: WebSocketManager;

	beforeEach(() => {
		errorMock.mockClear();
		mgr = getManager();
	});

	afterEach(() => {
		mgr.destroy();
		globalThis.__argos_wsManager = undefined;
	});

	it('rejects a message missing the type field', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		sendMessage(ws, { events: ['foo'] });
		expect(errorMock).toHaveBeenCalledWith(
			'Invalid client message shape',
			expect.objectContaining({ issues: expect.any(Array) })
		);
	});

	it('rejects events that is not an array of strings', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		sendMessage(ws, { type: 'subscribe', events: [1, 2, 3] });
		expect(errorMock).toHaveBeenCalledWith(
			'Invalid client message shape',
			expect.objectContaining({ issues: expect.any(Array) })
		);
	});

	it('rejects filters.deviceTypes that is not an array of strings', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		sendMessage(ws, {
			type: 'set_filters',
			filters: { deviceTypes: [{ injected: true }] }
		});
		expect(errorMock).toHaveBeenCalledWith(
			'Invalid client message shape',
			expect.objectContaining({ issues: expect.any(Array) })
		);
	});
});

describe('WebSocketManager client message parsing — accepts well-formed (FINDING-11)', () => {
	let mgr: WebSocketManager;

	beforeEach(() => {
		errorMock.mockClear();
		mgr = getManager();
	});

	afterEach(() => {
		mgr.destroy();
		globalThis.__argos_wsManager = undefined;
	});

	it('accepts a well-formed subscribe message', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		sendMessage(ws, { type: 'subscribe', events: ['device_update'] });
		expect(errorMock).not.toHaveBeenCalledWith(
			'Invalid client message shape',
			expect.anything()
		);
	});

	it('accepts a well-formed set_filters message', () => {
		const ws = new FakeWS();
		mgr.addClient(ws as unknown as WebSocket);
		sendMessage(ws, {
			type: 'set_filters',
			filters: { minSignal: -70, deviceTypes: ['Wi-Fi AP'] }
		});
		expect(errorMock).not.toHaveBeenCalledWith(
			'Invalid client message shape',
			expect.anything()
		);
	});
});

describe('WebSocketManager.broadcast — FINDING MED-3: backpressure', () => {
	let mgr: WebSocketManager;
	const BIG_BUFFER = 5_000_000; // > MAX_BUFFER_BYTES (4 MB)

	beforeEach(() => {
		infoMock.mockClear();
		warnMock.mockClear();
		errorMock.mockClear();
		mgr = getManager();
	});

	afterEach(() => {
		mgr.destroy();
		globalThis.__argos_wsManager = undefined;
	});

	function makeMessage() {
		return {
			type: 'device_update' as const,
			data: {},
			timestamp: '2026-05-26T18:00:00Z'
		};
	}

	it('skips send + emits warn when bufferedAmount exceeds MAX_BUFFER_BYTES', () => {
		const ws = new FakeWS();
		ws.bufferedAmount = BIG_BUFFER;
		mgr.addClient(ws as unknown as WebSocket);
		ws.send.mockClear();

		mgr.broadcast(makeMessage());

		expect(ws.send).not.toHaveBeenCalled();
		expect(warnMock).toHaveBeenCalledWith(
			'Slow consumer; skipping broadcast',
			expect.objectContaining({ slowConsumerCount: 1 })
		);
	});

	it('closes the socket with code 4001 after SLOW_CONSUMER_THRESHOLD consecutive over-buffer broadcasts', () => {
		const ws = new FakeWS();
		ws.bufferedAmount = BIG_BUFFER;
		mgr.addClient(ws as unknown as WebSocket);
		ws.send.mockClear();

		mgr.broadcast(makeMessage());
		mgr.broadcast(makeMessage());
		expect(ws.close).not.toHaveBeenCalled();

		mgr.broadcast(makeMessage()); // 3rd over-buffer broadcast

		expect(ws.close).toHaveBeenCalledWith(4001, 'Too slow');
		expect(errorMock).toHaveBeenCalledWith(
			'Closing slow consumer after sustained backpressure',
			expect.objectContaining({ slowConsumerCount: 3 })
		);
	});

	it('resets slowConsumerCount on a healthy send so transient stutter does not close', () => {
		const ws = new FakeWS();
		ws.bufferedAmount = BIG_BUFFER;
		mgr.addClient(ws as unknown as WebSocket);

		mgr.broadcast(makeMessage()); // count=1
		ws.bufferedAmount = 100; // back under threshold
		mgr.broadcast(makeMessage()); // sends; resets count
		ws.bufferedAmount = BIG_BUFFER; // stutter again
		mgr.broadcast(makeMessage()); // count=1 again, NOT 2
		mgr.broadcast(makeMessage()); // count=2

		expect(ws.close).not.toHaveBeenCalled();
	});

	it('sends normally to fast consumers with bufferedAmount under threshold', () => {
		const ws = new FakeWS();
		ws.bufferedAmount = 1024;
		mgr.addClient(ws as unknown as WebSocket);
		ws.send.mockClear();

		mgr.broadcast(makeMessage());

		expect(ws.send).toHaveBeenCalledTimes(1);
		expect(ws.close).not.toHaveBeenCalled();
	});
});
