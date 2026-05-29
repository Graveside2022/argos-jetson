/**
 * Type definitions and constants for the GNU Radio VNC service.
 *
 * Spawns a three-process stack (Xtigervnc + gnuradio-companion + websockify)
 * to stream the native GRC GUI into the Argos dashboard via noVNC.
 *
 * Ports are offset from Wireshark (:96/5996/6083), SDR++ (:97/5997/6082),
 * Sparrow-WiFi (:98/5998/6081), and WebTAK (:99/5999/6080) so all five
 * stacks can run simultaneously.
 */

// Canonical port/display constants come from `vnc-common/port-allocation`
// per ADR 0005 — single source of truth across all five VNC tools.
import { getVncAllocation } from '../vnc-common/port-allocation';
const _GR_ALLOC = getVncAllocation('gnu-radio-vnc');

/** X display number used by Xtigervnc and gnuradio-companion. */
export const GNU_RADIO_VNC_DISPLAY = _GR_ALLOC.display;

/** TCP port where Xtigervnc serves the VNC protocol on localhost. */
export const GNU_RADIO_VNC_PORT = _GR_ALLOC.vncPort;

/** TCP port where websockify exposes the VNC session as a WebSocket. */
export const GNU_RADIO_WS_PORT = _GR_ALLOC.wsPort;

/** URL path segment served by websockify. */
export const GNU_RADIO_WS_PATH = '/websockify';

/** Geometry passed to Xtigervnc (`WxH`). 1440x900 matches Wireshark for visual parity. */
export const GNU_RADIO_GEOMETRY = '1440x900';

/** Color depth for the virtual framebuffer. */
export const GNU_RADIO_DEPTH = 24;

/** Result returned from every control action (start/stop/status). */
export interface GnuRadioVncControlResult {
	success: boolean;
	message: string;
	error?: string;
	wsPort?: number;
	wsPath?: string;
	flowgraph?: string;
}

/** Result returned from the status action. */
export interface GnuRadioVncStatusResult {
	success: true;
	isRunning: boolean;
	status: 'active' | 'inactive';
	wsPort: number;
	wsPath: string;
	flowgraph: string | null;
}
