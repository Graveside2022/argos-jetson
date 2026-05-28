/**
 * Type definitions and constants for the Sparrow-WiFi VNC service.
 *
 * Spawns a three-process stack (Xtigervnc + sparrow-wifi.py + websockify)
 * to stream the full PyQt5 GUI into the Argos dashboard via noVNC.
 *
 * Port + display constants come from the canonical registry in
 * `vnc-common/port-allocation` (single source of truth across all five
 * VNC tools per ADR 0005). Sparrow's canonical slot is `:95/5995/6080`.
 */

import { getVncAllocation } from '../vnc-common/port-allocation';

const _SPARROW_ALLOC = getVncAllocation('sparrow');

/** X display number used by Xtigervnc and Sparrow GUI. */
export const SPARROW_VNC_DISPLAY = _SPARROW_ALLOC.display;

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const SPARROW_VNC_PORT = _SPARROW_ALLOC.vncPort;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const SPARROW_WS_PORT = _SPARROW_ALLOC.wsPort;

/** Geometry passed to Xtigervnc (`WxH`). */
export const SPARROW_GEOMETRY = '1280x720';

/** Color depth for the virtual framebuffer. */
export const SPARROW_DEPTH = 24;

/** Path to the Sparrow-WiFi GUI script. */
export const SPARROW_GUI_PATH = '/opt/sparrow-wifi/sparrow-wifi.py';

/** Result returned from every control action (start/stop/status). */
export interface SparrowVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
}

/** Result returned from the status action. */
export interface SparrowVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
}
