import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: warnMock,
		error: vi.fn(),
		debug: vi.fn()
	}
}));

import { BaseWebSocket } from './base';
import { type ReconnectState, scheduleReconnect } from './websocket-reconnect';
import { CONFIG_DEFAULTS, type ResolvedConfig } from './websocket-types';

/**
 * Minimal fake WebSocket implementing the browser-API surface BaseWebSocket
 * touches: readyState, onopen/onmessage/onerror/onclose, send, close. The
 * onmessage / onerror handlers receive synthetic event objects so the
 * BaseWebSocket onerror branch (LOW-4) and pong path (HIGH-1) can both
 * be exercised without a real socket.
 */
// Mirror the global WebSocket.OPEN constant so the readyState gate in
// websocket-heartbeat.ts (which checks against global WebSocket.OPEN) passes.
const OPEN: number =
	(globalThis as unknown as { WebSocket?: { OPEN?: number } }).WebSocket?.OPEN ?? 1;
class FakeWs {
	readyState = OPEN;
	onopen: ((ev: unknown) => void) | null = null;
	onmessage: ((ev: { data: string | ArrayBuffer | Blob }) => void) | null = null;
	onerror: ((ev: { type: string }) => void) | null = null;
	onclose: ((ev: { code: number; reason: string }) => void) | null = null;
	send = vi.fn();
	close = vi.fn();
}

const { fakeHolder } = vi.hoisted(() => ({ fakeHolder: { last: null as unknown as FakeWs } }));
vi.mock('./websocket-types', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./websocket-types')>();
	return {
		...actual,
		createWebSocket: (_url: string, _protocols?: string | string[]) => {
			fakeHolder.last = new FakeWs();
			return fakeHolder.last as unknown as WebSocket;
		}
	};
});

class TestableSocket extends BaseWebSocket {
	heartbeatSent = 0;
	protected onConnected(): void {}
	protected onDisconnected(): void {}
	protected onError(_e: Error): void {}
	protected handleIncomingMessage(_d: unknown): void {}
	protected sendHeartbeat(): void {
		this.heartbeatSent++;
	}
	// Expose protected handleMessage + heartbeatState for assertions.
	public testHandleMessage(data: unknown): void {
		this.handleMessage(data);
	}
	public testHeartbeatLast(): number {
		// Cast to access the private state via the protected helpers indirectly.
		return (this as unknown as { heartbeatState: { lastHeartbeat: number } }).heartbeatState
			.lastHeartbeat;
	}
}

describe('BaseWebSocket.handleMessage — FINDING HIGH-1: pong updates lastHeartbeat', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('writes Date.now() into heartbeatState.lastHeartbeat on inbound pong', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-26T18:00:00Z'));
		const sock = new TestableSocket({ url: 'ws://localhost/test' });

		expect(sock.testHeartbeatLast()).toBe(0);

		sock.testHandleMessage({ type: 'pong', timestamp: '2026-05-26T18:00:00Z' });

		expect(sock.testHeartbeatLast()).toBe(Date.parse('2026-05-26T18:00:00Z'));
	});

	it('leaves lastHeartbeat at 0 when no pong arrives — preserves cold-start no-false-positive guarantee', () => {
		// The > 0 guard at websocket-heartbeat.ts:46 means the dead-conn
		// close MUST NOT fire before any pong arrives. Verify init stays 0
		// and a non-pong message doesn't accidentally bump it.
		const sock = new TestableSocket({ url: 'ws://localhost/test' });
		sock.testHandleMessage({ type: 'subscribe', events: ['device_update'] });
		expect(sock.testHeartbeatLast()).toBe(0);
	});
});

describe('scheduleReconnect — FINDING HIGH-2: jitter spreads delays', () => {
	function freshState(): ReconnectState {
		return { reconnectAttempts: 0, currentReconnectInterval: 1000, reconnectTimer: null };
	}
	function cfg(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
		return {
			...CONFIG_DEFAULTS,
			url: 'ws://localhost/test',
			...overrides
		} as ResolvedConfig;
	}

	let setTimeoutSpy: { mockRestore: () => void };
	let delays: number[];

	beforeEach(() => {
		delays = [];
		const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
			_fn: () => void,
			ms?: number
		) => {
			delays.push(ms ?? 0);
			return 0 as unknown as ReturnType<typeof setTimeout>;
		}) as unknown as typeof setTimeout);
		setTimeoutSpy = spy as unknown as { mockRestore: () => void };
	});

	afterEach(() => {
		setTimeoutSpy.mockRestore();
	});

	it('produces delays in [interval, interval * 1.5] with positive variance over N=20', () => {
		const config = cfg({ reconnectBackoffMultiplier: 1 }); // hold interval steady so jitter is the only varying input
		for (let i = 0; i < 20; i++) {
			const state = freshState();
			scheduleReconnect(state, config, () => {});
		}

		const min = Math.min(...delays);
		const max = Math.max(...delays);
		expect(min).toBeGreaterThanOrEqual(1000);
		expect(max).toBeLessThanOrEqual(1500);
		expect(new Set(delays).size).toBeGreaterThan(1); // variance > 0 — the bug fix
	});

	it('keeps stored currentReconnectInterval clean for deterministic exponential backoff', () => {
		const state = freshState();
		const config = cfg({ reconnectBackoffMultiplier: 2, maxReconnectInterval: 30000 });
		for (let i = 0; i < 4; i++) {
			scheduleReconnect(state, config, () => {});
			// Simulate the timer firing so the library re-enters; our stub never fires it.
			state.reconnectTimer = null;
		}
		// 1000 * 2^4 = 16000 — within cap, so exact equality.
		expect(state.currentReconnectInterval).toBe(16000);
	});
});
