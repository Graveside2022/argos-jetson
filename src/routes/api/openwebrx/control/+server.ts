/**
 * POST /api/openwebrx/control
 *
 * Control the native OpenWebRX+ systemd service. Shares the HackRF with
 * NovaSDR/SDR++ via the ResourceManager singleton — starting while a peer
 * holds the device auto-evicts the peer; starting while a non-peer holds
 * it returns 409.
 *
 * Lifecycle orchestration (claim, withWebRxLock, refreshNow, error rollback)
 * lives in {@link src/lib/server/services/hackrf-tool/lifecycle.ts}. This
 * file is intentionally thin — the route exists only to map the URL to the
 * {@link openwebrxDriver}.
 *
 * Body: `{ action: 'start' | 'stop' | 'restart' | 'status' }`
 */

import { createHackRfToolHandler } from '$lib/server/services/hackrf-tool';
import { openwebrxDriver } from '$lib/server/services/hackrf-tool/drivers/openwebrx';

export const POST = createHackRfToolHandler(openwebrxDriver);
