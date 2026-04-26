/**
 * In-process fan-out bus for newly-persisted RF observations.
 *
 * Every successful insert into `signals` (via `RFDatabase.insertSignal`) emits
 * an `ObservationEvent` here. SSE endpoints subscribe with an optional
 * `sessionId` filter and stream matching events to connected clients. This
 * closes the loop for live map updates while Kismet / Blue Dragon are
 * collecting.
 */

import { logger } from '$lib/utils/logger';

/**
 * Slim event payload — small enough to transmit over SSE without fanning out
 * the full `SignalMarker.metadata` blob. Nullable fields mirror the DbSignal
 * columns (session / device can legitimately be unknown on early frames).
 */
export interface ObservationEvent {
	signalId: string;
	sessionId: string | null;
	source: string;
	deviceId: string | null;
	lat: number;
	lon: number;
	dbm: number;
	frequency: number;
	timestamp: number;
}

export interface SubscriptionFilter {
	/** If set, listener only receives events whose sessionId matches. */
	sessionId?: string;
}

type Handler = (event: ObservationEvent) => void;

interface Subscription {
	filter: SubscriptionFilter;
	handler: Handler;
	active: boolean;
}

function matches(sub: Subscription, event: ObservationEvent): boolean {
	if (!sub.active) return false;
	if (sub.filter.sessionId && sub.filter.sessionId !== event.sessionId) return false;
	return true;
}

function deliver(sub: Subscription, event: ObservationEvent): void {
	try {
		sub.handler(event);
	} catch (err) {
		logger.debug(
			'[signal-bus] subscriber threw',
			{ error: String(err) },
			'signal-bus-listener-error'
		);
	}
}

export class SignalBus {
	private readonly subs = new Set<Subscription>();

	subscribe(filter: SubscriptionFilter, handler: Handler): () => void {
		const sub: Subscription = { filter, handler, active: true };
		this.subs.add(sub);
		return () => {
			if (!sub.active) return;
			sub.active = false;
			this.subs.delete(sub);
		};
	}

	emit(event: ObservationEvent): void {
		// Snapshot before iterating so a listener that unsubscribes mid-emit
		// doesn't mutate the set we're walking.
		for (const sub of Array.from(this.subs)) {
			if (matches(sub, event)) deliver(sub, event);
		}
	}

	/** Diagnostic: subscriber count. Used by tests. */
	size(): number {
		return this.subs.size;
	}
}

let instance: SignalBus | null = null;

export function getSignalBus(): SignalBus {
	if (!instance) instance = new SignalBus();
	return instance;
}

/** Test helper — reset singleton state between suites. */
export function resetSignalBusForTests(): void {
	instance = null;
}
