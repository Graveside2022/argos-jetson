/**
 * Module-scope singleton for the Kismet SignalSource adapter, lazily constructed
 * on first access so tests that never import it do not pay for the poller.
 */

import { KismetProxy } from '$lib/server/kismet/kismet-proxy';

import { createKismetSignalSource, type KismetSignalSource } from './kismet-signal-source';
import { getSignalSource, registerSignalSource } from './signal-sources';

const POLL_INTERVAL_MS = 5_000;

let instance: KismetSignalSource | null = null;

export function getKismetSignalSource(): KismetSignalSource {
	if (instance) return instance;
	instance = createKismetSignalSource({
		fetchDevices: () => KismetProxy.getDevices(),
		intervalMs: POLL_INTERVAL_MS
	});
	// Register so `listSignalSources()` surfaces it to the UI.
	if (!getSignalSource('kismet')) registerSignalSource(instance);
	return instance;
}
