/**
 * Blue Dragon adapter for the SignalSource registry.
 *
 * The BD capture lifecycle already persists observations via
 * bluedragon/signal-persistence.ts — this adapter simply exposes that
 * runtime state to the registry so the dashboard can enumerate "which
 * signal sources are currently capturing into the active session?".
 *
 * start/stop are intentionally no-ops here: BD lifecycle is driven by
 * `/api/bluedragon/control`. Wrapping that flow would risk double-starting
 * the process; this adapter is read-only.
 */

import { isBluedragonActive } from '$lib/server/services/bluedragon/state';

import type { SignalSourceAdapter } from './signal-sources';

export const bluedragonSignalSource: SignalSourceAdapter = {
	name: 'bluedragon',
	isRunning: () => isBluedragonActive(),
	start: () => Promise.resolve(),
	stop: () => Promise.resolve()
};
