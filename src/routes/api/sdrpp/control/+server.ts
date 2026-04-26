/**
 * POST /api/sdrpp/control
 *
 * Control SDR++ via the VNC stack (Xtigervnc + SDR++ + websockify). Shares
 * the HackRF with OpenWebRX / NovaSDR via the ResourceManager singleton.
 *
 * Lifecycle orchestration lives in the HackRF tool framework. This file is
 * intentionally thin — the route only binds the URL to {@link sdrppDriver}.
 *
 * Body: `{ action: 'start' | 'stop' | 'restart' | 'status' }`
 * Start/restart success includes `wsPort` + `wsPath` for the noVNC client.
 */

import { createHackRfToolHandler } from '$lib/server/services/hackrf-tool';
import { sdrppDriver } from '$lib/server/services/hackrf-tool/drivers/sdrpp';

export const POST = createHackRfToolHandler(sdrppDriver);
