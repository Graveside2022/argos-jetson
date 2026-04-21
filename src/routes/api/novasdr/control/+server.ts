/**
 * POST /api/novasdr/control
 *
 * Control the NovaSDR Docker container. Shares the HackRF with OpenWebRX +
 * SDR++ via the ResourceManager singleton. Lifecycle uses `docker compose`
 * (not raw `docker start`) so the external `argos-dev-network` ID is
 * re-resolved on every invocation — self-heals after network rebuilds.
 *
 * Lifecycle orchestration (claim, withWebRxLock, refreshNow, error rollback,
 * `process.cwd()` resolution) lives in the HackRF tool framework. This
 * file is intentionally thin.
 *
 * Body: `{ action: 'start' | 'stop' | 'restart' | 'status' }`
 */

import { createHackRfToolHandler } from '$lib/server/services/hackrf-tool';
import { novasdrDriver } from '$lib/server/services/hackrf-tool/drivers/novasdr';

export const POST = createHackRfToolHandler(novasdrDriver);
