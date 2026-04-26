/**
 * Unit test for the pure live-refresh controller that owns the EventSource
 * + debounced aggregate refetch + 30 s reconcile tick. The store delegates
 * to this controller so we can test the scheduling logic without runes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type LiveRefreshCallbacks, LiveRefreshController } from '$lib/stores/rf-live-refresh';

class FakeEventSource {
	static instances: FakeEventSource[] = [];
	url: string;
	onopen: (() => void) | null = null;
	onerror: ((err: unknown) => void) | null = null;
	onmessage: ((ev: MessageEvent) => void) | null = null;
	private listeners = new Map<string, (ev: MessageEvent) => void>();
	readyState = 0;
	closed = false;

	constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
		this.listeners.set(type, fn);
	}

	removeEventListener(type: string): void {
		this.listeners.delete(type);
	}

	dispatch(type: string, data: unknown): void {
		const fn = this.listeners.get(type);
		if (fn) fn(new MessageEvent(type, { data: JSON.stringify(data) }));
	}

	close(): void {
		this.closed = true;
	}

	static reset(): void {
		FakeEventSource.instances = [];
	}
}

describe('LiveRefreshController', () => {
	let controller: LiveRefreshController;
	let reloadSpy: ReturnType<typeof vi.fn>;
	let callbacks: LiveRefreshCallbacks;

	beforeEach(() => {
		vi.useFakeTimers();
		FakeEventSource.reset();
		reloadSpy = vi.fn().mockResolvedValue(undefined);
		callbacks = {
			reload: reloadSpy,
			eventSourceFactory: (url) => new FakeEventSource(url) as unknown as EventSource,
			debounceMs: 50,
			reconcileMs: 1000
		};
		controller = new LiveRefreshController(callbacks);
	});

	afterEach(() => {
		controller.disconnect();
		vi.useRealTimers();
	});

	it('opens an EventSource on connect() pointing at /api/rf/stream', () => {
		controller.connect('sess-A');
		expect(FakeEventSource.instances).toHaveLength(1);
		expect(FakeEventSource.instances[0].url).toContain('/api/rf/stream');
		expect(FakeEventSource.instances[0].url).toContain('session=sess-A');
	});

	it('connects without session param when sessionId is omitted', () => {
		controller.connect();
		expect(FakeEventSource.instances[0].url).not.toContain('session=');
	});

	it('debounces reload() — 10 events within the window fire only 1 reload', async () => {
		controller.connect('sess-A');
		const es = FakeEventSource.instances[0];
		for (let i = 0; i < 10; i++) es.dispatch('observation', { signalId: `s-${i}` });
		expect(reloadSpy).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(60);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
	});

	it('reconcile tick fires reload() on cadence even with no events', async () => {
		controller.connect('sess-A');
		expect(reloadSpy).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1100);
		expect(reloadSpy).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(reloadSpy).toHaveBeenCalledTimes(2);
	});

	it('disconnect() closes EventSource and stops timers', async () => {
		controller.connect('sess-A');
		const es = FakeEventSource.instances[0];
		es.dispatch('observation', { signalId: 's-1' });
		controller.disconnect();
		expect(es.closed).toBe(true);
		await vi.advanceTimersByTimeAsync(2000);
		expect(reloadSpy).not.toHaveBeenCalled();
	});

	it('reconnecting replaces the old EventSource, not stacks it', () => {
		controller.connect('sess-A');
		controller.connect('sess-B');
		expect(FakeEventSource.instances[0].closed).toBe(true);
		expect(FakeEventSource.instances[1].closed).toBe(false);
		expect(FakeEventSource.instances[1].url).toContain('session=sess-B');
	});

	it('reports isLive true after connect, false after disconnect', () => {
		expect(controller.isLive).toBe(false);
		controller.connect('sess-A');
		expect(controller.isLive).toBe(true);
		controller.disconnect();
		expect(controller.isLive).toBe(false);
	});

	it('heartbeat events do NOT trigger a reload', async () => {
		controller.connect('sess-A');
		const es = FakeEventSource.instances[0];
		es.dispatch('heartbeat', { ts: Date.now() });
		await vi.advanceTimersByTimeAsync(100);
		expect(reloadSpy).not.toHaveBeenCalled();
	});

	it('connected handshake event does NOT trigger a reload', async () => {
		controller.connect('sess-A');
		const es = FakeEventSource.instances[0];
		es.dispatch('connected', { sessionId: 'sess-A' });
		await vi.advanceTimersByTimeAsync(100);
		expect(reloadSpy).not.toHaveBeenCalled();
	});
});
