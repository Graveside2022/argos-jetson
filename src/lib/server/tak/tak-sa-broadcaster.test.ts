/**
 * TakSaBroadcaster — structural CotSender contract.
 *
 * Tests added with the SCC kill (sentrux Day-0 cycle:
 * tak-sa-broadcaster ⇄ tak-service). Confirms the broadcaster now
 * accepts any object with a `sendCot()` method, no longer importing
 * the concrete TakService class.
 *
 * Live broadcast behavior (interval timing, GPS reads, 1-Hz throttling)
 * is covered indirectly by tak-service integration tests + manual TAK
 * server validation. This file locks the de-coupling.
 */

import type CoT from '@tak-ps/node-cot';
import { describe, expect, it, vi } from 'vitest';

import { TakSaBroadcaster } from './tak-sa-broadcaster';
import type { CotSender } from './types';

/** Minimal stub satisfying the CotSender interface. */
function makeStubSender(): { sender: CotSender; sendCot: ReturnType<typeof vi.fn> } {
	const sendCot = vi.fn();
	return { sender: { sendCot }, sendCot };
}

describe('TakSaBroadcaster — CotSender contract (post-SCC-kill)', () => {
	it('accepts a structurally-typed CotSender (no TakService import required)', () => {
		const { sender } = makeStubSender();
		// Constructor type-checks against CotSender, not TakService.
		expect(() => new TakSaBroadcaster(sender)).not.toThrow();
	});

	it('start() / stop() are idempotent', () => {
		const { sender } = makeStubSender();
		const b = new TakSaBroadcaster(sender);
		expect(() => {
			b.start();
			b.start();
			b.stop();
			b.stop();
		}).not.toThrow();
	});

	it('does not call sendCot before start()', () => {
		const { sender, sendCot } = makeStubSender();
		new TakSaBroadcaster(sender);
		expect(sendCot).not.toHaveBeenCalled();
	});

	it('reports initial status (no broadcasting, zero count)', () => {
		const { sender } = makeStubSender();
		const b = new TakSaBroadcaster(sender);
		const status = b.getStatus();
		expect(status.broadcasting).toBe(false);
		expect(status.broadcastCount).toBe(0);
		expect(status.lastBroadcastAt).toBeNull();
	});

	it('CotSender contract requires only `sendCot(cot: CoT)`', () => {
		// This compiles only because CotSender is the minimal interface.
		// Adding non-required fields to the stub is allowed (structural).
		const stub: CotSender = {
			sendCot(_cot: CoT): void {
				/* no-op */
			}
		};
		expect(typeof stub.sendCot).toBe('function');
	});
});
