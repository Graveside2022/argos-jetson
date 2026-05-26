import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

const { infoMock, errorMock } = vi.hoisted(() => ({
	infoMock: vi.fn(),
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
		warn: vi.fn(),
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
