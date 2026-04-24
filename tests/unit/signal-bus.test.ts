import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ObservationEvent } from '$lib/server/services/rf/signal-bus';
import { SignalBus } from '$lib/server/services/rf/signal-bus';

function ev(overrides: Partial<ObservationEvent> = {}): ObservationEvent {
	return {
		signalId: 'sig-1',
		sessionId: 'sess-1',
		source: 'bluedragon',
		deviceId: 'aa:bb:cc:dd:ee:ff',
		lat: 35.0,
		lon: -116.0,
		dbm: -60,
		frequency: 2440,
		timestamp: Date.now(),
		...overrides
	};
}

describe('SignalBus', () => {
	afterEach(() => {
		// fresh instance per test
	});

	it('delivers emitted observations to subscribed listeners', () => {
		const bus = new SignalBus();
		const received: ObservationEvent[] = [];
		bus.subscribe({}, (o) => received.push(o));
		bus.emit(ev());
		expect(received).toHaveLength(1);
		expect(received[0].signalId).toBe('sig-1');
	});

	it('filters by sessionId — listener gets only matching sessions', () => {
		const bus = new SignalBus();
		const forSessA: ObservationEvent[] = [];
		bus.subscribe({ sessionId: 'sess-A' }, (o) => forSessA.push(o));
		bus.emit(ev({ sessionId: 'sess-A' }));
		bus.emit(ev({ sessionId: 'sess-B' }));
		bus.emit(ev({ sessionId: 'sess-A' }));
		expect(forSessA).toHaveLength(2);
		expect(forSessA.every((e) => e.sessionId === 'sess-A')).toBe(true);
	});

	it('unsubscribe stops further delivery', () => {
		const bus = new SignalBus();
		const received: ObservationEvent[] = [];
		const unsub = bus.subscribe({}, (o) => received.push(o));
		bus.emit(ev());
		unsub();
		bus.emit(ev({ signalId: 'sig-2' }));
		expect(received).toHaveLength(1);
	});

	it('swallows listener exceptions so one bad subscriber cannot break others', () => {
		const bus = new SignalBus();
		const received: ObservationEvent[] = [];
		bus.subscribe({}, () => {
			throw new Error('boom');
		});
		bus.subscribe({}, (o) => received.push(o));
		expect(() => bus.emit(ev())).not.toThrow();
		expect(received).toHaveLength(1);
	});

	it('supports multiple independent subscribers with different filters', () => {
		const bus = new SignalBus();
		const allEvents: ObservationEvent[] = [];
		const onlySessA: ObservationEvent[] = [];
		bus.subscribe({}, (o) => allEvents.push(o));
		bus.subscribe({ sessionId: 'sess-A' }, (o) => onlySessA.push(o));
		bus.emit(ev({ sessionId: 'sess-A' }));
		bus.emit(ev({ sessionId: 'sess-B' }));
		expect(allEvents).toHaveLength(2);
		expect(onlySessA).toHaveLength(1);
	});

	it('exposes a singleton getSignalBus() returning the same instance', async () => {
		const mod = await import('$lib/server/services/rf/signal-bus');
		expect(mod.getSignalBus()).toBe(mod.getSignalBus());
	});

	it('singleton emission reaches subscribers across import call-sites', async () => {
		const { getSignalBus } = await import('$lib/server/services/rf/signal-bus');
		const received: ObservationEvent[] = [];
		const unsub = getSignalBus().subscribe({}, (o) => received.push(o));
		getSignalBus().emit(ev({ signalId: 'cross-import' }));
		unsub();
		expect(received.find((e) => e.signalId === 'cross-import')).toBeDefined();
	});

	it('does not deliver events to listener after unsubscribe even if listener was queued', () => {
		const bus = new SignalBus();
		let received = 0;
		const unsub = bus.subscribe({}, () => received++);
		unsub();
		bus.emit(ev());
		expect(received).toBe(0);
	});

	it('subscribers added mid-flight only get events emitted after they subscribed', () => {
		const bus = new SignalBus();
		const late: ObservationEvent[] = [];
		bus.emit(ev({ signalId: 'before-subscribe' }));
		bus.subscribe({}, (o) => late.push(o));
		bus.emit(ev({ signalId: 'after-subscribe' }));
		expect(late).toHaveLength(1);
		expect(late[0].signalId).toBe('after-subscribe');
	});

	it('subscribe returns function that is safe to call more than once', () => {
		const bus = new SignalBus();
		const unsub = bus.subscribe({}, vi.fn());
		unsub();
		expect(() => unsub()).not.toThrow();
	});
});
