/**
 * Blue Dragon process manager (thin orchestrator).
 *
 * Owns the public surface consumed by `src/routes/api/bluedragon/**` and by
 * the sibling `process-manager.test.ts`. All internals are split across
 * peer modules:
 *
 *   - `./state`     — RuntimeState + cached / frozen snapshot + status readers
 *   - `./args`      — CLI argument builder (pure, tested directly)
 *   - `./pid-fifo`  — FIFO + PID file housekeeping + stale-child reaper
 *   - `./events`    — WebSocket broadcasts + child-process listeners
 *   - `./lifecycle` — start / stop orchestration (B205 claim, spawn, terminate)
 *
 * Importing this module triggers `reapStaleChild()` (side-effect) to defend
 * against Vite HMR leaving orphaned blue-dragon children attached to the USRP.
 *
 * @module
 */

import { broadcastStatus } from './events';
import { reapStaleChild } from './pid-fifo';
import { resetFrozenSnapshot, state } from './state';

// Re-exports — routes + tests import these from this module.
export { buildArgs } from './args';
export { startBluedragon, stopBluedragon } from './lifecycle';
export { getBluedragonDevices, getBluedragonStatusSync } from './state';

// Side-effect: reap orphan children from prior HMR module loads.
reapStaleChild();

export function resetBluedragonDevices(): void {
	state.aggregator?.reset();
	resetFrozenSnapshot();
	broadcastStatus();
}
